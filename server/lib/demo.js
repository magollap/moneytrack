// Shared transaction helpers: categorisation, summaries and demo data.

export function categorize(desc) {
  const d = String(desc || '').toLowerCase()
  if (/(doordash|uber eats|grubhub|restaurant|starbucks|cafe|coffee|pizza|sushi|mcdonald|chipotle)/.test(d)) {
    return { category: 'Dining Out', isWaste: true }
  }
  if (/(netflix|spotify|hulu|disney|subscription|prime video|icloud|youtube premium)/.test(d)) {
    return { category: 'Subscriptions', isWaste: true }
  }
  if (/(grocery|supermarket|whole foods|kroger|aldi|costco|trader joe|safeway)/.test(d)) {
    return { category: 'Groceries', isWaste: false }
  }
  if (/(shell|chevron|exxon|gas station|fuel|uber\s*\*?\s*trip|lyft|parking|transit)/.test(d)) {
    return { category: 'Transport', isWaste: false }
  }
  if (/(electric|water bill|utility|internet|comcast|at&t|verizon|phone bill)/.test(d)) {
    return { category: 'Utilities', isWaste: false }
  }
  if (/(rent|mortgage|landlord|hoa)/.test(d)) {
    return { category: 'Housing', isWaste: false }
  }
  if (/(zara|h&m|uniqlo|nike|adidas|clothing|apparel|shoe|nordstrom)/.test(d)) {
    return { category: 'Clothing', isWaste: false }
  }
  if (/(pharmacy|cvs|walgreens|clinic|dentist|gym|fitness|doctor|health)/.test(d)) {
    return { category: 'Health & Fitness', isWaste: false }
  }
  if (/(steam|playstation|xbox|cinema|movie|concert|ticketmaster|entertainment)/.test(d)) {
    return { category: 'Entertainment', isWaste: false }
  }
  if (/(amazon marketplace|target|walmart|etsy|household|misc)/.test(d)) {
    return { category: 'Miscellaneous', isWaste: false }
  }
  if (/(salary|payroll|deposit|refund|transfer to savings)/.test(d)) {
    return { category: 'Income', isWaste: false }
  }
  if (/(fee|late charge|atm fee|overdraft)/.test(d)) {
    return { category: 'Fees', isWaste: true }
  }
  return { category: 'Miscellaneous', isWaste: false }
}

export function buildSummary(rows) {
  const categoryMap = {}
  const dailyMap = {}
  const wasteMerchants = {}
  let totalSpent = 0
  let wasteTotal = 0

  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    totalSpent += amount
    if (t.isWaste) wasteTotal += amount
    if (!categoryMap[t.category]) categoryMap[t.category] = { amount: 0, isWaste: t.isWaste }
    categoryMap[t.category].amount += amount
    if (t.isWaste) categoryMap[t.category].isWaste = true

    const day = new Date(t.date).toISOString().slice(0, 10)
    dailyMap[day] = dailyMap[day] || { amount: 0, waste: 0 }
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

  return {
    period,
    total_spent: Number(totalSpent.toFixed(2)),
    waste_total: Number(wasteTotal.toFixed(2)),
    annual_waste_projection: Number(annualWaste.toFixed(2)),
    potential_investment_value_10yr: Number(futureValue.toFixed(2)),
    transaction_count: rows.length,
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
  for (let daysAgo = days - 1; daysAgo >= 0; daysAgo--) {
    const count = Math.random() < 0.55 ? 1 : 0
    for (let c = 0; c < count; c++) {
      const [description, category, isWaste, min, max] = vendors[Math.floor(Math.random() * vendors.length)]
      const amount = Number((min + Math.random() * (max - min)).toFixed(2))
      const date = new Date(today)
      date.setDate(today.getDate() - daysAgo)
      out.push({ date, description, amount, category, isWaste })
    }
  }

  // Guarantee at least a few groceries and dining rows in the current month.
  if (!out.some((t) => t.category === 'Groceries')) {
    out.push({ date: today, description: 'KROGER SUPERMARKET', amount: 64.2, category: 'Groceries', isWaste: false })
  }
  return out
}
