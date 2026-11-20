// Statement ingestion: CSV/TSV text and PDF bank/credit-card statements.
//
// The parser's job is to preserve meaning, not just find numbers:
//   - detect whether the document is a bank account or a credit card statement
//   - use debit/credit sections and CR/DR markers to establish direction
//   - classify salary, deposits, refunds, transfers, card payments and spending
//   - never silently drop money coming in

import { classifyMovement } from './classify.js'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const SKIP_LINE =
  /((statement|account|billing)\s+(period|number|no)|page\s+\d|(opening|closing|previous|ending|beginning|available|current|new|statement|total)\s+balance|amount due|minimum payment|available credit|credit limit|subtotal|total\s+(purchases|payments|deposits|withdrawals|debits|credits)|payment due|apr\b|due date|card number|rewards points)/i

export function splitCsvLine(line) {
  const out = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && (ch === ',' || ch === '\t')) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  out.push(current)
  return out.map((v) => v.trim())
}

function parseAmount(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  const negative = /^\(.*\)$/.test(text) || /-\s*$/.test(text)
  const value = Number(text.replace(/[^0-9.-]/g, '').replace(/,/g, ''))
  if (!Number.isFinite(value) || value === 0) return null
  return negative ? -Math.abs(value) : value
}

function headerIndex(header, patterns) {
  for (const pattern of patterns) {
    const idx = header.findIndex((h) => pattern.test(h))
    if (idx !== -1) return idx
  }
  return -1
}

export function parseCsv(text, { statementType = 'bank' } = {}) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (!lines.length) return []

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = header.some((h) =>
    /date|description|merchant|details|amount|debit|credit|withdrawal|deposit|balance/i.test(h)
  )
  const start = hasHeader ? 1 : 0

  const dateIdx = hasHeader
    ? headerIndex(header, [/^date$/, /transaction\s*date/, /posted\s*date/, /^date/i])
    : 0
  const descIdx = hasHeader
    ? headerIndex(header, [/^description$/, /^merchant$/, /details|memo|payee|narrative/, /description/])
    : 1
  const amountIdx = hasHeader
    ? headerIndex(header, [/^amount$/, /transaction\s*amount/, /^value$/, /amount/])
    : 2
  const debitIdx = hasHeader
    ? headerIndex(header, [/^debit$/, /withdrawal|money\s*out|charges?/])
    : -1
  const creditIdx = hasHeader
    ? headerIndex(header, [/^credit$/, /deposit|money\s*in|payments?/])
    : -1
  const typeIdx = hasHeader
    ? headerIndex(header, [/^type$/, /debit.?credit/, /transaction\s*type/])
    : -1

  const rows = []

  for (let i = start; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i])
    if (parts.length < 2) continue

    const date = parseDate(parts[dateIdx] ?? parts[0])
    if (!date) continue

    const description = String(parts[descIdx] ?? parts[1] ?? 'Unknown').trim()
    if (!description) continue

    let amount = null
    let isCredit = false
    let isDebit = false

    if (debitIdx !== -1 || creditIdx !== -1) {
      const debit = debitIdx !== -1 ? parseAmount(parts[debitIdx]) : null
      const credit = creditIdx !== -1 ? parseAmount(parts[creditIdx]) : null
      if (debit != null) {
        amount = Math.abs(debit)
        isDebit = true
      } else if (credit != null) {
        amount = Math.abs(credit)
        isCredit = true
      }
    }

    if (amount == null && amountIdx !== -1) {
      const parsed = parseAmount(parts[amountIdx])
      if (parsed != null) {
        amount = Math.abs(parsed)
        if (parsed < 0) {
          if (statementType === 'credit_card') isCredit = true
          else isDebit = true
        }
      }
    }

    if (amount == null) continue

    if (typeIdx !== -1) {
      const type = String(parts[typeIdx] || '').toLowerCase()
      if (/debit|withdrawal|charge|purchase/.test(type)) isDebit = true
      if (/credit|deposit|refund/.test(type)) isCredit = true
    }

    if (!isCredit && !isDebit) {
      if (/(salary|payroll|direct\s*dep|deposit|refund|reversal|interest\s*(paid|earned)|dividend)/i.test(description)) {
        isCredit = true
      } else if (statementType === 'credit_card' && /(payment\s*(thank|received)|refund|reversal)/i.test(description)) {
        isCredit = true
      }
    }

    const classified = classifyMovement(description, { isCredit, isDebit, statementType })

    rows.push({
      date,
      description,
      amount,
      category: classified.category,
      flow: classified.flow,
      direction: classified.direction,
      isWaste: classified.isWaste,
    })
  }

  return rows
}

