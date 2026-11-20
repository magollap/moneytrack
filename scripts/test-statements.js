// Statement-parser regression tests.
//
// Run with `npm test`. Generates the sample PDFs if they are missing, then
// checks that bank and credit-card statements are classified correctly and
// that CSV variants preserve money in vs money out.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv, parseStatementFile } from '../server/lib/statement.js'
import { summarizeFlows } from '../server/lib/classify.js'
import { fingerprintFor, flowDirection, transactionKey } from '../server/lib/accounts.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const samples = {
  bank: path.join(root, 'samples', 'sample-bank-statement.pdf'),
  card: path.join(root, 'samples', 'sample-credit-card-statement.pdf'),
}

if (!fs.existsSync(samples.bank) || !fs.existsSync(samples.card)) {
  execFileSync(process.execPath, [path.join(__dirname, 'make_sample_pdf.js')], {
    cwd: root,
    stdio: 'ignore',
  })
}

let passed = 0
function check(name, fn) {
  fn()
  passed += 1
  console.log(`✓ ${name}`)
}

const parsePdf = async (file) =>
  parseStatementFile({ buffer: fs.readFileSync(file), filename: path.basename(file) })

const bank = await parsePdf(samples.bank)
const bankRows = bank.rows
const bankFlows = summarizeFlows(bankRows)

check('bank statement type and metadata', () => {
  assert.equal(bank.statementType, 'bank')
  assert.match(bank.institution, /Northwind Bank/)
  assert.match(bank.period, /Oct 1/)
  assert.equal(bankRows.length, 23)
})

check('bank keeps salary and deposits as money in', () => {
  const salary = bankRows.find((r) => /PAYROLL/.test(r.description))
  assert.equal(salary.category, 'Salary')
  assert.equal(salary.flow, 'income')
  assert.equal(salary.direction, 'in')

  const deposit = bankRows.find((r) => /MOBILE CHECK DEPOSIT/.test(r.description))
  assert.equal(deposit.flow, 'income')
  assert.equal(deposit.direction, 'in')
})

check('bank separates card payments, transfers, refunds and fees', () => {
  const byDescription = (re) => bankRows.find((r) => re.test(r.description))

  const card = byDescription(/ONLINE PAYMENT TO VISA/)
  assert.equal(card.flow, 'card_payment')
  assert.equal(card.direction, 'out')

  const transferOut = byDescription(/TRANSFER TO SAVINGS/)
  assert.equal(transferOut.flow, 'transfer')
  assert.equal(transferOut.direction, 'out')

  const transferIn = byDescription(/ZELLE TRANSFER FROM SAVINGS/)
  assert.equal(transferIn.flow, 'transfer')
  assert.equal(transferIn.direction, 'in')

  const refund = byDescription(/REFUND FROM AMAZON/)
  assert.equal(refund.flow, 'refund')
  assert.equal(refund.direction, 'in')

  const fee = byDescription(/ATM FEE/)
  assert.equal(fee.flow, 'fee')
  assert.equal(fee.direction, 'out')
})

check('bank totals split spending from money in/out', () => {
  assert.equal(bankFlows.income, 3354.18)
  assert.equal(bankFlows.spending, 1921.57)
  assert.equal(bankFlows.card_payments_out, 450)
  assert.equal(bankFlows.transfers_in, 500)
  assert.equal(bankFlows.transfers_out, 300)
  assert.equal(bankFlows.refunds, 47.3)
  assert.equal(bankFlows.money_in, 3901.48)
  assert.equal(bankFlows.money_out, 2675.07)
  assert.equal(bankFlows.net, 1226.41)
})

const card = await parsePdf(samples.card)
const cardRows = card.rows
const cardFlows = summarizeFlows(cardRows)

check('credit-card statement type and metadata', () => {
  assert.equal(card.statementType, 'credit_card')
  assert.match(card.institution, /Northwind Card Services/)
  assert.match(card.account, /7742/)
  assert.equal(cardRows.length, 13)
})

