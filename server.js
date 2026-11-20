import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from './src/lib/db.js';
import { buildSummary, generateDemoTransactions } from './server/lib/demo.js';
import { parseStatementFile } from './server/lib/statement.js';
import { summarizeFlows, isSpending } from './server/lib/classify.js';
import {
  getBudgetState,
  setBudget,
  removeBudget,
  generatePlan,
  monthKey,
} from './server/lib/plan.js';
import { buildReport } from './server/lib/reports.js';
import { aiStatus, askAi } from './server/lib/ai.js';
import {
  accountScope,
  flowDirection,
  isWasteCategory,
  lastFour,
  listAccounts,
  resolveUploadAccount,
  splitDuplicates,
} from './server/lib/accounts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function requireUser(req, res) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized user' });
    return null;
  }
  return userId;
}

const ok = (res, data) => res.json({ success: true, data });
const fail = (res, err, code = 500) => res.status(code).json({ success: false, error: err.message || String(err) });

// --- AUTH ---
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return fail(res, new Error('Username and password are required'), 400);
    }

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      const userCount = await prisma.user.count();
      user = await prisma.user.create({
        data: { username, password, isAdmin: userCount === 0 },
      });
    } else if (user.password !== password) {
      return fail(res, new Error('Invalid password'), 401);
    }

    ok(res, {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    });
  } catch (err) {
    fail(res, err);
  }
});

// --- DEMO DATA ---
app.post('/api/v1/demo/load', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    // Demo data is tagged and scoped to a demo account, so loading it never
    // removes statements the user uploaded themselves.
    let account = await prisma.account.findFirst({ where: { userId, isDemo: true } });
    if (!account) {
      account = await prisma.account.create({
        data: {
          userId,
          name: 'Demo account',
          type: 'checking',
          institution: 'MoneyTrack Demo',
          openingBalance: 2500,
          isDemo: true,
        },
      });
    }

    await prisma.transaction.deleteMany({ where: { userId, source: 'demo' } });
    const demo = generateDemoTransactions();
    await prisma.transaction.createMany({
      data: demo.map((t) => ({
        ...t,
        userId,
        accountId: account.id,
        source: 'demo',
      })),
    });

    ok(res, { ...buildSummary(demo), flows: summarizeFlows(demo), demo_account_id: account.id });
  } catch (err) {
    fail(res, err);
  }
});

// Remove only the generated demo data, keeping uploaded/manual transactions.
app.post('/api/v1/demo/clear', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const removed = await prisma.transaction.deleteMany({ where: { userId, source: 'demo' } });
    await prisma.account.deleteMany({ where: { userId, isDemo: true } });
    ok(res, { removed: removed.count, accounts: await listAccounts(prisma, userId) });
  } catch (err) {
    fail(res, err);
  }
});

// --- TRANSACTIONS UPLOAD & PARSING (CSV / TSV / PDF) ---
app.post('/api/v1/transactions/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    if (!req.file) return fail(res, new Error('No file uploaded'), 400);

    let result;
    try {
      result = await parseStatementFile({
        buffer: req.file.buffer,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      });
    } catch (err) {
      const hint = /password|encrypt/i.test(err.message)
        ? ' Password-protected PDFs are not supported — remove the password and retry.'
        : '';
      return fail(res, new Error(`${err.message}${hint}`), 422);
    }

    if (!result.rows.length) {
      return fail(
        res,
        new Error(
          'No transactions could be read. Expected a dated table (date, description, amount). Scanned PDFs need OCR — export CSV from your bank instead.'
        ),
        422
      );
    }

    let account = null;
    try {
      account = await resolveUploadAccount(prisma, userId, {
        accountId: req.body?.account_id,
        metadata: result,
        statementType: result.statementType,
      });
    } catch (err) {
      return fail(res, err, 400);
    }

    const accountId = account?.id || null;
    const { fresh, duplicates } = await splitDuplicates(prisma, userId, accountId, result.rows);

    const parsed = fresh.map((t) => ({
      ...t,
      userId,
      accountId,
      source: 'upload',
      statementType: result.statementType,
    }));

    if (parsed.length) {
      await prisma.transaction.createMany({ data: parsed });
    }

    ok(res, {
      ...buildSummary(parsed),
      flows: summarizeFlows(parsed),
      import: {
        source: result.source,
        pages: result.pages,
        statement_type: result.statementType,
        institution: result.institution,
        period: result.period,
        account: result.account,
        account_id: accountId,
        account_name: account?.name || null,
        transactions: result.rows.length,
        imported: parsed.length,
        duplicates,
        file: req.file.originalname,
      },
      transactions: parsed.slice(0, 500).map((t) => ({
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        flow: t.flow,
        direction: t.direction,
        isWaste: t.isWaste,
      })),
      accounts: await listAccounts(prisma, userId),
    });
  } catch (err) {
    fail(res, err);
  }
});

