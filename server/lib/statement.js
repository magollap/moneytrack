// Statement ingestion: CSV/TSV text and PDF bank/credit-card statements.

import { categorize } from './demo.js'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const SKIP_LINE = /(statement|account\s*(number|no)|page\s+\d|balance|amount due|minimum payment|available credit|credit limit|opening|closing|subtotal|total\s+(purchases|payments)|previous balance|payment received|interest charge|apr|due date|card number|billing period)/i

const CREDIT_WORDS = /(payment|refund|deposit|credit|reversal|adjustment|transfer in|direct dep)/i

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

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const start = /date/i.test(lines[0]) ? 1 : 0
  const rows = []

  for (let i = start; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i])
    if (parts.length < 3) continue
    const [dateRaw, description, amountRaw] = parts
    const amount = Number(String(amountRaw).replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(amount) || amount === 0) continue

    const date = parseDate(dateRaw)
    if (!date) continue

    const { category, isWaste } = categorize(description)
    if (category === 'Income') continue

    rows.push({
      date,
      description: description.replace(/^["']|["']$/g, '').trim() || 'Unknown',
      amount: Math.abs(amount),
      category,
      isWaste,
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

const DATE_AT_START = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s*\d{2,4})?|\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4})\s+/

const MONEY = /(-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\$?\s?\d+\.\d{2})(\s*(?:CR|DR))?/gi

export function parseStatementText(text) {
  const rows = []
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  for (const line of lines) {
    const dateMatch = line.match(DATE_AT_START)
    if (!dateMatch) continue
    if (SKIP_LINE.test(line)) continue

    const date = parseDate(dateMatch[1])
    if (!date) continue

    const rest = line.slice(dateMatch[0].length)
    const tokens = [...rest.matchAll(MONEY)]
    if (!tokens.length) continue

    // Statements often append a running balance as a second amount.
    const token = tokens[0]
    const amountText = token[1]
    const isCredit =
      Boolean(token[2] && /CR/i.test(token[2])) ||
      amountText.trim().startsWith('-') ||
      CREDIT_WORDS.test(rest)

    const amount = Number(amountText.replace(/[^0-9.-]/g, ''))
    if (!Number.isFinite(amount) || amount === 0) continue
    if (isCredit) continue

    let description = rest
    for (const t of tokens) description = description.replace(t[0], ' ')
    description = description
      .replace(/\b(CR|DR)\b/gi, ' ')
      .replace(/[\s|*]+/g, ' ')
      .replace(/^[-–—:;,.]+|[-–—:;,.]+$/g, '')
      .trim()

    if (description.length < 3) continue
    if (!/[A-Za-z]{2,}/.test(description)) continue
    if (SKIP_LINE.test(description)) continue

    const { category, isWaste } = categorize(description)
    if (category === 'Income') continue

    rows.push({
      date,
      description: description.slice(0, 120),
      amount: Math.abs(amount),
      category,
      isWaste,
    })
  }

  return rows
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
    return { source: 'pdf', pages, rows: parseStatementText(text), textLength: text.length }
  }

  return { source: 'text', pages: null, rows: parseCsv(buffer.toString('utf-8')), textLength: buffer.length }
}
