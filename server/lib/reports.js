// Monthly report builder: category comparison, merchant ranking, budget status.

import { getBudgetState, monthKey, monthRange } from './plan.js'

const DAY = 86400000

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)))
}

function totals(rows) {
  let spent = 0
  let waste = 0
  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    spent += amount
    if (t.isWaste) waste += amount
  }
  return { spent: Number(spent.toFixed(2)), waste: Number(waste.toFixed(2)), count: rows.length }
}

function byCategory(rows) {
  const map = new Map()
  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    const entry = map.get(t.category) || { amount: 0, count: 0, isWaste: false }
    entry.amount += amount
    entry.count += 1
    entry.isWaste = entry.isWaste || Boolean(t.isWaste)
    map.set(t.category, entry)
  }
  return map
}

export async function buildReport(prisma, userId, requestedMonth) {
  const month = /^\d{4}-\d{2}$/.test(requestedMonth || '') ? requestedMonth : monthKey()
  const previousMonth = shiftMonth(month, -1)
  const windowStart = monthRange(shiftMonth(month, -5)).start
  const windowEnd = monthRange(month).end

  const [rows, budgets] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, date: { gte: windowStart, lt: windowEnd } },
      orderBy: { date: 'asc' },
    }),
    getBudgetState(prisma, userId, month),
  ])

  const current = rows.filter((t) => monthKey(t.date) === month)
  const previous = rows.filter((t) => monthKey(t.date) === previousMonth)

  const currentTotals = totals(current)
  const previousTotals = totals(previous)

  const currentCats = byCategory(current)
  const previousCats = byCategory(previous)

  const categories = [...currentCats.entries()]
    .map(([name, v]) => {
      const prev = previousCats.get(name)?.amount || 0
      const budget = budgets.categories.find((b) => b.category === name)
      return {
        name,
        amount: Number(v.amount.toFixed(2)),
        count: v.count,
        previous: Number(prev.toFixed(2)),
        change: Number((v.amount - prev).toFixed(2)),
        change_pct: prev > 0 ? Number((((v.amount - prev) / prev) * 100).toFixed(1)) : null,
        share: currentTotals.spent > 0 ? Number(((v.amount / currentTotals.spent) * 100).toFixed(1)) : 0,
        isWaste: v.isWaste,
        budget: budget
          ? { limit: budget.limit, status: budget.status, percentage: budget.percentage }
          : null,
      }
    })
    .sort((a, b) => b.amount - a.amount)

  const merchants = new Map()
  const dailyMap = new Map()
  for (const t of current) {
    const amount = Math.abs(Number(t.amount) || 0)
    const key = t.description
    const m = merchants.get(key) || { amount: 0, count: 0, category: t.category, isWaste: Boolean(t.isWaste) }
    m.amount += amount
    m.count += 1
    merchants.set(key, m)

    const day = new Date(t.date).toISOString().slice(0, 10)
    const d = dailyMap.get(day) || { amount: 0, waste: 0 }
    d.amount += amount
    if (t.isWaste) d.waste += amount
    dailyMap.set(day, d)
  }

  const topMerchants = [...merchants.entries()]
    .map(([description, v]) => ({
      description,
      amount: Number(v.amount.toFixed(2)),
      count: v.count,
      category: v.category,
      isWaste: v.isWaste,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)

  const monthly = []
  for (let i = 5; i >= 0; i--) {
    const m = shiftMonth(month, -i)
    const rowsInMonth = rows.filter((t) => monthKey(t.date) === m)
    const t = totals(rowsInMonth)
    monthly.push({ month: m, spent: t.spent, waste: t.waste, count: t.count })
  }

  const { start, end } = monthRange(month)
  const now = new Date()
  const isCurrentMonth = monthKey(now) === month
  const spanDays = isCurrentMonth
    ? Math.max(1, now.getUTCDate())
    : Math.max(1, Math.round((end - start) / DAY))

  const insights = []
  const biggest = categories[0]
  if (biggest) {
    insights.push(
      `${biggest.name} was the largest category at $${biggest.amount.toFixed(2)} (${biggest.share}% of spend).`
    )
  }
  const risers = categories
    .filter((c) => c.change_pct != null && c.change > 20)
    .sort((a, b) => b.change_pct - a.change_pct)
  if (risers[0]) {
    insights.push(
      `${risers[0].name} rose ${risers[0].change_pct}% versus last month (+$${risers[0].change.toFixed(2)}).`
    )
  }
  const over = budgets.categories.filter((c) => c.status === 'over' && c.kind !== 'goal')
  if (over.length) {
    insights.push(
      `${over.length} budget${over.length > 1 ? 's' : ''} exceeded: ${over.map((c) => c.category).join(', ')}.`
    )
  } else if (budgets.total.budget > 0) {
    insights.push(`All spending budgets are within plan (${budgets.total.percentage}% used).`)
  }
  if (currentTotals.waste > 0) {
    insights.push(
      `Waste was $${currentTotals.waste.toFixed(2)}, or ${((currentTotals.waste / currentTotals.spent) * 100).toFixed(1)}% of the month.`
    )
  }

  return {
    month,
    label: budgets.label,
    previous_month: previousMonth,
    totals: {
      ...currentTotals,
      previous_spent: previousTotals.spent,
      change: Number((currentTotals.spent - previousTotals.spent).toFixed(2)),
      change_pct:
        previousTotals.spent > 0
          ? Number((((currentTotals.spent - previousTotals.spent) / previousTotals.spent) * 100).toFixed(1))
          : null,
      avg_per_day: Number((currentTotals.spent / spanDays).toFixed(2)),
      days: spanDays,
    },
    budgets,
    categories,
    top_merchants: topMerchants,
    monthly,
    daily: [...dailyMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, amount: Number(v.amount.toFixed(2)), waste: Number(v.waste.toFixed(2)) })),
    insights,
  }
}
