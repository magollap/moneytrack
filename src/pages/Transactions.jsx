import React, { useMemo, useState } from 'react'
import { Search, Download, ReceiptText, SlidersHorizontal, ShieldAlert } from 'lucide-react'
import { Card, CardHeader, Badge, Button, EmptyState } from '../components/ui'
import { currency, longDate } from '../lib/format'

export default function Transactions({ transactions = [], loading, onRefresh }) {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('all')
  const [wasteOnly, setWasteOnly] = useState(false)

  const categories = useMemo(
    () => ['all', ...new Set(transactions.map((t) => t.category))].sort((a, b) => (a === 'all' ? -1 : a.localeCompare(b))),
    [transactions]
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return transactions.filter((t) => {
      if (wasteOnly && !t.isWaste) return false
      if (category !== 'all' && t.category !== category) return false
      if (needle && !t.description.toLowerCase().includes(needle)) return false
      return true
    })
  }, [transactions, q, category, wasteOnly])

  const totals = useMemo(() => {
    const sum = filtered.reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
    const waste = filtered.filter((t) => t.isWaste).reduce((acc, t) => acc + Math.abs(Number(t.amount) || 0), 0)
    return { sum, waste }
  }, [filtered])

  const exportCsv = () => {
    const header = 'Date,Description,Category,Amount,IsWaste\n'
    const body = filtered
      .map((t) =>
        [
          new Date(t.date).toISOString().slice(0, 10),
          `"${t.description.replace(/"/g, '""')}"`,
          t.category,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">All transactions</h2>
          <p className="mt-1 text-xs text-muted">
            {filtered.length} of {transactions.length} shown · {currency(totals.sum)} spent ·{' '}
            <span className="text-danger">{currency(totals.waste)} flagged</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} loading={loading}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center">
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

          <div className="flex items-center gap-2">
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
            description="Try a different search term, category, or turn off the waste filter."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line text-[10px] uppercase tracking-wider text-faint">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Date</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Merchant</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Category</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Amount</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {filtered.slice(0, 200).map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-surface-2/50">
                      <td className="whitespace-nowrap px-5 py-2.5 text-muted">{longDate(t.date)}</td>
                      <td className="max-w-[280px] truncate px-5 py-2.5 font-medium text-ink">
                        {t.description}
                      </td>
                      <td className="px-5 py-2.5 text-muted">{t.category}</td>
                      <td className="num whitespace-nowrap px-5 py-2.5 text-right text-ink">
                        {currency(t.amount)}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        {t.isWaste ? <Badge tone="danger">Waste</Badge> : <span className="text-faint">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-line/70 md:hidden">
              {filtered.slice(0, 200).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold uppercase text-muted">
                    {t.description.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{t.description}</p>
                    <p className="text-[10px] text-faint">
                      {longDate(t.date)} · {t.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="num text-xs text-ink">{currency(t.amount)}</p>
                    {t.isWaste && <Badge tone="danger" className="mt-1">Waste</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-faint">
        <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
        Showing up to 200 rows. Use filters to narrow the list.
      </p>
    </div>
  )
}
