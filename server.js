import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prisma } from './src/lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// --- AUTH ---
// Self-registration: if the username does not exist, create it.
// The very first user in the database becomes the admin.
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    let user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      const userCount = await prisma.user.count();
      user = await prisma.user.create({
        data: { username, password, isAdmin: userCount === 0 }
      });
    } else if (user.password !== password) {
      return res.status(401).json({ success: false, error: 'Invalid password' });
    }

    res.json({
      success: true,
      data: { id: user.id, username: user.username, isAdmin: user.isAdmin, createdAt: user.createdAt }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- DEMO DATA ---
app.post('/api/v1/demo/load', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized user' });

    const demo = generateDemoTransactions();
    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.transaction.createMany({
      data: demo.map(t => ({ ...t, userId }))
    });

    res.json({ success: true, data: buildSummary(demo) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- TRANSACTIONS UPLOAD & PARSING ---
app.post('/api/v1/transactions/upload', upload.single('file'), async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized user' });
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const content = req.file.buffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    const startIndex = /date/i.test(lines[0]) ? 1 : 0;

    const parsed = [];
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(/,|\t/);
      if (parts.length >= 3) {
        const dateStr = parts[0].trim();
        const desc = parts[1].trim();
        const amount = Math.abs(parseFloat(parts[2].trim()) || 0);
        if (!amount) continue;

        const { category, isWaste } = categorize(desc);
        if (category === 'Income') continue;

        parsed.push({
          date: new Date(dateStr || Date.now()),
          description: desc,
          amount,
          category,
          isWaste
        });
      }
    }

    await prisma.transaction.createMany({
      data: parsed.map(t => ({ ...t, userId }))
    });

    res.json({ success: true, data: buildSummary(parsed) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- TRANSACTIONS LIST ---
app.get('/api/v1/transactions', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized user' });

    const { start_date, end_date, category, account_id, is_waste } = req.query;
    const where = { userId };
    if (start_date || end_date) {
      where.date = {};
      if (start_date) where.date.gte = new Date(start_date);
      if (end_date) where.date.lte = new Date(end_date);
    }
    if (category) where.category = category;
    if (account_id) where.accountId = account_id;
    if (is_waste !== undefined) where.isWaste = is_waste === 'true';

    const data = await prisma.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 200
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- ANALYTICS ---
app.get('/api/v1/analytics/summary', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized user' });

    const rows = await prisma.transaction.findMany({ where: { userId } });
    res.json({ success: true, data: buildSummary(rows) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- SYSTEM STATUS ---
app.get('/api/v1/system/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    db_type: process.env.DATABASE_URL ? 'postgresql' : 'sqlite',
    platform: process.platform,
    uptime_seconds: Math.round(process.uptime()),
    memory_usage_mb: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1))
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
function categorize(desc) {
  const d = desc.toLowerCase();
  if (/(doordash|uber eats|grubhub|restaurant|starbucks|cafe|pizza|sushi)/.test(d)) {
    return { category: 'Dining Out', isWaste: true };
  }
  if (/(netflix|spotify|hulu|disney|subscription|prime video|icloud)/.test(d)) {
    return { category: 'Subscriptions', isWaste: true };
  }
  if (/(grocery|supermarket|whole foods|kroger|aldi|costco)/.test(d)) {
    return { category: 'Groceries', isWaste: false };
  }
  if (/(shell|chevron|exxon|gas station|fuel|uber\*trip)/.test(d)) {
    return { category: 'Transport', isWaste: false };
  }
  if (/(electric|water bill|utility|internet|comcast|at&t|verizon)/.test(d)) {
    return { category: 'Utilities', isWaste: false };
  }
  if (/(rent|mortgage|landlord)/.test(d)) {
    return { category: 'Housing', isWaste: false };
  }
  if (/(salary|payroll|deposit|refund)/.test(d)) {
    return { category: 'Income', isWaste: false };
  }
  if (/(fee|late charge|atm fee|overdraft)/.test(d)) {
    return { category: 'Fees', isWaste: true };
  }
  return { category: 'General', isWaste: false };
}

function buildSummary(rows) {
  const categoryMap = {};
  let totalSpent = 0;
  let wasteTotal = 0;

  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0);
    totalSpent += amount;
    if (t.isWaste) wasteTotal += amount;
    if (!categoryMap[t.category]) categoryMap[t.category] = { amount: 0, isWaste: t.isWaste };
    categoryMap[t.category].amount += amount;
    if (t.isWaste) categoryMap[t.category].isWaste = true;
  }

  const categories = Object.entries(categoryMap)
    .map(([name, v]) => ({
      name,
      amount: Number(v.amount.toFixed(2)),
      percentage: totalSpent > 0 ? Number(((v.amount / totalSpent) * 100).toFixed(1)) : 0,
      is_waste: v.isWaste
    }))
    .sort((a, b) => b.amount - a.amount);

  const annualWaste = wasteTotal * 12;
  const monthlyRate = 0.07 / 12;
  const months = 120;
  const futureValue = annualWaste / 12 * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

  return {
    period: 'Last 90 days',
    total_spent: Number(totalSpent.toFixed(2)),
    waste_total: Number(wasteTotal.toFixed(2)),
    annual_waste_projection: Number(annualWaste.toFixed(2)),
    potential_investment_value_10yr: Number(futureValue.toFixed(2)),
    categories
  };
}

function generateDemoTransactions() {
  const vendors = [
    { desc: 'DOORDASH*SUSHI PALACE', cat: 'Dining Out', waste: true, min: 22, max: 65 },
    { desc: 'UBER EATS LATE NIGHT', cat: 'Dining Out', waste: true, min: 18, max: 48 },
    { desc: 'STARBUCKS #4821', cat: 'Dining Out', waste: true, min: 5, max: 14 },
    { desc: 'NETFLIX.COM MONTHLY', cat: 'Subscriptions', waste: true, min: 15.99, max: 15.99 },
    { desc: 'SPOTIFY PREMIUM', cat: 'Subscriptions', waste: true, min: 10.99, max: 10.99 },
    { desc: 'DISNEY+ BUNDLE', cat: 'Subscriptions', waste: true, min: 13.99, max: 13.99 },
    { desc: 'WHOLE FOODS MARKET', cat: 'Groceries', waste: false, min: 60, max: 180 },
    { desc: 'KROGER SUPERMARKET', cat: 'Groceries', waste: false, min: 40, max: 120 },
    { desc: 'SHELL GAS STATION', cat: 'Transport', waste: false, min: 35, max: 70 },
    { desc: 'UBER*TRIP', cat: 'Transport', waste: false, min: 9, max: 32 },
    { desc: 'ELECTRIC UTILITY BILL', cat: 'Utilities', waste: false, min: 70, max: 140 },
    { desc: 'COMCAST INTERNET', cat: 'Utilities', waste: false, min: 79.99, max: 79.99 },
    { desc: 'ATM FEE', cat: 'Fees', waste: true, min: 3, max: 5 },
    { desc: 'LATE PAYMENT CHARGE', cat: 'Fees', waste: true, min: 25, max: 35 }
  ];

  const out = [];
  const today = new Date();
  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const count = Math.random() < 0.45 ? 1 : 0;
    for (let c = 0; c < count; c++) {
      const v = vendors[Math.floor(Math.random() * vendors.length)];
      const amount = Number((v.min + Math.random() * (v.max - v.min)).toFixed(2));
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      out.push({ date, description: v.desc, amount, category: v.cat, isWaste: v.waste });
    }
  }
  return out;
}