// --- MANUAL TRANSACTIONS ---
app.post('/api/v1/transactions', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const body = req.body || {};
    const description = String(body.description || '').trim();
    if (!description) return fail(res, new Error('Description is required'), 400);

    const amount = Math.abs(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(res, new Error('Amount must be a positive number'), 400);
    }

    const date = body.date ? new Date(body.date) : new Date();
    if (Number.isNaN(date.getTime())) return fail(res, new Error('Invalid date'), 400);

    let accountId = null;
    if (body.account_id && body.account_id !== 'unassigned') {
      const account = await prisma.account.findFirst({ where: { id: body.account_id, userId } });
      if (!account) return fail(res, new Error('Account not found'), 400);
      accountId = account.id;
    }

    const category = String(body.category || 'Miscellaneous');
    const kind = flowDirection(body.flow, body.direction);
    const isWaste =
      body.is_waste === undefined ? isWasteCategory(category) : Boolean(body.is_waste);

    const created = await prisma.transaction.create({
      data: {
        userId,
        accountId,
        date,
        description,
        amount,
        category,
        flow: kind.flow,
        direction: kind.direction,
        source: 'manual',
        isWaste,
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
      },
    });

    ok(res, created);
  } catch (err) {
    fail(res, err, 400);
  }
});

// Clear every transaction for the current user (accounts are kept).
app.delete('/api/v1/transactions/all', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const removed = await prisma.transaction.deleteMany({ where: { userId } });
    ok(res, { removed: removed.count });
  } catch (err) {
    fail(res, err);
  }
});

app.patch('/api/v1/transactions/:id', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const existing = await prisma.transaction.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return fail(res, new Error('Transaction not found'), 404);

    const body = req.body || {};
    const data = {};

    if (body.description !== undefined) {
      const description = String(body.description).trim();
      if (!description) return fail(res, new Error('Description cannot be empty'), 400);
      data.description = description;
    }
    if (body.amount !== undefined) {
      const amount = Math.abs(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        return fail(res, new Error('Amount must be a positive number'), 400);
      }
      data.amount = amount;
    }
    if (body.date !== undefined) {
      const date = new Date(body.date);
      if (Number.isNaN(date.getTime())) return fail(res, new Error('Invalid date'), 400);
      data.date = date;
    }
    if (body.category !== undefined) {
      data.category = String(body.category);
      if (body.is_waste === undefined) data.isWaste = isWasteCategory(body.category);
    }
    if (body.is_waste !== undefined) data.isWaste = Boolean(body.is_waste);
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).slice(0, 500) : null;

    if (body.account_id !== undefined) {
      if (!body.account_id || body.account_id === 'unassigned') {
        data.accountId = null;
      } else {
        const account = await prisma.account.findFirst({
          where: { id: body.account_id, userId },
        });
        if (!account) return fail(res, new Error('Account not found'), 400);
        data.accountId = account.id;
      }
    }

    if (body.flow !== undefined || body.direction !== undefined) {
      const kind = flowDirection(body.flow ?? existing.flow, body.direction ?? existing.direction);
      data.flow = kind.flow;
      data.direction = kind.direction;
    }

    const updated = await prisma.transaction.update({ where: { id: existing.id }, data });
    ok(res, updated);
  } catch (err) {
    fail(res, err, 400);
  }
});

app.delete('/api/v1/transactions/:id', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const removed = await prisma.transaction.deleteMany({
      where: { id: req.params.id, userId },
    });
    if (!removed.count) return fail(res, new Error('Transaction not found'), 404);
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, err);
  }
});

