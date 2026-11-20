import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Download,
  CheckCircle2,
  FileText,
  ScanLine,
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  CreditCard,
  ListChecks,
} from 'lucide-react'
import { Card, CardHeader, Button, ErrorNote, Badge } from '../components/ui'
import { uploadStatement, loadDemo } from '../lib/api'
import { currency, longDate } from '../lib/format'

const SAMPLE = `Date,Description,Amount,Type
2026-11-01,ACME CORP PAYROLL DIRECT DEPOSIT,3200.00,credit
2026-11-02,WHOLE FOODS MARKET,-84.20,debit
2026-11-03,ONLINE PAYMENT TO VISA,-450.00,debit
2026-11-04,ELECTRIC UTILITY BILL,-96.40,debit
2026-11-05,MOBILE CHECK DEPOSIT,150.00,credit`

const SOURCE_LABEL = {
  pdf: 'PDF statement',
  text: 'CSV / TSV file',
}

const STATEMENT_LABEL = {
  bank: { label: 'Bank account', icon: Landmark, tone: 'info' },
  credit_card: { label: 'Credit card', icon: CreditCard, tone: 'warn' },
  statement: { label: 'Statement', icon: FileText, tone: 'neutral' },
}

const FLOW_META = {
  income: { label: 'Income', tone: 'accent' },
  expense: { label: 'Spending', tone: 'neutral' },
  fee: { label: 'Fee', tone: 'danger' },
  card_payment: { label: 'Card payment', tone: 'info' },
  transfer: { label: 'Transfer', tone: 'warn' },
  refund: { label: 'Refund', tone: 'accent' },
}

function amountLabel(t) {
  return `${t.direction === 'in' ? '+' : '-'}${currency(t.amount)}`
}

