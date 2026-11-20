// Generates sample bank and credit-card statement PDFs for import testing.
//
// Usage:
//   node scripts/make_sample_pdf.js            # both samples
//   node scripts/make_sample_pdf.js out.pdf     # the bank sample only
//
// The bank fixture uses "Deposits and Credits" / "Withdrawals and Debits"
// sections so the parser has to understand direction instead of assuming every
// row is spending. The card fixture mixes purchases, a payment and a refund.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const samplesDir = path.join(__dirname, '..', 'samples')

const pad = (value, width) => String(value).padEnd(width, ' ')

const BANK = {
  file: 'sample-bank-statement.pdf',
  institution: 'Northwind Bank',
  title: 'Checking Account Statement',
  account: 'Account **** 4821',
  period: 'Statement period: Oct 1 – Oct 31, 2026',
  sections: [
    {
      heading: 'Deposits and Credits',
      rows: [
        ['Oct 01, 2026', 'ACME CORP PAYROLL DIRECT DEPOSIT', '3,200.00'],
        ['Oct 06, 2026', 'MOBILE CHECK DEPOSIT', '150.00'],
        ['Oct 09, 2026', 'ZELLE TRANSFER FROM SAVINGS', '500.00'],
        ['Oct 17, 2026', 'INTEREST PAID', '4.18'],
        ['Oct 24, 2026', 'REFUND FROM AMAZON MARKETPLACE', '47.30'],
      ],
    },
    {
      heading: 'Withdrawals and Debits',
      rows: [
        ['Oct 01, 2026', 'ONLINE RENT PAYMENT', '1,200.00'],
        ['Oct 02, 2026', 'ONLINE PAYMENT TO VISA', '450.00'],
        ['Oct 03, 2026', 'WHOLE FOODS MARKET #10423', '86.42'],
        ['Oct 04, 2026', 'DOORDASH*SUSHI PALACE', '38.75'],
        ['Oct 05, 2026', 'NETFLIX.COM MONTHLY', '15.99'],
        ['Oct 07, 2026', 'SHELL GAS STATION', '54.10'],
        ['Oct 08, 2026', 'STARBUCKS #4821', '6.85'],
        ['Oct 11, 2026', 'KROGER SUPERMARKET', '112.38'],
        ['Oct 13, 2026', 'ELECTRIC UTILITY BILL', '91.66'],
        ['Oct 14, 2026', 'COMCAST INTERNET', '79.99'],
        ['Oct 15, 2026', 'ZARA CLOTHING', '89.90'],
        ['Oct 18, 2026', 'CVS PHARMACY', '23.44'],
        ['Oct 21, 2026', 'UBER*TRIP', '18.20'],
        ['Oct 23, 2026', 'TARGET HOUSEHOLD', '64.15'],
        ['Oct 24, 2026', 'PLANET FITNESS', '24.99'],
        ['Oct 27, 2026', 'CHIPOTLE MEXICAN GRILL', '14.75'],
        ['Oct 28, 2026', 'TRANSFER TO SAVINGS', '300.00'],
        ['Oct 30, 2026', 'ATM FEE', '3.50'],
      ],
    },
  ],
  footer: [
    'Beginning balance 3,842.10 · Ending balance 5,102.63',
    'Deposits 3,901.48 · Withdrawals 2,640.95',
  ],
}