// --- ACCOUNTS ---
app.get('/api/v1/accounts', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    ok(res, await listAccounts(prisma, userId));
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/v1/accounts', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const body = req.body || {};
    const name = String(body.name || '').trim();
    if (!name) return fail(res, new Error('Account name is required'), 400);

    const opening = Number(body.opening_balance ?? body.openingBalance ?? 0);
    const account = await prisma.account.create({
      data: {
        userId,
        name: name.slice(0, 80),
        type: ['checking', 'savings', 'credit_card', 'cash'].includes(body.type)
          ? body.type
          : 'checking',
        institution: String(body.institution || '').trim().slice(0, 80) || 'Manual',
        last4: lastFour(body.last4),
        openingBalance: Number.isFinite(opening) ? opening : 0,
      },
    });

    ok(res, { account, accounts: await listAccounts(prisma, userId) });
  } catch (err) {
    fail(res, err, 400);
  }
});

app.patch('/api/v1/accounts/:id', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return fail(res, new Error('Account not found'), 404);

    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return fail(res, new Error('Account name cannot be empty'), 400);
      data.name = name.slice(0, 80);
    }
    if (body.type !== undefined) {
      if (!['checking', 'savings', 'credit_card', 'cash'].includes(body.type)) {
        return fail(res, new Error('Unsupported account type'), 400);
      }
      data.type = body.type;
    }
    if (body.institution !== undefined) data.institution = String(body.institution).slice(0, 80);
    if (body.last4 !== undefined) data.last4 = lastFour(body.last4);
    if (body.opening_balance !== undefined || body.openingBalance !== undefined) {
      const value = Number(body.opening_balance ?? body.openingBalance);
      if (!Number.isFinite(value)) return fail(res, new Error('Invalid opening balance'), 400);
      data.openingBalance = value;
    }

    await prisma.account.update({ where: { id: existing.id }, data });
    ok(res, await listAccounts(prisma, userId));
  } catch (err) {
    fail(res, err, 400);
  }
});

app.delete('/api/v1/accounts/:id', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return fail(res, new Error('Account not found'), 404);

    await prisma.transaction.updateMany({
      where: { userId, accountId: existing.id },
      data: { accountId: null },
    });
    await prisma.account.delete({ where: { id: existing.id } });
    ok(res, await listAccounts(prisma, userId));
  } catch (err) {
    fail(res, err);
  }
});

// --- TRANSACTIONS LIST ---
app.get('/api/v1/transactions', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { start_date, end_date, category, account_id, is_waste, q, limit, flow, direction } = req.query;
    const where = { userId, ...accountScope(account_id) };
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }
    if (category) where.category = category;
    if (is_waste !== undefined) where.isWaste = is_waste === 'true';
    if (flow) where.flow = flow;
    if (direction) where.direction = direction;
    if (q) where.description = { contains: q };

    const data = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: Math.min(Number(limit) || 500, 2000),
      include: {
        account: {
          select: { id: true, name: true, type: true, institution: true, last4: true },
        },
      },
    });

    ok(res, data);
  } catch (err) {
    fail(res, err);
  }
});

// --- ANALYTICS ---
app.get('/api/v1/analytics/summary', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const rows = await prisma.transaction.findMany({
      where: { userId, ...accountScope(req.query.account_id) },
    });
    ok(res, { ...buildSummary(rows), account_scope: req.query.account_id || 'all' });
  } catch (err) {
    fail(res, err);
  }
});

// --- BUDGETS / PLAN ---
app.get('/api/v1/budgets', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : monthKey();
    ok(res, await getBudgetState(prisma, userId, month));
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/v1/budgets', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const { category, amount, month } = req.body || {};
    await setBudget(prisma, userId, { category, amount, month: month || 'default' });
    ok(res, await getBudgetState(prisma, userId, req.body?.view_month || monthKey()));
  } catch (err) {
    fail(res, err, 400);
  }
});

app.delete('/api/v1/budgets/:id', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    await removeBudget(prisma, userId, req.params.id);
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : monthKey();
    ok(res, await getBudgetState(prisma, userId, month));
  } catch (err) {
    fail(res, err, 400);
  }
});

app.post('/api/v1/budgets/generate', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const month = /^\d{4}-\d{2}$/.test(req.body?.month || '') ? req.body.month : monthKey();
    ok(res, await generatePlan(prisma, userId, month));
  } catch (err) {
    fail(res, err);
  }
});

// --- REPORTS ---
app.get('/api/v1/reports', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    ok(res, await buildReport(prisma, userId, req.query.month));
  } catch (err) {
    fail(res, err);
  }
});

