// Account helpers: derived balances, upload matching and duplicate detection.

import crypto from 'node:crypto'
import { directionOf, flowOf } from './classify.js'

export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'cash', 'mortgage']

export const WASTE_CATEGORIES = new Set(['Dining Out', 'Subscriptions', 'Fees'])

export function isWasteCategory(category) {
  return WASTE_CATEGORIES.has(String(category || ''))
}

const num = (value) => Number(Number(value || 0).toFixed(2))

export async function listAccounts(prisma, userId) {
  const [accounts, rows] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.transaction.findMany({
      where: { userId },
      select: {
        accountId: true,
        amount: true,
        flow: true,
        direction: true,
        isWaste: true,
      },
    }),
  ])

  const stats = new Map()
  const unassigned = { transaction_count: 0, money_in: 0, money_out: 0, net: 0 }

  for (const t of rows) {
    const amount = Math.abs(Number(t.amount) || 0)
    if (!t.accountId) {
      unassigned.transaction_count += 1
      if (directionOf(t) === 'in') unassigned.money_in += amount
      else unassigned.money_out += amount
      unassigned.net = unassigned.money_in - unassigned.money_out
      continue
    }
    const entry = stats.get(t.accountId) || {
      transaction_count: 0,
      money_in: 0,
      money_out: 0,
      net: 0,
    }
    entry.transaction_count += 1
    if (directionOf(t) === 'in') entry.money_in += amount
    else entry.money_out += amount
    entry.net = entry.money_in - entry.money_out
    stats.set(t.accountId, entry)
  }

  const list = accounts.map((a) => {
    const entry = stats.get(a.id) || {
      transaction_count: 0,
      money_in: 0,
      money_out: 0,
      net: 0,
    }
    const opening = Number(a.openingBalance) || 0
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      last4: a.last4,
      is_demo: a.isDemo,
      opening_balance: num(opening),
      balance: num(opening + entry.net),
      transaction_count: entry.transaction_count,
      money_in: num(entry.money_in),
      money_out: num(entry.money_out),
      net: num(entry.net),
    }
  })

  return {
    accounts: list,
    totals: {
      balance: num(list.reduce((acc, a) => acc + a.balance, 0)),
      money_in: num(list.reduce((acc, a) => acc + a.money_in, 0)),
      money_out: num(list.reduce((acc, a) => acc + a.money_out, 0)),
      net: num(list.reduce((acc, a) => acc + a.net, 0)),
      transaction_count: list.reduce((acc, a) => acc + a.transaction_count, 0),
      account_count: list.length,
    },
    unassigned: {
      transaction_count: unassigned.transaction_count,
      money_in: num(unassigned.money_in),
      money_out: num(unassigned.money_out),
      net: num(unassigned.net),
    },
  }
}

/** Restrict a transaction query to an account scope. */
export function accountScope(accountId) {
  if (!accountId || accountId === 'all') return {}
  if (accountId === 'unassigned') return { accountId: null }
  return { accountId }
}

function nameFromStatement(metadata, statementType) {
  const institution = String(metadata?.institution || '').trim()
  const last4 = lastFour(metadata?.account)
  const base = institution || 'Imported account'
  const name = last4 ? `${base} ••${last4}` : base
  return {
    name,
    institution: institution || 'Imported',
    last4,
    type: statementType === 'credit_card' ? 'credit_card' : 'checking',
  }
}