function FlowBadge({ t }) {
  const meta = FLOW_META[t.flow] || FLOW_META.expense
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

function GroupList({ groups, empty }) {
  if (!groups.length) {
    return <p className="px-4 py-3 text-xs text-faint">{empty}</p>
  }
  return (
    <ul className="divide-y divide-line/70">
      {groups.map((g) => (
        <li key={`${g.direction}-${g.category}`} className="flex items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs text-ink">{g.category}</p>
            <p className="text-[10px] text-faint">
              {g.count} transaction{g.count === 1 ? '' : 's'}
            </p>
          </div>
          <span className="num shrink-0 text-xs text-ink">{currency(g.amount)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Import({ user, accounts, onImported, onNavigate }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [accountId, setAccountId] = useState('auto')
  const accountList = accounts?.accounts || []

  const handleUpload = useCallback(
    async (file) => {
      setBusy(true)
      setError(null)
      setResult(null)
      try {
        const summary = await uploadStatement(user, file, accountId)
        setResult(summary)
        await onImported()
      } catch (err) {
        setError(err.message)
      } finally {
        setBusy(false)
      }
    },
    [user, onImported, accountId]
  )

  const onDrop = useCallback(
    (accepted) => {
      if (accepted[0]) handleUpload(accepted[0])
    },
    [handleUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'text/csv': ['.csv'],
      'text/plain': ['.tsv', '.txt'],
      'application/pdf': ['.pdf'],
    },
  })

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'moneytrack-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadDemoData = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const summary = await loadDemo(user)
      setResult(summary)
      await onImported()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const statement = STATEMENT_LABEL[result?.import?.statement_type] || STATEMENT_LABEL.statement
  const StatementIcon = statement.icon
  const flows = result?.flows
  const inGroups = (flows?.groups || []).filter((g) => g.direction === 'in')
  const outGroups = (flows?.groups || []).filter((g) => g.direction === 'out')
  const rows = result?.transactions || []

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Import a statement</h2>
        <p className="mt-1 text-xs text-muted">
          Bank or credit-card statements as <span className="text-ink">PDF</span>, CSV or TSV.
          Every line is read as money in, money out, a transfer or a card payment.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="p-4">
            <div
              {...getRootProps()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-200 ${
                isDragActive
                  ? 'border-accent bg-accent/5'
                  : 'border-line-strong bg-canvas/40 hover:border-accent/50'
              }`}
            >
              <input {...getInputProps()} aria-label="Upload PDF, CSV or TSV statement" />
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-accent">
                <UploadCloud className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {busy ? 'Reading your statement…' : isDragActive ? 'Drop it here' : 'Drop your statement here'}
                </p>
                <p className="mt-1 text-xs text-muted">or click to browse · .pdf, .csv, .tsv, .txt</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-faint">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Parsed locally, never uploaded to a third party
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button variant="secondary" size="sm" onClick={loadDemoData} loading={busy}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Load demo dataset
              </Button>
              <button
                onClick={downloadSample}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted underline-offset-2 hover:text-accent hover:underline"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download sample CSV
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-line bg-canvas/40 p-3">
              <label htmlFor="import-account" className="text-[11px] font-medium text-muted">
                Statement belongs to
              </label>
              <select
                id="import-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
              >
                <option value="auto">Detect from statement / create account</option>
                {accountList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.last4 ? ` ••${a.last4}` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] leading-relaxed text-faint">
                {accountList.length === 0
                  ? 'No accounts yet — the importer will create one from the statement details.'
                  : 'Choose an account to combine this statement with it. Matching statements are deduplicated automatically.'}
                {' '}
                <button
                  onClick={() => onNavigate('accounts')}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Manage accounts
                </button>
              </p>
            </div>

            {error && (
              <div className="mt-3">
                <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="How parsing works" icon={FileSpreadsheet} />
          <ul className="space-y-3 px-5 pb-5 text-xs text-muted">
            <li className="flex gap-2">
              <span className="num text-accent">01</span>
              <span>
                <span className="text-ink">PDF</span> — text is extracted, dated rows are found,
                and debit/credit sections set the direction.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="num text-accent">02</span>
              <span>
                <span className="text-ink">CSV / TSV</span> — supports amount, debit/credit and
                type columns, plus signed amounts.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="num text-accent">03</span>
              Salary, deposits, refunds, transfers and card payments are separated from spending.
            </li>
          </ul>
          <div className="mx-5 mb-5 flex items-start gap-2 rounded-xl border border-line bg-canvas/40 p-3">
            <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-muted">
              Scanned or image-only PDFs contain no text. Export CSV from your bank instead — no OCR
              is run on your device.
            </p>
          </div>
        </Card>
      </div>

      {result && (
        <Card className="glow-accent">
          <CardHeader
            title={result.import ? 'Statement understood' : 'Import complete'}
            subtitle={
              result.import
                ? `${SOURCE_LABEL[result.import.source] || 'Statement'}${
                    result.import.institution ? ` · ${result.import.institution}` : ''
                  }${result.import.period ? ` · ${result.import.period}` : ''}${
                    result.import.pages ? ` · ${result.import.pages} pages` : ''
                  } · ${result.import.imported ?? result.import.transactions} new${
                    result.import.duplicates ? ` · ${result.import.duplicates} duplicates skipped` : ''
                  }${result.import.account_name ? ` · ${result.import.account_name}` : ''}`
                : `${result.transaction_count} transactions in this file`
            }
            icon={CheckCircle2}
            action={
              result.import ? (
                <Badge tone={statement.tone}>
                  <StatementIcon className="h-3 w-3" aria-hidden="true" />
                  {statement.label}
                </Badge>
              ) : (
                <Badge tone="accent">Analysed</Badge>
              )
            }
          />

          {result.import && result.import.imported === 0 && (
            <div className="mx-5 mb-4 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn" role="status">
              No new transactions were saved. All {result.import.transactions} lines already exist
              {result.import.account_name ? ` in ${result.import.account_name}` : ''} — duplicates
              are skipped automatically.
            </div>
          )}

          {flows && (
            <>
              <div className="grid grid-cols-1 gap-3 px-5 pb-4 sm:grid-cols-3">
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-accent">
                    <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" /> Money in
                  </p>
                  <p className="num mt-1 text-lg font-semibold text-accent">{currency(flows.money_in)}</p>
                  <p className="mt-0.5 text-[10px] text-faint">
                    Income {currency(flows.income + flows.refunds)}
                    {flows.card_payments_in > 0 ? ` · Card ${currency(flows.card_payments_in)}` : ''}
                    {flows.transfers_in > 0 ? ` · Transfers ${currency(flows.transfers_in)}` : ''}
                  </p>
                </div>
                <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-danger">
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> Money out
                  </p>
                  <p className="num mt-1 text-lg font-semibold text-danger">{currency(flows.money_out)}</p>
                  <p className="mt-0.5 text-[10px] text-faint">
                    Spending {currency(flows.spending)} · Card {currency(flows.card_payments_out)}
                    {flows.transfers_out > 0 ? ` · Transfers ${currency(flows.transfers_out)}` : ''}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-faint">Net cash flow</p>
                  <p
                    className={`num mt-1 text-lg font-semibold ${
                      flows.net >= 0 ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {flows.net >= 0 ? '+' : '-'}
                    {currency(Math.abs(flows.net))}
                  </p>
                  <p className="mt-0.5 text-[10px] text-faint">
                    Fees {currency(flows.fees)} · Transfers {currency(flows.transfers_out)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 border-t border-line px-5 py-4 lg:grid-cols-2">
                <div className="rounded-xl border border-line">
                  <p className="flex items-center gap-1.5 border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-accent">
                    <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" /> Where money came in
                  </p>
                  <GroupList groups={inGroups} empty="No deposits or credits detected." />
                </div>
                <div className="rounded-xl border border-line">
                  <p className="flex items-center gap-1.5 border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-danger">
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> Where money went
                  </p>
                  <GroupList groups={outGroups} empty="No withdrawals or purchases detected." />
                </div>
              </div>

              {rows.length > 0 && (
                <div className="border-t border-line">
                  <p className="flex items-center gap-1.5 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
                    <ListChecks className="h-3.5 w-3.5" aria-hidden="true" /> Classified transactions
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-y border-line text-[10px] uppercase tracking-wider text-faint">
                        <tr>
                          <th scope="col" className="px-5 py-2 font-medium">Date</th>
                          <th scope="col" className="px-5 py-2 font-medium">Description</th>
                          <th scope="col" className="px-5 py-2 font-medium">Read as</th>
                          <th scope="col" className="px-5 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/70">
                        {rows.slice(0, 150).map((t, i) => (
                          <tr key={`${t.date}-${t.description}-${i}`} className="hover:bg-surface-2/40">
                            <td className="whitespace-nowrap px-5 py-2 text-muted">{longDate(t.date)}</td>
                            <td className="max-w-[300px] truncate px-5 py-2 text-ink">{t.description}</td>
                            <td className="whitespace-nowrap px-5 py-2">
                              <span className="inline-flex items-center gap-1.5">
                                <FlowBadge t={t} />
                                <span className="text-[10px] text-faint">{t.category}</span>
                              </span>
                            </td>
                            <td
                              className={`num whitespace-nowrap px-5 py-2 text-right ${
                                t.direction === 'in' ? 'text-accent' : 'text-ink'
                              }`}
                            >
                              {amountLabel(t)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 150 && (
                    <p className="px-5 py-2 text-[11px] text-faint">
                      Showing the first 150 of {rows.length} new rows. All new rows were saved.
                      {result.import?.duplicates
                        ? ` ${result.import.duplicates} duplicate line${
                            result.import.duplicates === 1 ? ' was' : 's were'
                          } skipped.`
                        : ''}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {!flows && (
            <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint">Spent</p>
                <p className="num mt-1 text-sm text-ink">{currency(result.total_spent)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint">Waste</p>
                <p className="num mt-1 text-sm text-danger">{currency(result.waste_total)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint">Categories</p>
                <p className="num mt-1 text-sm text-ink">{result.categories.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-faint">Annual leak</p>
                <p className="num mt-1 text-sm text-warn">{currency(result.annual_waste_projection)}</p>
              </div>
            </div>
          )}

          {result.import && (
            <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[11px] text-faint">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{result.import.file}</span>
              {(result.import.account_name || result.import.account) && (
                <span className="shrink-0">
                  · {result.import.account_name || result.import.account}
                </span>
              )}
            </div>
          )}
        </Card>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => onNavigate('transactions')}>
          Review transactions
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