export async function extractPdfText(buffer) {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return { text: result.text || '', pages: result.pages?.length || result.total || null }
  } finally {
    await parser.destroy().catch(() => {})
  }
}

function parseDate(raw) {
  const value = String(raw).trim().replace(/(\d)(st|nd|rd|th)\b/i, '$1')
  const currentYear = new Date().getFullYear()

  let m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return buildDate(Number(m[1]), Number(m[2]), Number(m[3]))

  m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (m) return buildDate(normalizeYear(Number(m[3])), Number(m[1]), Number(m[2]))

  m = value.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    const year = normalizeYear(Number(m[3]))
    return a > 12 ? buildDate(year, b, a) : buildDate(year, a, b)
  }

  m = value.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{2,4}))?/)
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1
    if (month) return buildDate(m[3] ? normalizeYear(Number(m[3])) : currentYear, month, Number(m[2]))
  }

  m = value.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{2,4})/)
  if (m) {
    const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1
    if (month) return buildDate(normalizeYear(Number(m[3])), month, Number(m[1]))
  }

  return null
}

function normalizeYear(year) {
  if (year < 100) return year > 70 ? 1900 + year : 2000 + year
  return year
}

function buildDate(year, month, day) {
  if (!year || !month || !day) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  if (year < 2000 || year > new Date().getFullYear() + 1) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

const DATE_AT_START =
  /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s*\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4})\s+/

const MONEY = /(-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\$?\s?\d+\.\d{2})(\s*(?:CR|DR))?/gi

export function detectStatementType(text) {
  const t = String(text || '').toLowerCase()
  const count = (patterns) => patterns.reduce((acc, p) => acc + (t.match(p) || []).length, 0)
  const card = count([
    /credit card/g,
    /minimum payment/g,
    /available credit/g,
    /credit limit/g,
    /billing period/g,
    /payment due/g,
    /card number/g,
    /purchases/g,
    /previous balance/g,
  ])
  const bank = count([
    /checking/g,
    /savings/g,
    /deposits and/g,
    /withdrawals and/g,
    /beginning balance/g,
    /ending balance/g,
    /statement period/g,
    /money market/g,
  ])
  if (card >= 2 && card >= bank) return 'credit_card'
  if (bank > 0) return 'bank'
  return 'statement'
}

function sectionForLine(line, statementType) {
  if (DATE_AT_START.test(line)) return null
  const l = line.toLowerCase()
  if (/(total|subtotal|balance)/.test(l)) return null
  if (/payments?\s*(and|&)\s*credits?/.test(l)) {
    return statementType === 'credit_card' ? 'in' : 'out'
  }
  if (/(deposits?|credits?|additions?|money\s*in)/.test(l)) return 'in'
  if (/(withdrawals?|debits?|purchases?|checks?|money\s*out)/.test(l)) return 'out'
  if (/\bpayments?\b/.test(l)) return statementType === 'credit_card' ? 'in' : 'out'
  return null
}

function cleanDescription(rest, tokens) {
  let description = rest
  for (const token of tokens) description = description.replace(token[0], ' ')
  return description
    .replace(/\b(CR|DR)\b/gi, ' ')
    .replace(/[\s|*]+/g, ' ')
    .replace(/^[-–—:;,.]+|[-–—:;,.]+$/g, '')
    .trim()
}