export function lastFour(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

function looksLikeHeader(line) {
  return /^(date|transaction|description|amount|debit|credit|type|merchant|posted|value)\b/i.test(
    String(line || '').trim()
  )
}

export function statementAccountHint(metadata) {
  const institution = String(metadata?.institution || '').trim()
  if (!institution || looksLikeHeader(institution)) return null
  return institution
}

/** Find an existing account for a statement, or create a sensible one. */
export async function resolveUploadAccount(prisma, userId, { accountId, metadata, statementType }) {
  if (accountId && accountId !== 'auto') {
    const chosen = await prisma.account.findFirst({ where: { id: accountId, userId } })
    if (!chosen) throw new Error('The selected account does not exist')
    return chosen
  }

  const hint = statementAccountHint(metadata)
  const last4 = lastFour(metadata?.account)
  const institution = hint || (last4 ? String(metadata?.institution || '').trim() : '')
  const accounts = await prisma.account.findMany({ where: { userId } })

  const byLast4 = last4 ? accounts.find((a) => a.last4 === last4) : null
  if (byLast4) return byLast4

  if (institution) {
    const byName = accounts.find(
      (a) => a.institution.toLowerCase() === institution.toLowerCase() && (!last4 || !a.last4)
    )
    if (byName) return byName
  }

  if (!institution && !last4) {
    const fallback = accounts.find((a) => a.institution === 'Imported')
    if (fallback) return fallback
  }

  // Check if this is a mortgage statement by looking at institution or description patterns
  const isMortgage = isMortgageStatement(metadata, statementType)
  
  if (isMortgage) {
    // Find existing mortgage account or create one
    const mortgageAccount = accounts.find((a) => a.type === 'mortgage')
    if (mortgageAccount) return mortgageAccount
    
    const shape = nameFromStatement({ institution, account: metadata?.account }, statementType)
    return prisma.account.create({ data: { userId, ...shape, type: 'mortgage', openingBalance: 0 } })
  }

  const shape = nameFromStatement({ institution, account: metadata?.account }, statementType)
  return prisma.account.create({ data: { userId, ...shape, openingBalance: 0 } })
}

/** Check if a statement metadata looks like a mortgage statement */
function isMortgageStatement(metadata, statementType) {
  const institution = String(metadata?.institution || '').trim().toLowerCase()
  const desc = String(metadata?.account || '').trim().toLowerCase()
  
  // Mortgage institutions or descriptions
  const mortgageInstitutions = ['quicken', 'rocket mortgage', 'loan depot', 'mortgage', 'home loan', 'penny mac', 'carrington mortgage']
  
  if (mortgageInstitutions.some(inst => institution.includes(inst))) return true
  
  // Check description for mortgage keywords
  const mortgageKeywords = ['mortgage', 'home loan', 'principal', 'interest', 'piti', 'escrow']
  return mortgageKeywords.some(kw => desc.includes(kw))
}

export function normalizeDescription(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Stable duplicate key for a statement line. The account part is `*` for
 * unassigned rows so a re-upload still matches legacy imports.
 */
export function transactionKey(t, accountId) {
  const day = new Date(t.date).toISOString().slice(0, 10)
  const amount = Number(t.amount).toFixed(2)
  const direction = t.direction || directionOf(t) || 'out'
  return [accountId || '*', day, amount, direction, normalizeDescription(t.description)].join('|')
}

export function fingerprintFor(t, accountId) {
  return crypto.createHash('sha1').update(transactionKey(t, accountId)).digest('hex')
}

/**
 * Split parsed rows into new rows and duplicates of anything already stored.
 * Rows already present on another account are kept separate; matching legacy
 * unassigned rows count as duplicates so re-importing does not double-count.
 */
export async function splitDuplicates(prisma, userId, accountId, rows) {
  if (!rows.length) return { fresh: [], duplicates: 0 }

  const times = rows.map((r) => new Date(r.date).getTime()).filter(Number.isFinite)
  const from = new Date(Math.min(...times) - 86400000)
  const to = new Date(Math.max(...times) + 86400000)

  const where = { userId, date: { gte: from, lte: to } }
  if (accountId) where.OR = [{ accountId }, { accountId: null }]

  const existing = await prisma.transaction.findMany({
    where,
    select: { accountId: true, date: true, amount: true, description: true, direction: true },
  })

  const seen = new Set()
  for (const t of existing) {
    seen.add(transactionKey(t, t.accountId))
    if (!t.accountId) seen.add(transactionKey(t, null))
  }

  const fresh = []
  let duplicates = 0
  for (const row of rows) {
    const keys = [transactionKey(row, accountId)]
    if (accountId) keys.push(transactionKey(row, null))
    if (keys.some((key) => seen.has(key))) {
      duplicates += 1
      continue
    }
    for (const key of keys) seen.add(key)
    fresh.push({ ...row, fingerprint: fingerprintFor(row, accountId) })
  }

  return { fresh, duplicates }
}

export function flowDirection(flow, direction) {
  const normalizedFlow = ['income', 'expense', 'fee', 'card_payment', 'transfer', 'refund', 'mortgage_payment'].includes(flow)
    ? flow
    : 'expense'
  if (direction === 'in' || direction === 'out') {
    return { flow: normalizedFlow, direction }
  }
  if (normalizedFlow === 'income' || normalizedFlow === 'refund') return { flow: normalizedFlow, direction: 'in' }
  if (normalizedFlow === 'transfer' || normalizedFlow === 'card_payment') {
    return { flow: normalizedFlow, direction: 'out' }
  }
  if (normalizedFlow === 'mortgage_payment') {
    return { flow: normalizedFlow, direction: 'out' }
  }
  return { flow: normalizedFlow, direction: 'out' }
}

export { flowOf }
