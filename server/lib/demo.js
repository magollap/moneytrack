// Shared transaction helpers: summaries and demo data.

import { directionOf, flowOf, isIncome, isSpending, summarizeFlows } from './classify.js'

export function buildSummary(rows) {
  const categoryMap = {}
  const dailyMap = {}
  const wasteMerchants = {}
  let totalSpent = 0
  let incomeTotal = 0
  let wasteTotal = 0

  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    const day = new Date(t.date).toISOString().slice(0, 10)
    dailyMap[day] = dailyMap[day] || { amount: 0, waste: 0, income: 0 }

    if (isIncome(t)) {
      incomeTotal += amount
      dailyMap[day].income += amount
      continue
    }

    if (!isSpending(t)) continue

    totalSpent += amount
    if (t.isWaste) wasteTotal += amount
    if (!categoryMap[t.category]) categoryMap[t.category] = { amount: 0, isWaste: t.isWaste }
    categoryMap[t.category].amount += amount
    if (t.isWaste) categoryMap[t.category].isWaste = true

    dailyMap[day].amount += amount
    if (t.isWaste) dailyMap[day].waste += amount

    if (t.isWaste) {
      wasteMerchants[t.description] = (wasteMerchants[t.description] || 0) + amount
    }
  }

  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      amount: Number(v.amount.toFixed(2)),
      waste: Number(v.waste.toFixed(2)),
      income: Number(v.income.toFixed(2)),
    }))

  const topWaste = Object.entries(wasteMerchants)
    .map(([description, amount]) => ({ description, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const sortedRows = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date))
  const firstDay = sortedRows.length ? new Date(sortedRows[sortedRows.length - 1].date) : null
  const lastDay = sortedRows.length ? new Date(sortedRows[0].date) : null
  const days = firstDay && lastDay
    ? Math.max(1, Math.round((lastDay - firstDay) / 86400000) + 1)
    : 1

  let period = 'No transactions yet'
  if (firstDay && lastDay) {
    period = `${firstDay.toISOString().slice(0, 10)} → ${lastDay.toISOString().slice(0, 10)}`
  }

  const categories = Object.entries(categoryMap)
    .map(([name, v]) => ({
      name,
      amount: Number(v.amount.toFixed(2)),
      percentage: totalSpent > 0 ? Number(((v.amount / totalSpent) * 100).toFixed(1)) : 0,
      is_waste: v.isWaste,
    }))
    .sort((a, b) => b.amount - a.amount)

  const annualWaste = wasteTotal * 12
  const monthlyRate = 0.07 / 12
  const months = 120
  const futureValue = (annualWaste / 12) * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
  const flows = summarizeFlows(rows)

  return {
    period,
    total_spent: Number(totalSpent.toFixed(2)),
    income_total: Number(incomeTotal.toFixed(2)),
    money_in: flows.money_in,
    money_out: flows.money_out,
    net_cash_flow: flows.net,
    flows,
    waste_total: Number(wasteTotal.toFixed(2)),
    annual_waste_projection: Number(annualWaste.toFixed(2)),
    potential_investment_value_10yr: Number(futureValue.toFixed(2)),
    transaction_count: rows.length,
    spending_count: rows.filter((t) => isSpending(t)).length,
    income_count: rows.filter((t) => isIncome(t)).length,
    avg_daily_spend: Number((totalSpent / days).toFixed(2)),
    waste_share: totalSpent > 0 ? Number(((wasteTotal / totalSpent) * 100).toFixed(1)) : 0,
    categories,
    daily,
    top_waste: topWaste,
  }
}

export function generateDemoTransactions(days = 90) {
  const vendors = [
    ['DOORDASH*SUSHI PALACE', 'Dining Out', true, 22, 65],
    ['UBER EATS LATE NIGHT', 'Dining Out', true, 18, 48],
    ['STARBUCKS #4821', 'Dining Out', true, 5, 14],
    ['CHIPOTLE MEXICAN GRILL', 'Dining Out', true, 9, 22],
    ['NETFLIX.COM MONTHLY', 'Subscriptions', true, 15.99, 15.99],
    ['SPOTIFY PREMIUM', 'Subscriptions', true, 10.99, 10.99],
    ['DISNEY+ BUNDLE', 'Subscriptions', true, 13.99, 13.99],
    ['WHOLE FOODS MARKET', 'Groceries', false, 60, 180],
    ['KROGER SUPERMARKET', 'Groceries', false, 40, 120],
    ['SHELL GAS STATION', 'Transport', false, 35, 70],
    ['UBER*TRIP', 'Transport', false, 9, 32],
    ['ELECTRIC UTILITY BILL', 'Utilities', false, 70, 140],
    ['COMCAST INTERNET', 'Utilities', false, 79.99, 79.99],
    ['ZARA CLOTHING', 'Clothing', false, 35, 140],
    ['NIKE STORE', 'Clothing', false, 60, 180],
    ['CVS PHARMACY', 'Health & Fitness', false, 8, 55],
    ['PLANET FITNESS', 'Health & Fitness', false, 24.99, 24.99],
    ['STEAM GAMES', 'Entertainment', false, 10, 60],
    ['AMAZON MARKETPLACE', 'Miscellaneous', false, 15, 90],
    ['TARGET HOUSEHOLD', 'Miscellaneous', false, 20, 110],
    ['ATM FEE', 'Fees', true, 3, 5],
    ['LATE PAYMENT CHARGE', 'Fees', true, 25, 35],
  ]

  const out = []
  const today = new Date()
  const push = (date, description, amount, category, flow, direction, isWaste = false) =>
    out.push({ date, description, amount, category, flow, direction, isWaste })

  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const dom = date.getDate()

    // Salary, rent, card payments, transfers and deposits make the demo behave
    // like a real bank statement, not an expenses-only spreadsheet.
    if (dom === 1) {
      push(date, 'ACME CORP PAYROLL DIRECT DEPOSIT', 3200, 'Salary', 'income', 'in')
    }
    if (dom === 2) {
      push(date, 'ONLINE RENT PAYMENT', 1200, 'Housing', 'expense', 'out')
    }
    if (dom === 3) {
      push(date, 'ONLINE PAYMENT TO VISA', 450, 'Credit Card Payment', 'card_payment', 'out')
    }
    if (dom === 15) {
      push(date, 'TRANSFER TO SAVINGS', 300, 'Transfers', 'transfer', 'out')
    }
    if (dom === 20) {
      push(date, 'MOBILE CHECK DEPOSIT', 150, 'Deposits', 'income', 'in')
    }

    const count = Math.random() < 0.55 ? 1 : 0
    for (let c = 0; c < count; c++) {
      const [description, category, isWaste, min, max] = vendors[Math.floor(Math.random() * vendors.length)]
      const amount = Number((min + Math.random() * (max - min)).toFixed(2))
      push(date, description, amount, category, 'expense', 'out', isWaste)
    }
  }

  // Guarantee at least a few groceries in the current month.
  if (!out.some((t) => t.category === 'Groceries')) {
    push(today, 'KROGER SUPERMARKET', 64.2, 'Groceries', 'expense', 'out')
  }
  return out
}

export { flowOf, directionOf }