const CARD = {
  file: 'sample-credit-card-statement.pdf',
  institution: 'Northwind Card Services',
  title: 'Credit Card Statement',
  account: 'Card number **** 7742',
  period: 'Billing period: Oct 1 – Oct 31, 2026',
  sections: [
    {
      heading: 'Purchases',
      rows: [
        ['Oct 02, 2026', 'AMAZON MARKETPLACE', '62.18'],
        ['Oct 03, 2026', 'WHOLE FOODS MARKET', '94.63'],
        ['Oct 05, 2026', 'UBER EATS LATE NIGHT', '31.40'],
        ['Oct 07, 2026', 'SHELL GAS STATION', '48.22'],
        ['Oct 10, 2026', 'APPLE.COM/BILL ICLOUD', '2.99'],
        ['Oct 12, 2026', 'DELTA AIR LINES', '318.40'],
        ['Oct 15, 2026', 'TRADER JOES', '76.15'],
        ['Oct 18, 2026', 'BEST BUY ELECTRONICS', '149.99'],
        ['Oct 21, 2026', 'STARBUCKS #2210', '5.75'],
        ['Oct 24, 2026', 'NIKE STORE', '88.00'],
        ['Oct 27, 2026', 'ELECTRIC UTILITY BILL', '91.66'],
      ],
    },
    {
      heading: 'Payments and Credits',
      rows: [
        ['Oct 16, 2026', 'PAYMENT THANK YOU', '-500.00'],
        ['Oct 22, 2026', 'REFUND FROM BEST BUY', '-149.99'],
      ],
    },
  ],
  footer: [
    'Previous balance 1,124.35 · Payments and credits 649.99',
    'Purchases 969.37 · New balance 1,443.73',
    'Minimum payment due 35.00 · Payment due date Nov 24, 2026',
  ],
}

function drawHeader(doc, fixture, page, totalPages) {
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(fixture.institution, 50, 42)
  doc.font('Helvetica').fontSize(9).fillColor('#4b5563')
  doc.text(fixture.title, 50, 64)
  doc.text(fixture.account, 50, 78)
  doc.text(fixture.period, 50, 92)
  doc.text(`Page ${page} of ${totalPages}`, 460, 42, { width: 90, align: 'right' })
  doc.moveTo(50, 112).lineTo(545, 112).strokeColor('#d1d5db').stroke()
}

function drawTableHead(doc, y) {
  doc.font('Courier-Bold').fontSize(9).fillColor('#111827')
  doc.text(pad('Date', 16) + pad('Description', 40) + 'Amount', 50, y)
  doc.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor('#e5e7eb').stroke()
}

function drawRows(doc, rows, startY) {
  doc.font('Courier').fontSize(9).fillColor('#1f2937')
  let y = startY
  for (const [date, description, amount] of rows) {
    const line = pad(date, 16) + pad(description, 40) + amount.padStart(12, ' ')
    doc.text(line, 50, y)
    y += 17
  }
  return y
}

// Split a long section across pages so the fixture stays readable.
function paginate(fixture) {
  const pages = []
  let current = []
  let used = 0
  const perPage = 22

  for (const section of fixture.sections) {
    if (used + section.rows.length + 3 > perPage && current.length) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(section)
    used += section.rows.length + 3
  }
  if (current.length) pages.push(current)
  return pages
}

function writePdf(fixture, outPath) {
  const pages = paginate(fixture)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })

  const doc = new PDFDocument({ size: 'LETTER', margin: 50, autoFirstPage: true })
  const stream = fs.createWriteStream(outPath)
  doc.pipe(stream)

  pages.forEach((sections, index) => {
    if (index > 0) doc.addPage()
    drawHeader(doc, fixture, index + 1, pages.length)

    let y = 128
    for (const section of sections) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
      doc.text(section.heading, 50, y)
      y += 16
      drawTableHead(doc, y)
      y = drawRows(doc, section.rows, y + 20) + 10
    }

    if (index === pages.length - 1) {
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#d1d5db').stroke()
      doc.font('Courier').fontSize(8).fillColor('#6b7280')
      fixture.footer.forEach((line, i) => {
        doc.text(line, 50, y + 12 + i * 12)
      })
    } else {
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#6b7280')
      doc.text('Continued on next page', 50, y + 2)
    }
  })

  doc.end()

  return new Promise((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', reject)
  })
}

// A single explicit path keeps the old `npm run sample:pdf -- out.pdf` behaviour.
if (process.argv[2]) {
  const outPath = path.resolve(process.argv[2])
  await writePdf(BANK, outPath)
  console.log(`Wrote ${outPath}`)
} else {
  const bankPath = path.join(samplesDir, BANK.file)
  const cardPath = path.join(samplesDir, CARD.file)
  await writePdf(BANK, bankPath)
  await writePdf(CARD, cardPath)
  console.log(`Wrote ${bankPath}`)
  console.log(`Wrote ${cardPath}`)
}