export function parseStatementText(text, options = {}) {
  const statementType = options.statementType || detectStatementType(text)
  const rows = []
  let section = null

  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (const line of lines) {
    const dateMatch = line.match(DATE_AT_START)
    if (!dateMatch) {
      const next = sectionForLine(line, statementType)
      if (next) section = next
      continue
    }
    if (SKIP_LINE.test(line)) continue

    const date = parseDate(dateMatch[1])
    if (!date) continue

    const rest = line.slice(dateMatch[0].length)
    const tokens = [...rest.matchAll(MONEY)]
    if (!tokens.length) continue

    const token = tokens[0]
    const amountText = token[1]
    const marker = token[2] || (rest.match(/\b(CR|DR)\b/i)?.[0] ?? '')
    const amount = Number(amountText.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(amount) || amount === 0) continue

    let isCredit = /CR/i.test(marker)
    let isDebit = /DR/i.test(marker)
    const negative = amountText.trim().startsWith('-')
    const trailingMinus = /-\s*$/.test(rest.trim()) && !amountText.includes('-')

    if (!isCredit && !isDebit) {
      if (section === 'in') isCredit = true
      else if (section === 'out') isDebit = true
      else if (negative || trailingMinus) {
        // On a credit-card statement a negative amount is a payment or refund,
        // so it means money in rather than money out.
        if (statementType === 'credit_card') isCredit = true
        else isDebit = true
      }
    }

    if (!isCredit && !isDebit) {
      if (/(salary|payroll|direct\s*dep|deposit|refund|reversal|interest\s*(paid|earned)|dividend)/i.test(rest)) {
        isCredit = true
      } else if (statementType === 'credit_card' && /(payment\s*(thank|received)|refund|reversal)/i.test(rest)) {
        isCredit = true
      }
    }

    const description = cleanDescription(rest, tokens)
    if (description.length < 3) continue
    if (!/[A-Za-z]{2,}/.test(description)) continue
    if (SKIP_LINE.test(description)) continue

    const classified = classifyMovement(description, {
      isCredit,
      isDebit,
      statementType,
      signedAmount: amount,
    })

    rows.push({
      date,
      description: description.slice(0, 120),
      amount: Math.abs(amount),
      category: classified.category,
      flow: classified.flow,
      direction: classified.direction,
      isWaste: classified.isWaste,
    })
  }

  return rows
}

function extractMeta(text, statementType, filename) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const institutionLine = lines.find(
    (l) =>
      l.length < 60 &&
      /(bank|credit union|card services|financial|capital one|chase|amex|american express|discover|visa|citi|wells fargo)/i.test(l)
  )
  const first = lines[0] || ''
  const firstLooksLikeHeader = /^(date|transaction|description|amount|debit|credit|type|merchant|posted|value)\b/i.test(first)

  const institution =
    institutionLine ||
    (!firstLooksLikeHeader && first.length < 60 && !/[,\t]/.test(first) ? first : '') ||
    ''

  const periodMatch = String(text || '').match(
    /(?:statement|billing)\s*period[:\s]+([^\n]{4,60})/i
  )
  const accountLine = lines.find((l) => /(account|card)\s*(number|no\.?|#)/i.test(l))
  const accountMatch =
    accountLine?.match(/([x*•\d-]{4,}(?:\s+[x*•\d-]{4,})*)\s*$/) ||
    String(text || '').match(
      /(?:account|card)\s*(?:number|no\.?|#)?[:\s*]*(?:ending\s*(?:in\s*)?)?([x*•\d-]{4,24})/i
    )

  return {
    institution: institution.slice(0, 60) || null,
    period: periodMatch ? periodMatch[1].trim() : null,
    account: accountMatch ? accountMatch[1].trim() : null,
    statement_type: statementType,
  }
}

export async function parseStatementFile({ buffer, filename = '', mimetype = '' }) {
  const isPdf =
    mimetype === 'application/pdf' ||
    /\.pdf$/i.test(filename) ||
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'

  if (isPdf) {
    const { text, pages } = await extractPdfText(buffer)
    if (!text || text.trim().length < 20) {
      throw new Error(
        'No selectable text found in this PDF. It may be a scan — export CSV from your bank instead.'
      )
    }
    const statementType = detectStatementType(text)
    const rows = parseStatementText(text, { statementType })
    return {
      source: 'pdf',
      pages,
      rows,
      statementType,
      ...extractMeta(text, statementType, filename),
      textLength: text.length,
    }
  }

  const text = buffer.toString('utf-8')
  const statementType = detectStatementType(text)
  const rows = parseCsv(text, { statementType })
  return {
    source: 'text',
    pages: null,
    rows,
    statementType,
    ...extractMeta(text, statementType, filename),
    textLength: text.length,
  }
}
