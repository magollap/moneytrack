// Generates a two-page sample bank/credit-card statement PDF for import testing.
// Usage: node scripts/make_sample_pdf.js [outputPath]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '..', 'samples', 'sample-bank-statement.pdf')

const PAGES = [
  [
    ['Oct 03, 2026', 'WHOLE FOODS MARKET #10423', '86.42'],
    ['Oct 04, 2026', 'DOORDASH*SUSHI PALACE', '38.75'],
    ['Oct 05, 2026', 'NETFLIX.COM MONTHLY', '15.99'],
    ['Oct 07, 2026', 'SHELL GAS STATION', '54.10'],
    ['Oct 08, 2026', 'STARBUCKS #4821', '6.85'],
    ['Oct 11, 2026', 'KROGER SUPERMARKET', '112.38'],
    ['Oct 13, 2026', 'PAYMENT THANK YOU', '-250.00'],
    ['Oct 15, 2026', 'ZARA CLOTHING', '89.90'],
    ['Oct 18, 2026', 'CVS PHARMACY', '23.44'],
    ['Oct 21, 2026', 'UBER*TRIP', '18.20'],
  ],
  [
    ['Oct 22, 2026', 'SPOTIFY PREMIUM', '10.99'],
    ['Oct 23, 2026', 'TARGET HOUSEHOLD', '64.15'],
    ['Oct 24, 2026', 'PLANET FITNESS', '24.99'],
    ['Oct 26, 2026', 'ELECTRIC UTILITY BILL', '91.66'],
    ['Oct 27, 2026', 'CHIPOTLE MEXICAN GRILL', '14.75'],
    ['Oct 28, 2026', 'AMAZON MARKETPLACE', '47.30'],
    ['Oct 29, 2026', 'NIKE STORE', '129.99'],
    ['Oct 30, 2026', 'ATM FEE', '3.50'],
    ['Oct 31, 2026', 'DISNEY+ BUNDLE', '13.99'],
  ],
]

const pad = (value, width) => String(value).padEnd(width, ' ')

function drawHeader(doc, page) {
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('Northwind Bank', 50, 42)
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
  doc.text('Credit Card Statement', 50, 64)
  doc.text('Account **** 4821', 50, 78)
  doc.text('Billing period: Oct 1 – Oct 31, 2026', 50, 92)
  doc.text(`Page ${page} of 2`, 460, 42, { width: 90, align: 'right' })
  doc.moveTo(50, 112).lineTo(545, 112).strokeColor('#d1d5db').stroke()
}

function drawTableHead(doc, y) {
  doc.font('Courier-Bold').fontSize(9).fillColor('#111827')
  doc.text(pad('Date', 16) + pad('Description', 34) + 'Amount', 50, y)
  doc.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor('#e5e7eb').stroke()
}

function drawRows(doc, rows, startY) {
  doc.font('Courier').fontSize(9).fillColor('#1f2937')
  let y = startY
  for (const [date, description, amount] of rows) {
    const line = pad(date, 16) + pad(description, 34) + amount.padStart(10, ' ')
    doc.text(line, 50, y)
    y += 17
  }
  return y
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })

const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
const stream = fs.createWriteStream(outPath)
doc.pipe(stream)

PAGES.forEach((rows, index) => {
  if (index > 0) doc.addPage()
  drawHeader(doc, index + 1)
  drawTableHead(doc, 128)
  const endY = drawRows(doc, rows, 152)

  if (index === PAGES.length - 1) {
    doc.moveTo(50, endY + 6).lineTo(545, endY + 6).strokeColor('#d1d5db').stroke()
    doc.font('Courier-Bold').fontSize(9).fillColor('#111827')
    doc.text(pad('', 50) + 'Total purchases'.padEnd(30) + '763.34'.padStart(10, ' '), 50, endY + 18)
    doc.font('Courier').fontSize(8).fillColor('#6b7280')
    doc.text('Closing balance 763.34 · Minimum payment due 35.00 · Due date Nov 24, 2026', 50, endY + 38)
  } else {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280')
    doc.text('Continued on next page', 50, endY + 12)
  }
})

doc.end()

await new Promise((resolve, reject) => {
  stream.on('finish', resolve)
  stream.on('error', reject)
})

console.log(`Wrote ${outPath}`)
