// Statement intelligence: understand what each bank/credit-card line actually is.
//
// Every imported row keeps a positive `amount` plus:
//   flow      income | expense | fee | card_payment | transfer | refund
//   direction in | out
// That lets the rest of the app separate spending from deposits instead of
// treating every line as an expense.

export const FLOW_LABELS = {
  income: 'Income & deposits',
  expense: 'Spending',
  fee: 'Fees & charges',
  card_payment: 'Credit card payments',
  transfer: 'Transfers',
  refund: 'Refunds & reversals',
  mortgage_payment: 'Mortgage payments',
}

export function categorize(desc) {
  const d = String(desc || '').toLowerCase()
  if (/(doordash|uber eats|grubhub|restaurant|starbucks|cafe|coffee|pizza|sushi|mcdonald|chipotle|bakery|diner)/.test(d)) {
    return { category: 'Dining Out', isWaste: true }
  }
  if (/(netflix|spotify|hulu|disney|subscription|prime video|icloud|youtube premium|apple\.com\/bill|google play)/.test(d)) {
    return { category: 'Subscriptions', isWaste: true }
  }
  if (/(grocery|supermarket|whole foods|kroger|aldi|costco|trader joe|safeway|publix|wegmans)/.test(d)) {
    return { category: 'Groceries', isWaste: false }
  }
  if (/(shell|chevron|exxon|gas station|fuel|uber\s*\*?\s*trip|lyft|parking|transit|metro|toll)/.test(d)) {
    return { category: 'Transport', isWaste: false }
  }
  if (/(electric|water bill|utility|internet|comcast|at&t|verizon|phone bill|spectrum|xfinity|gas bill|sewer|trash)/.test(d)) {
    return { category: 'Utilities', isWaste: false }
  }
  if (/(rent|mortgage|landlord|hoa|property management)/.test(d)) {
    return { category: 'Housing', isWaste: false }
  }
  if (/(zara|h&m|uniqlo|nike|adidas|clothing|apparel|shoe|nordstrom|gap|old navy)/.test(d)) {
    return { category: 'Clothing', isWaste: false }
  }
  if (/(pharmacy|cvs|walgreens|clinic|dentist|gym|fitness|doctor|health|hospital|medical)/.test(d)) {
    return { category: 'Health & Fitness', isWaste: false }
  }
  if (/(steam|playstation|xbox|cinema|movie|concert|ticketmaster|entertainment|theater|theatre)/.test(d)) {
    return { category: 'Entertainment', isWaste: false }
  }
  if (/(amazon marketplace|target|walmart|etsy|household|misc|best buy|home depot)/.test(d)) {
    return { category: 'Miscellaneous', isWaste: false }
  }
  if (/(fee|late charge|atm fee|overdraft|service charge|annual fee|interest charge|finance charge)/.test(d)) {
    return { category: 'Fees', isWaste: true }
  }
  return { category: 'Miscellaneous', isWaste: false }
}

const CARD_PAYMENT =
  /(payment\s*thank|thank\s*you.*payment|card\s*payment|payment\s*(to|for)\s*(the\s*)?(visa|mastercard|amex|discover|credit\s*card|card)|(visa|mastercard|amex|discover|credit\s*card)\s*(payment|pmt)|autopay\s*(payment|pmt|card))/i
const SALARY =
  /(salary|payroll|direct\s*dep|dir\s*dep|wages|paycheck|employer|adp\b|gusto|workday|payroll\s*deposit)/i
const DEPOSIT =
  /((mobile|check|cash|atm|remote|branch|ach)\s*deposit|\bdeposit\b|interest\s*(paid|earned)|dividend|credit\s*interest|int\s*pymt)/i
const REFUND = /(refund|returned|reversal|chargeback|credit\s*voucher|price\s*adjust)/i
const TRANSFER =
  /((online|wire|bank|internal|external)\s*transfer|\bxfer\b|zelle|venmo|cash\s*app|paypal\s*transfer|\bfrom\s*(my\s*)?(savings|checking)\b|\bto\s*(my\s*)?(savings|checking)\b)/i
const FEE =
  /(\bfee\b|service\s*charge|atm\s*fee|overdraft|late\s*(fee|charge)|annual\s*fee|interest\s*charge|finance\s*charge|foreign\s*transaction)/i
// Mortgage / home-loan payments. These are not spending: they reduce a debt
// tracked on its own mortgage account, so they get their own flow.
const MORTGAGE =
  /(mortgage|mort\.?\s*payment|home\s*loan|loan\s*payment|principal\s*and\s*interest|escrow|piti|mortgage\s*autopause|mortgage\s*autopay)/i

function transferDirection(desc, isCredit, isDebit) {
  if (isCredit) return 'in'
  if (isDebit) return 'out'
  if (/\b(from|received|in|deposit)\b/i.test(desc)) return 'in'
  if (/\b(to|sent|out|payment)\b/i.test(desc)) return 'out'
  return 'out'
}

/**
 * Classify a statement movement.
 *
 * @param {string} description raw bank/card description
 * @param {object} opts
 * @param {boolean} opts.isCredit explicit credit/deposit marker
 * @param {boolean} opts.isDebit explicit debit/withdrawal marker
 * @param {string} opts.statementType 'bank' | 'credit_card' | 'statement'
 * @param {number|null} opts.signedAmount negative when the statement shows a debit
 */
