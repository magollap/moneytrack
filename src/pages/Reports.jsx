import React, { useCallback, useEffect, useState } from 'react'
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Flame,
  Store,
  Lightbulb,
  Wallet,
} from 'lucide-react'
import { Card, CardHeader, Badge, Spinner, ErrorNote, EmptyState } from '../components/ui'
import { MonthlyBars } from '../components/charts'
import { getReport } from '../lib/api'
import { currency, categoryColor, longDate } from '../lib/format'

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function ChangePill({ value, pct }) {
  if (value == null) return <span className="text-[11px] text-faint">new</span>
  const up = value > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] ${up ? 'text-danger' : 'text-accent'}`}
      title={`${up ? 'Up' : 'Down'} ${currency(Math.abs(value))} versus last month`}
    >
      {up ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
      {pct != null ? `${Math.abs(pct)}%` : currency(Math.abs(value))}
    </span>
  )
}

export default function Reports({ user }) {
  const [month, setMonth] = useState(currentMonth())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(
    async (target) => {
      setLoading(true)
      setError(null)
      try {
        const data = await getReport(user, target)
        setReport(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [user]
  )

  useEffect(() => {
    load(month)
  }, [month, load])

  const isCurrent = month === currentMonth()

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Monthly report</h2>
          <p className="mt-1 text-xs text-muted">Category movement, merchant ranking and budget outcome.</p>
        </div>
        <div className="flex items-center rounded-xl border border-line bg-surface">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="grid h-9 w-9 place-items-center rounded-l-xl text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-[124px] px-2 text-center text-xs font-medium text-ink">
            {report?.label || month}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={isCurrent}
            className="grid h-9 w-9 place-items-center rounded-r-xl text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}

      {loading && !report ? (
        <Card>
          <Spinner label="Building your report" />
        </Card>
      ) : !report ? (
        <Card>
          <EmptyState icon={BarChart3} title="No report data" description="Import a statement to generate a monthly report." />
        </Card>
      ) : report.totals.count === 0 ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title={`Nothing recorded in ${report.label}`}
            description="Pick another month or import a statement that covers this period."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-faint">Spent</p>
              <p className="num mt-2 text-xl font-semibold text-ink">{currency(report.totals.spent)}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <ChangePill value={report.totals.change} pct={report.totals.change_pct} />
                <span className="text-[11px] text-faint">vs {currency(report.totals.previous_spent)}</span>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-faint">Waste</p>
              <p className="num mt-2 text-xl font-semibold text-danger">{currency(report.totals.waste)}</p>
              <p className="mt-1.5 text-[11px] text-faint">
                {report.totals.spent > 0 ? ((report.totals.waste / report.totals.spent) * 100).toFixed(1) : 0}% of spend
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wider text-faint">Average / day</p>
              <p className="num mt-2 text-xl font-semibold text-ink">{currency(report.totals.avg_per_day)}</p>
              <p className="mt-1.5 text-[11px] text-faint">{report.totals.days} days</p>
            </Card>
            <Card className={`p-4 ${report.budgets.total.status === 'over' ? 'border-danger/40' : ''}`}>
              <p className="text-[11px] uppercase tracking-wider text-faint">Budget used</p>
              <p
                className={`num mt-2 text-xl font-semibold ${
                  report.budgets.total.status === 'over'
                    ? 'text-danger'
                    : report.budgets.total.status === 'warn'
                      ? 'text-warn'
                      : 'text-accent'
                }`}
              >
                {report.budgets.total.percentage}%
              </p>
              <p className="mt-1.5 text-[11px] text-faint">
                {report.budgets.total.status === 'over'
                  ? `${currency(Math.abs(report.budgets.total.remaining))} over plan`
                  : `${currency(report.budgets.total.remaining)} left`}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="Last six months" subtitle="Spend by month, selected highlighted" icon={BarChart3} />
              <MonthlyBars monthly={report.monthly} selected={report.month} />
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="What changed" subtitle="Automatic observations" icon={Lightbulb} />
              <ul className="space-y-2.5 px-5 pb-5 text-xs text-muted">
                {report.insights.map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Categories"
              subtitle={`${report.label} versus last month`}
              icon={Wallet}
              action={<Badge tone="neutral">{report.categories.length}</Badge>}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-y border-line text-[10px] uppercase tracking-wider text-faint">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Category</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Spent</th>
                    <th scope="col" className="hidden px-5 py-2.5 text-right font-medium sm:table-cell">Share</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">vs last</th>
                    <th scope="col" className="hidden px-5 py-2.5 text-right font-medium md:table-cell">Budget</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {report.categories.map((c) => (
                    <tr key={c.name} className="transition-colors hover:bg-surface-2/50">
                      <td className="px-5 py-2.5">
                        <span className="flex items-center gap-2 font-medium text-ink">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: categoryColor(c.name) }}
                            aria-hidden="true"
                          />
                          {c.name}
                          {c.isWaste && <Badge tone="danger">Leak</Badge>}
                        </span>
                        <span className="text-[10px] text-faint">{c.count} transactions</span>
                      </td>
                      <td className="num whitespace-nowrap px-5 py-2.5 text-right text-ink">{currency(c.amount)}</td>
                      <td className="num hidden px-5 py-2.5 text-right text-muted sm:table-cell">{c.share}%</td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right">
                        <ChangePill value={c.change} pct={c.change_pct} />
                      </td>
                      <td className="hidden px-5 py-2.5 text-right md:table-cell">
                        {c.budget ? (
                          <span
                            className={`num text-[11px] ${
                              c.budget.status === 'over'
                                ? 'text-danger'
                                : c.budget.status === 'warn'
                                  ? 'text-warn'
                                  : 'text-accent'
                            }`}
                          >
                            {c.budget.percentage}% of {currency(c.budget.limit, { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-[11px] text-faint">no limit</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Merchants" subtitle="Largest outflows this month" icon={Store} />
            <ul className="divide-y divide-line/70 px-5 pb-3">
              {report.top_merchants.map((m) => (
                <li key={m.description} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold uppercase text-muted">
                    {m.description.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-ink">{m.description}</p>
                    <p className="text-[10px] text-faint">
                      {m.count}× · {m.category}
                    </p>
                  </div>
                  {m.isWaste && <Badge tone="danger">Leak</Badge>}
                  <span className="num text-xs text-ink">{currency(m.amount)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <p className="flex items-center gap-1.5 text-[11px] text-faint">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            Report generated locally for {longDate(`${report.month}-01T00:00:00Z`)} · no data leaves this device.
          </p>
        </>
      )}
    </div>
  )
}
