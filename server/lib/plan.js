// Budget plan: fixed monthly limits per category, overrides and smart suggestions.

export const PLAN_CATEGORIES = [
  { category: 'Housing', amount: 1200, kind: 'essential', note: 'Rent or mortgage' },
  { category: 'Groceries', amount: 450, kind: 'essential', note: 'Food at home' },
  { category: 'Utilities', amount: 180, kind: 'essential', note: 'Power, water, internet, phone' },
  { category: 'Transport', amount: 180, kind: 'essential', note: 'Fuel, transit, rideshare' },
  { category: 'Health & Fitness', amount: 120, kind: 'essential', note: 'Pharmacy, gym, clinic' },
  { category: 'Dining Out', amount: 220, kind: 'leak', note: 'Restaurants, delivery, coffee' },
  { category: 'Subscriptions', amount: 60, kind: 'leak', note: 'Streaming and memberships' },
  { category: 'Fees', amount: 25, kind: 'leak', note: 'ATM, late fees, overdraft' },
  { category: 'Clothing', amount: 150, kind: 'lifestyle', note: 'Apparel and shoes' },
  { category: 'Entertainment', amount: 100, kind: 'lifestyle', note: 'Games, cinema, events' },
  { category: 'Miscellaneous', amount: 120, kind: 'lifestyle', note: 'Household and one-offs' },
  { category: 'Savings', amount: 400, kind: 'goal', note: 'Pay yourself first' },
]

const DEFAULTS = Object.fromEntries(PLAN_CATEGORIES.map((c) => [c.category, c]))
const KIND_ORDER = ['essential', 'leak', 'lifestyle', 'goal']

export const monthKey = (date = new Date()) =>
  new Date(date).toISOString().slice(0, 7)

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  return { start, end }
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function statusFor(spent, limit) {
  if (!limit || limit <= 0) return 'unset'
  if (spent > limit) return 'over'
  if (spent >= limit * 0.8) return 'warn'
  return 'ok'
}

export async function ensurePlan(prisma, userId) {
  const existing = await prisma.budget.count({ where: { userId, month: 'default' } })
  if (existing > 0) return
  await prisma.budget.createMany({
    data: PLAN_CATEGORIES.map((c) => ({
      userId,
      category: c.category,
      limitAmount: c.amount,
      month: 'default',
    })),
  })
}

async function rowsForMonth(prisma, userId, month) {
  const { start, end } = monthRange(month)
  return prisma.transaction.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
  })
}

function spendByCategory(rows) {
  const map = {}
  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    map[t.category] = (map[t.category] || 0) + amount
  }
  return map
}

export async function getBudgetState(prisma, userId, month = monthKey()) {
  await ensurePlan(prisma, userId)

  const [budgets, rows] = await Promise.all([
    prisma.budget.findMany({ where: { userId, month: { in: [month, 'default'] } } }),
    rowsForMonth(prisma, userId, month),
  ])

  const overrides = new Map(budgets.filter((b) => b.month === month).map((b) => [b.category, b]))
  const defaults = new Map(budgets.filter((b) => b.month === 'default').map((b) => [b.category, b]))
  const known = [...PLAN_CATEGORIES.map((c) => c.category), ...budgets.map((b) => b.category)]
  const categories = [...new Set(known)]
    .map((name) => {
      const row = overrides.get(name) || defaults.get(name)
      return row ? { name, row } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ka = DEFAULTS[a.name]?.kind || 'lifestyle'
      const kb = DEFAULTS[b.name]?.kind || 'lifestyle'
      return KIND_ORDER.indexOf(ka) - KIND_ORDER.indexOf(kb) || a.name.localeCompare(b.name)
    })

  const spentMap = spendByCategory(rows)
  const items = categories.map(({ name, row }) => {
    const spent = Number((spentMap[name] || 0).toFixed(2))
    const limit = Number(row.limitAmount)
    const status = statusFor(spent, limit)
    return {
      id: row.id,
      category: name,
      limit,
      spent,
      remaining: Number((limit - spent).toFixed(2)),
      percentage: limit > 0 ? Number(((spent / limit) * 100).toFixed(1)) : 0,
      status,
      kind: DEFAULTS[name]?.kind || 'lifestyle',
      note: DEFAULTS[name]?.note || 'Custom category',
      isWaste: Boolean(DEFAULTS[name]?.kind === 'leak'),
      source: row.month === 'default' ? 'plan' : 'override',
    }
  })

  const spendItems = items.filter((i) => i.kind !== 'goal')
  const totalBudget = Number(spendItems.reduce((a, i) => a + i.limit, 0).toFixed(2))
  const totalSpent = Number(spendItems.reduce((a, i) => a + i.spent, 0).toFixed(2))
  const unbudgeted = Object.entries(spentMap)
    .filter(([name]) => !items.some((i) => i.category === name))
    .map(([category, amount]) => ({ category, spent: Number(amount.toFixed(2)) }))

  const goal = items.find((i) => i.kind === 'goal')

  return {
    month,
    label: monthLabel(month),
    total: {
      budget: totalBudget,
      spent: totalSpent,
      remaining: Number((totalBudget - totalSpent).toFixed(2)),
      percentage: totalBudget > 0 ? Number(((totalSpent / totalBudget) * 100).toFixed(1)) : 0,
      status: statusFor(totalSpent, totalBudget),
    },
    savings_goal: goal ? { target: goal.limit, spent: goal.spent } : null,
    categories: items,
    unbudgeted,
    alerts: items
      .filter((i) => i.status === 'over' || i.status === 'warn')
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 4),
  }
}