check('credit-card purchases, payment and refund get the right direction', () => {
  const purchase = cardRows.find((r) => /WHOLE FOODS/.test(r.description))
  assert.equal(purchase.flow, 'expense')
  assert.equal(purchase.direction, 'out')

  const payment = cardRows.find((r) => /PAYMENT THANK YOU/.test(r.description))
  assert.equal(payment.flow, 'card_payment')
  assert.equal(payment.direction, 'in')

  const refund = cardRows.find((r) => /REFUND FROM BEST BUY/.test(r.description))
  assert.equal(refund.flow, 'refund')
  assert.equal(refund.direction, 'in')
})

check('credit-card totals treat payments and refunds as money in', () => {
  assert.equal(cardFlows.spending, 969.37)
  assert.equal(cardFlows.card_payments_in, 500)
  assert.equal(cardFlows.refunds, 149.99)
  assert.equal(cardFlows.money_in, 649.99)
  assert.equal(cardFlows.money_out, 969.37)
  assert.equal(cardFlows.net, -319.38)
})

check('CSV signed amounts and salary deposits', () => {
  const rows = parseCsv(
    'Date,Description,Amount\n' +
      '2026-10-01,ACME PAYROLL DIRECT DEPOSIT,3200.00\n' +
      '2026-10-02,WHOLE FOODS MARKET,-84.20\n' +
      '2026-10-03,ONLINE PAYMENT TO VISA,-450.00\n' +
      '2026-10-04,MOBILE CHECK DEPOSIT,150.00'
  )
  assert.equal(rows.length, 4)
  assert.equal(rows[0].direction, 'in')
  assert.equal(rows[0].flow, 'income')
  assert.equal(rows[1].direction, 'out')
  assert.equal(rows[2].flow, 'card_payment')
  assert.equal(rows[3].flow, 'income')
})

check('CSV debit/credit columns and case-insensitive headers', () => {
  const rows = parseCsv(
    'DATE,DESCRIPTION,DEBIT,CREDIT\n' +
      '10/01/2026,ACME PAYROLL DIRECT DEPOSIT,,3200.00\n' +
      '10/02/2026,WHOLE FOODS MARKET,84.20,\n' +
      '10/03/2026,ONLINE PAYMENT TO VISA,450.00,\n' +
      '10/04/2026,REFUND FROM BEST BUY,,47.30'
  )
  const flows = summarizeFlows(rows)
  assert.equal(rows.length, 4)
  assert.equal(flows.money_in, 3247.3)
  assert.equal(flows.money_out, 534.2)
  assert.equal(rows[3].flow, 'refund')
})

check('CSV type column and tab separators', () => {
  const rows = parseCsv(
    'Transaction Date\tDescription\tAmount\tType\n' +
      '2026-10-01\tACME PAYROLL\t3200.00\tcredit\n' +
      '2026-10-02\tELECTRIC UTILITY BILL\t91.66\tdebit'
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].direction, 'in')
  assert.equal(rows[1].category, 'Utilities')
  assert.equal(rows[1].direction, 'out')
})

check('duplicate keys normalise merchant text and respect account scope', () => {
  const base = {
    date: '2026-10-02T00:00:00.000Z',
    amount: 84.2,
    direction: 'out',
  }
  const one = transactionKey({ ...base, description: 'WHOLE FOODS MARKET #123' }, 'acct-1')
  const two = transactionKey({ ...base, description: 'whole foods market  #123' }, 'acct-1')
  assert.equal(one, two)
  assert.equal(fingerprintFor({ ...base, description: 'WHOLE FOODS' }, 'acct-1'), fingerprintFor({ ...base, description: 'WHOLE FOODS' }, 'acct-1'))
  assert.notEqual(one, transactionKey({ ...base, description: 'WHOLE FOODS MARKET #123' }, 'acct-2'))
  assert.match(transactionKey({ ...base, description: 'WHOLE FOODS' }, null), /^\*\|/)
})

check('manual flow/direction helper matches the selected kind', () => {
  assert.deepEqual(flowDirection('income'), { flow: 'income', direction: 'in' })
  assert.deepEqual(flowDirection('refund'), { flow: 'refund', direction: 'in' })
  assert.deepEqual(flowDirection('card_payment'), { flow: 'card_payment', direction: 'out' })
  assert.deepEqual(flowDirection('transfer', 'in'), { flow: 'transfer', direction: 'in' })
  assert.deepEqual(flowDirection('nonsense'), { flow: 'expense', direction: 'out' })
})

console.log(`\n${passed} statement tests passed.`)
