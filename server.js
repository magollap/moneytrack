import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from './src/lib/db.js';
import { buildSummary, generateDemoTransactions } from './server/lib/demo.js';
import { parseStatementFile } from './server/lib/statement.js';
import {
  getBudgetState,
  setBudget,
  removeBudget,
  generatePlan,
  monthKey,
} from './server/lib/plan.js';
import { buildReport } from './server/lib/reports.js';
import { aiStatus, askAi } from './server/lib/ai.js';

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

    const demo = generateDemoTransactions();
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.transaction.createMany({ data: demo.map((t) => ({ ...t, userId })) });

    ok(res, buildSummary(demo));
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

    const parsed = result.rows;
    await prisma.transaction.createMany({ data: parsed.map((t) => ({ ...t, userId })) });

    ok(res, {
      ...buildSummary(parsed),
      import: {
        source: result.source,
        pages: result.pages,
        transactions: parsed.length,
        file: req.file.originalname,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// --- TRANSACTIONS LIST ---
app.get('/api/v1/transactions', async (req, res) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { start_date, end_date, category, account_id, is_waste, q, limit } = req.query;
    const where = { userId };
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }
    if (category) where.category = category;
    if (account_id) where.accountId = account_id;
    if (is_waste !== undefined) where.isWaste = is_waste === 'true';
    if (q) where.description = { contains: q };

    const data = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: Math.min(Number(limit) || 500, 2000),
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

    const rows = await prisma.transaction.findMany({ where: { userId } });
    ok(res, buildSummary(rows));
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
  for (const t of list) {
    const amount = Math.abs(Number(t.amount) || 0);
    spent += amount;
    if (t.isWaste) waste += amount;
    byCategory[t.category] = Number(((byCategory[t.category] || 0) + amount).toFixed(2));
  }
  return {
    spent: Number(spent.toFixed(2)),
    waste: Number(waste.toFixed(2)),
    transactions: list.length,
    by_category: byCategory,
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