export async function setBudget(prisma, userId, { category, amount, month = 'default' }) {
  if (!category || !String(category).trim()) throw new Error('Category is required')
  const value = Number(amount)
  if (!Number.isFinite(value) || value < 0) throw new Error('Amount must be a positive number')

  const existing = await prisma.budget.findFirst({ where: { userId, category, month } })
  if (existing) {
    return prisma.budget.update({ where: { id: existing.id }, data: { limitAmount: value } })
  }
  return prisma.budget.create({
    data: { userId, category: String(category).trim(), limitAmount: value, month },
  })
}

export async function removeBudget(prisma, userId, id) {
  const row = await prisma.budget.findFirst({ where: { id, userId } })
  if (!row) throw new Error('Budget not found')
  await prisma.budget.delete({ where: { id: row.id } })
}

function roundTo(value, step = 5) {
  return Math.max(step, Math.round(value / step) * step)
}

export async function generatePlan(prisma, userId, month = monthKey()) {
  await ensurePlan(prisma, userId)

  const now = new Date()
  const months = []
  for (let i = 3; i >= 1; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(monthKey(d))
  }

  const allRows = await prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: monthRange(months[0]).start,
        lt: monthRange(months[months.length - 1]).end,
      },
    },
  })

  const totalsByCategory = {}
  let totalSpend = 0
  for (const t of allRows) {
    const amount = Math.abs(Number(t.amount) || 0)
    totalsByCategory[t.category] = (totalsByCategory[t.category] || 0) + amount
    totalSpend += amount
  }

  const activeMonths = Math.max(1, new Set(allRows.map((t) => monthKey(t.date))).size)
  const avgMonthlySpend = totalSpend / activeMonths

  const suggestions = PLAN_CATEGORIES.map((c) => {
    if (c.kind === 'goal') {
      return { ...c, suggested: roundTo(Math.max(50, avgMonthlySpend * 0.15), 10) }
    }
    const avg = (totalsByCategory[c.category] || 0) / activeMonths
    const base = avg > 0 ? avg * 1.05 : c.amount
    return { ...c, suggested: roundTo(base, 5) }
  })

  for (const s of suggestions) {
    const existing = await prisma.budget.findFirst({
      where: { userId, category: s.category, month: 'default' },
    })
    if (existing) {
      await prisma.budget.update({
        where: { id: existing.id },
        data: { limitAmount: s.suggested },
      })
    } else {
      await prisma.budget.create({
        data: { userId, category: s.category, limitAmount: s.suggested, month: 'default' },
      })
    }
  }

  const state = await getBudgetState(prisma, userId, month)
  return {
    ...state,
    generated_from: months,
    suggestions: suggestions.map((s) => ({
      category: s.category,
      amount: s.suggested,
      kind: s.kind,
      basis: (totalsByCategory[s.category] || 0) > 0 ? 'average spend + 5%' : 'default plan',
    })),
  }
}
