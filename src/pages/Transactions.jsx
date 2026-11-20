import React, { useMemo, useState } from 'react'
import {
  Search,
  Download,
  ReceiptText,
  SlidersHorizontal,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Plus,
  Trash2,
  Save,
  X,
} from 'lucide-react'
import { Card, CardHeader, Badge, Button, EmptyState, ErrorNote } from '../components/ui'
import { currency, longDate } from '../lib/format'
import { createTransaction } from '../lib/api'

const FLOW_META = {
  income: { label: 'Income', tone: 'accent' },
  expense: { label: 'Spending', tone: 'neutral' },
  fee: { label: 'Fee', tone: 'danger' },
  card_payment: { label: 'Card payment', tone: 'info' },
  transfer: { label: 'Transfer', tone: 'warn' },
  refund: { label: 'Refund', tone: 'accent' },
}

const FLOW_FILTERS = [
  ['all', 'All activity'],
  ['income', 'Income & deposits'],
  ['expense', 'Spending'],
  ['fee', 'Fees'],
  ['card_payment', 'Card payments'],
  ['transfer', 'Transfers'],
  ['refund', 'Refunds'],
]

const CATEGORIES = [
  'Housing',
  'Groceries',
  'Utilities',
  'Transport',
  'Health & Fitness',
  'Dining Out',
  'Subscriptions',
  'Fees',
  'Clothing',
  'Entertainment',
  'Miscellaneous',
  'Salary',
  'Deposits',
  'Credit Card Payment',
  'Transfers',
  'Refunds',
  'Savings',
]

const KINDS = [
  { value: 'expense', label: 'Money out — spending', flow: 'expense', direction: 'out' },
  { value: 'income', label: 'Money in — income', flow: 'income', direction: 'in' },
  { value: 'fee', label: 'Fee', flow: 'fee', direction: 'out' },
  { value: 'card_payment', label: 'Credit-card payment', flow: 'card_payment', direction: 'out' },
  { value: 'transfer_out', label: 'Transfer out', flow: 'transfer', direction: 'out' },
  { value: 'transfer_in', label: 'Transfer in', flow: 'transfer', direction: 'in' },
  { value: 'refund', label: 'Refund', flow: 'refund', direction: 'in' },
]

function flowOf(t) {
  if (t.flow) return t.flow
  if (['Income', 'Salary', 'Deposits'].includes(t.category)) return 'income'
  if (t.category === 'Refunds') return 'refund'
  if (t.category === 'Transfers') return 'transfer'
  if (t.category === 'Credit Card Payment') return 'card_payment'
  if (t.category === 'Fees') return 'fee'
  return 'expense'
}

function directionOf(t) {
  if (t.direction === 'in' || t.direction === 'out') return t.direction
  return ['income', 'refund'].includes(flowOf(t)) ? 'in' : 'out'
}