// --- AI SKILLS ---
app.get('/api/v1/ai/status', async (req, res) => {
  try {
    ok(res, await aiStatus({ force: req.query.refresh === 'true' }));
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/v1/ai/ask', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const question = String(req.body?.question || '').trim();
    if (!question) return fail(res, new Error('Question is required'), 400);
    if (question.length > 500) return fail(res, new Error('Keep the question under 500 characters'), 400);

    const month = /^\d{4}-\d{2}$/.test(req.body?.month || '') ? req.body.month : monthKey();
    const [rows, budgets, report] = await Promise.all([
      prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: 1500 }),
      getBudgetState(prisma, userId, month),
      buildReport(prisma, userId, month),
    ]);

    const lastMonth = shiftMonth(month, -1);
    const context = buildAiContext({ rows, budgets, report, month, lastMonth });
    const result = await askAi({ question, context, rows, budgets });

    ok(res, { ...result, question, engine_status: await aiStatus() });
  } catch (err) {
    fail(res, err);
  }
});

// --- SYSTEM STATUS ---
app.get('/api/v1/system/status', (req, res) => {
  ok(res, {
    status: 'online',
    version: '1.1.0',
    db_type: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
    platform: process.platform,
    uptime_seconds: Math.round(process.uptime()),
    memory_usage_mb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
  });
});

// --- SERVE BUILT FRONTEND (production) ---
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`MoneyTrack API running on http://localhost:${PORT}`);
});

// --- helpers ---
function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)));
}

function rowsInMonth(rows, month) {
  return rows.filter((t) => monthKey(t.date) === month);
}

function summarize(list) {
  const byCategory = {};
  let spent = 0;
  let waste = 0;
  let count = 0;
  for (const t of list) {
    if (!isSpending(t)) continue;
    const amount = Math.abs(Number(t.amount) || 0);
    spent += amount;
    if (t.isWaste) waste += amount;
    count += 1;
    byCategory[t.category] = Number(((byCategory[t.category] || 0) + amount).toFixed(2));
  }
  const flows = summarizeFlows(list);
  return {
    spent: Number(spent.toFixed(2)),
    waste: Number(waste.toFixed(2)),
    transactions: count,
    by_category: byCategory,
    money_in: flows.money_in,
    money_out: flows.money_out,
    net_cash_flow: flows.net,
    income: flows.income,
    refunds: flows.refunds,
    card_payments_in: flows.card_payments_in,
    card_payments_out: flows.card_payments_out,
    transfers_in: flows.transfers_in,
    transfers_out: flows.transfers_out,
  };
}

function buildAiContext({ rows, budgets, report, month, lastMonth }) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  const recent7 = rows.filter((t) => new Date(t.date) >= sevenDaysAgo);
  const recent90 = rows.filter((t) => new Date(t.date) >= ninetyDaysAgo);

  const merchants = {};
  for (const t of recent90) {
    if (!isSpending(t)) continue;
    const key = t.description;
    merchants[key] = merchants[key] || { amount: 0, count: 0 };
    merchants[key].amount += Math.abs(Number(t.amount) || 0);
    merchants[key].count += 1;
  }

  return {
    today: now.toISOString().slice(0, 10),
    currency: 'USD',
    all_time: {
      ...summarize(rows),
      period: report.month === month ? `${report.monthly[0]?.month || month} → ${month}` : month,
    },
    this_month: { month, label: budgets.label, ...summarize(rowsInMonth(rows, month)) },
    last_month: { month: lastMonth, ...summarize(rowsInMonth(rows, lastMonth)) },
    last_7_days: summarize(recent7),
    budget_status: {
      month: budgets.month,
      total_budget: budgets.total.budget,
      total_spent: budgets.total.spent,
      percentage_used: budgets.total.percentage,
      status: budgets.total.status,
      categories: budgets.categories.map((b) => ({
        category: b.category,
        limit: b.limit,
        spent: b.spent,
        status: b.status,
        percentage: b.percentage,
        kind: b.kind,
      })),
    },
    top_merchants_90d: Object.entries(merchants)
      .map(([description, v]) => ({
        description,
        amount: Number(v.amount.toFixed(2)),
        count: v.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 12),
    history_6m: report.monthly,
  };
}