export function classifyMovement(description, opts = {}) {
  const desc = String(description || '')
  const d = desc.toLowerCase()
  const { isCredit = false, isDebit = false, statementType = 'bank' } = opts

  if (CARD_PAYMENT.test(d)) {
    return {
      category: 'Credit Card Payment',
      flow: 'card_payment',
      direction: isCredit ? 'in' : statementType === 'credit_card' ? 'in' : 'out',
      isWaste: false,
    }
  }

  if (MORTGAGE.test(d)) {
    return {
      category: 'Mortgage',
      flow: 'mortgage_payment',
      direction: 'out',
      isWaste: false,
    }
  }

  if (SALARY.test(d)) {
    return {
      category: 'Salary',
      flow: 'income',
      direction: isDebit ? 'out' : 'in',
      isWaste: false,
    }
  }

  if (REFUND.test(d)) {
    return {
      category: 'Refunds',
      flow: 'refund',
      direction: isDebit ? 'out' : 'in',
      isWaste: false,
    }
  }

  if (FEE.test(d)) {
    return { category: 'Fees', flow: 'fee', direction: 'out', isWaste: true }
  }

  if (DEPOSIT.test(d)) {
    if (isDebit) {
      const spend = categorize(desc)
      return { ...spend, flow: 'expense', direction: 'out' }
    }
    return {
      category: 'Deposits',
      flow: 'income',
      direction: 'in',
      isWaste: false,
    }
  }

  if (TRANSFER.test(d)) {
    return {
      category: 'Transfers',
      flow: 'transfer',
      direction: transferDirection(d, isCredit, isDebit),
      isWaste: false,
    }
  }

  const spend = categorize(desc)
  if (spend.category === 'Income') {
    return { category: 'Deposits', flow: 'income', direction: 'in', isWaste: false }
  }

  // Unmatched credits still matter: they are deposits at a bank and refunds on
  // a credit card. Never silently drop them.
  if (isCredit && !isDebit) {
    return statementType === 'credit_card'
      ? { category: 'Refunds', flow: 'refund', direction: 'in', isWaste: false }
      : { category: 'Deposits', flow: 'income', direction: 'in', isWaste: false }
  }

  return { ...spend, flow: 'expense', direction: 'out' }
}

export function flowOf(t) {
  if (t.flow) return t.flow
  if (t.category === 'Income' || t.category === 'Salary' || t.category === 'Deposits') return 'income'
  if (t.category === 'Refunds') return 'refund'
  if (t.category === 'Transfers') return 'transfer'
  if (t.category === 'Credit Card Payment') return 'card_payment'
  if (t.category === 'Fees') return 'fee'
  if (t.category === 'Mortgage') return 'mortgage_payment'
  return 'expense'
}

export function directionOf(t) {
  if (t.direction === 'in' || t.direction === 'out') return t.direction
  const flow = flowOf(t)
  if (flow === 'income' || flow === 'refund') return 'in'
  return 'out'
}

export function isSpending(t) {
  const flow = flowOf(t)
  return (flow === 'expense' || flow === 'fee') && directionOf(t) === 'out'
}

export function isIncome(t) {
  const flow = flowOf(t)
  return (flow === 'income' || flow === 'refund') && directionOf(t) === 'in'
}

export function summarizeFlows(rows) {
  const groups = new Map()
  const flowTotals = new Map()
  let moneyIn = 0
  let moneyOut = 0

  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    if (!amount) continue
    const flow = flowOf(t)
    const direction = directionOf(t)
    if (direction === 'in') moneyIn += amount
    else moneyOut += amount

    const key = `${direction}:${t.category}`
    const group = groups.get(key) || {
      category: t.category,
      flow,
      direction,
      amount: 0,
      count: 0,
    }
    group.amount += amount
    group.count += 1
    groups.set(key, group)

    const flowKey = `${direction}:${flow}`
    const total = flowTotals.get(flowKey) || {
      flow,
      direction,
      label: FLOW_LABELS[flow] || flow,
      amount: 0,
      count: 0,
    }
    total.amount += amount
    total.count += 1
    flowTotals.set(flowKey, total)
  }

  const byCategory = [...groups.values()]
    .map((g) => ({ ...g, amount: Number(g.amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)

  const byFlow = [...flowTotals.values()]
    .map((g) => ({ ...g, amount: Number(g.amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)

  const sum = (direction, flow) =>
    byFlow
      .filter((g) => g.direction === direction && g.flow === flow)
      .reduce((acc, g) => acc + g.amount, 0)

  return {
    money_in: Number(moneyIn.toFixed(2)),
    money_out: Number(moneyOut.toFixed(2)),
    net: Number((moneyIn - moneyOut).toFixed(2)),
    income: Number(sum('in', 'income').toFixed(2)),
    spending: Number(sum('out', 'expense').toFixed(2)),
    fees: Number(sum('out', 'fee').toFixed(2)),
    card_payments_in: Number(sum('in', 'card_payment').toFixed(2)),
    card_payments_out: Number(sum('out', 'card_payment').toFixed(2)),
    transfers_in: Number(sum('in', 'transfer').toFixed(2)),
    transfers_out: Number(sum('out', 'transfer').toFixed(2)),
    refunds: Number(sum('in', 'refund').toFixed(2)),
    flow_totals: byFlow,
    groups: byCategory,
  }
}