function FlowBadge({ t }) {
  const meta = FLOW_META[flowOf(t)] || FLOW_META.expense
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

function SignedAmount({ t, className = '' }) {
  const inFlow = directionOf(t) === 'in'
  return (
    <span className={`num ${inFlow ? 'text-accent' : 'text-ink'} ${className}`}>
      {inFlow ? '+' : '-'}
      {currency(t.amount)}
    </span>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

export default function Transactions({
  user,
  transactions = [],
  accounts,
  accountScope = 'all',
  onScopeChange,
  loading,
  onRefresh,
  onChanged,
  onUpdateTransaction,
  onDeleteTransaction,
}) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [flow, setFlow] = useState('all')
  const [wasteOnly, setWasteOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    date: today(),
    description: '',
    amount: '',
    category: 'Groceries',
    kind: 'expense',
    account_id: accountScope !== 'all' && accountScope !== 'unassigned' ? accountScope : '',
  })

  const accountList = accounts?.accounts || []
  const categories = useMemo(
    () =>
      ['all', ...new Set([...CATEGORIES, ...transactions.map((t) => t.category)])].sort((a, b) =>
        a === 'all' ? -1 : a.localeCompare(b)
      ),
    [transactions]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return transactions.filter((t) => {
      if (wasteOnly && !t.isWaste) return false
      if (category !== 'all' && t.category !== category) return false
      if (flow !== 'all' && flowOf(t) !== flow) return false
      if (needle && !t.description.toLowerCase().includes(needle)) return false
      return true
    })
  }, [transactions, q, category, flow, wasteOnly])

  const totals = useMemo(() => {
    let moneyIn = 0
    let moneyOut = 0
    let spent = 0
    let waste = 0
    for (const t of filtered) {
      const amount = Math.abs(Number(t.amount) || 0)
      if (directionOf(t) === 'in') moneyIn += amount
      else moneyOut += amount
      if (['expense', 'fee'].includes(flowOf(t)) && directionOf(t) === 'out') spent += amount
      if (t.isWaste) waste += amount
    }
    return { moneyIn, moneyOut, net: moneyIn - moneyOut, spent, waste }
  }, [filtered])

  const updateForm = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const saveManual = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const kind = KINDS.find((k) => k.value === form.kind) || KINDS[0]
      await createTransaction(user, {
        date: form.date,
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        flow: kind.flow,
        direction: kind.direction,
        account_id: form.account_id || null,
      })
      setForm((prev) => ({ ...prev, description: '', amount: '' }))
      setShowForm(false)
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const patch = async (t, body) => {
    setSavingId(t.id)
    setError(null)
    try {
      await onUpdateTransaction(t.id, body)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.description}" (${currency(t.amount)})?`)) return
    setSavingId(t.id)
    setError(null)
    try {
      await onDeleteTransaction(t.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  const exportCsv = () => {
    const header = 'Date,Description,Account,Category,Flow,Direction,Amount,IsWaste\n'
    const body = filtered
      .map((t) =>
        [
          new Date(t.date).toISOString().slice(0, 10),
          `"${t.description.replace(/"/g, '""')}"`,
          `"${(t.account?.name || 'Unassigned').replace(/"/g, '""')}"`,
          t.category,
          flowOf(t),
          directionOf(t),
          Number(t.amount).toFixed(2),
          t.isWaste ? 'true' : 'false',
        ].join(',')
      )
      .join('\n')
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'moneytrack-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const scopeLabel =
    accountScope === 'all'
      ? 'All accounts'
      : accountScope === 'unassigned'
        ? 'Unassigned'
        : accountList.find((a) => a.id === accountScope)?.name || 'Account'

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">All transactions</h2>
          <p className="mt-1 text-xs text-muted">
            {scopeLabel} · {filtered.length} of {transactions.length} shown ·{' '}
            {currency(totals.spent)} spending ·{' '}
            <span className="text-danger">{currency(totals.waste)} flagged</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            {showForm ? 'Cancel' : 'Add transaction'}
          </Button>
          <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint">
            <ArrowDownLeft className="h-3 w-3 text-accent" aria-hidden="true" /> In
          </p>
          <p className="num mt-1 text-sm font-semibold text-accent">{currency(totals.moneyIn)}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint">
            <ArrowUpRight className="h-3 w-3 text-danger" aria-hidden="true" /> Out
          </p>
          <p className="num mt-1 text-sm font-semibold text-ink">{currency(totals.moneyOut)}</p>
        </Card>
        <Card className="p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint">
            <Wallet className="h-3 w-3" aria-hidden="true" /> Net
          </p>
          <p className={`num mt-1 text-sm font-semibold ${totals.net >= 0 ? 'text-accent' : 'text-danger'}`}>
            {totals.net >= 0 ? '+' : '-'}
            {currency(Math.abs(totals.net))}
          </p>
        </Card>
      </div>

      {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}

      {showForm && (
        <Card>
          <CardHeader
            title="Add a transaction manually"
            subtitle="It is added to the account balance immediately."
            icon={Plus}
          />
          <form onSubmit={saveManual} className="grid gap-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="text-[11px] text-muted">Date</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={updateForm('date')}
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
              />
            </label>
            <label className="block sm:col-span-1 lg:col-span-2">
              <span className="text-[11px] text-muted">Description</span>
              <input
                required
                value={form.description}
                onChange={updateForm('description')}
                placeholder="Coffee with a friend"
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted">Amount</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount}
                onChange={updateForm('amount')}
                placeholder="12.50"
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted">Direction</span>
              <select
                value={form.kind}
                onChange={updateForm('kind')}
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
              >
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted">Category</span>
              <select
                value={form.category}
                onChange={updateForm('category')}
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-muted">Account</span>
              <select
                value={form.account_id}
                onChange={updateForm('account_id')}
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
              >
                <option value="">Unassigned</option>
                {accountList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <Button type="submit" size="sm" loading={saving} className="w-full">
                <Save className="h-4 w-4" aria-hidden="true" />
                Save transaction
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search merchants…"
              aria-label="Search transactions by merchant"
              className="h-10 w-full rounded-xl border border-line bg-canvas pl-9 pr-3 text-sm text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="account-filter">
              Filter by account
            </label>
            <select
              id="account-filter"
              value={accountScope}
              onChange={(e) => onScopeChange(e.target.value)}
              className="h-10 rounded-xl border border-line bg-canvas px-3 text-xs text-ink focus:border-accent/60 focus:outline-none"
            >
              <option value="all">All accounts</option>
              {accountList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              {accounts?.unassigned?.transaction_count > 0 && (
                <option value="unassigned">Unassigned</option>
              )}
            </select>

            <label className="sr-only" htmlFor="flow-filter">
              Filter by flow
            </label>
            <select
              id="flow-filter"
              value={flow}
              onChange={(e) => setFlow(e.target.value)}
              className="h-10 rounded-xl border border-line bg-canvas px-3 text-xs text-ink focus:border-accent/60 focus:outline-none"
            >
              {FLOW_FILTERS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="category-filter">
              Filter by category
            </label>
            <select
              id="category-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-xl border border-line bg-canvas px-3 text-xs text-ink focus:border-accent/60 focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All categories' : c}
                </option>
              ))}
            </select>

            <button
              onClick={() => setWasteOnly((v) => !v)}
              aria-pressed={wasteOnly}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs transition-colors ${
                wasteOnly
                  ? 'border-danger/40 bg-danger/10 text-danger'
                  : 'border-line bg-canvas text-muted hover:text-ink'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Waste only
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="Nothing matches those filters"
            description="Try a different search term, flow, category, account, or turn off the waste filter."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line text-[10px] uppercase tracking-wider text-faint">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Description</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Account</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Category</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Read as</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {filtered.slice(0, 200).map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-surface-2/50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted">{longDate(t.date)}</td>
                      <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-ink">
                        {t.description}
                        {t.isWaste && <Badge tone="danger" className="ml-1.5">Waste</Badge>}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={t.accountId || ''}
                          disabled={savingId === t.id}
                          onChange={(e) => patch(t, { account_id: e.target.value || null })}
                          aria-label={`Account for ${t.description}`}
                          className="max-w-[140px] rounded-lg border border-line bg-canvas px-1.5 py-1 text-[11px] text-muted focus:border-accent/60 focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {accountList.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={t.category}
                          disabled={savingId === t.id}
                          onChange={(e) => patch(t, { category: e.target.value })}
                          aria-label={`Category for ${t.description}`}
                          className="max-w-[150px] rounded-lg border border-line bg-canvas px-1.5 py-1 text-[11px] text-ink focus:border-accent/60 focus:outline-none"
                        >
                          {[...new Set([...CATEGORIES, t.category])].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <FlowBadge t={t} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right">
                        <SignedAmount t={t} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => remove(t)}
                          disabled={savingId === t.id}
                          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                          aria-label={`Delete ${t.description}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line/70 md:hidden">
              {filtered.slice(0, 200).map((t) => (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold uppercase text-muted">
                      {t.description.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-ink">{t.description}</p>
                      <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-faint">
                        {longDate(t.date)} · {t.account?.name || 'Unassigned'} <FlowBadge t={t} />
                      </p>
                    </div>
                    <div className="text-right">
                      <SignedAmount t={t} className="text-xs" />
                      {t.isWaste && <Badge tone="danger" className="mt-1">Waste</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={t.category}
                      disabled={savingId === t.id}
                      onChange={(e) => patch(t, { category: e.target.value })}
                      aria-label={`Category for ${t.description}`}
                      className="h-7 flex-1 rounded-lg border border-line bg-canvas px-1.5 text-[11px] text-ink"
                    >
                      {[...new Set([...CATEGORIES, t.category])].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      value={t.accountId || ''}
                      disabled={savingId === t.id}
                      onChange={(e) => patch(t, { account_id: e.target.value || null })}
                      aria-label={`Account for ${t.description}`}
                      className="h-7 flex-1 rounded-lg border border-line bg-canvas px-1.5 text-[11px] text-muted"
                    >
                      <option value="">Unassigned</option>
                      {accountList.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => remove(t)}
                      disabled={savingId === t.id}
                      className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      aria-label={`Delete ${t.description}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
        Showing up to 200 rows. Categories and account assignments save immediately. Deposits and
        card payments are listed separately from spending.
      </p>
    </div>
  )
}
