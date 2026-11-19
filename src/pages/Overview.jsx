import React from 'react'
import {
  ArrowUpRight,
  Wallet,
  ShieldAlert,
  ReceiptText,
  TrendingUp,
  Sparkles,
  Flame,
  ArrowRight,
  PiggyBank,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardHeader, Badge, Button, EmptyState, ErrorNote, Spinner } from '../components/ui'
import { SpendTrendChart, CategoryDonut } from '../components/charts'
import { currency, shortDate } from '../lib/format'

function KpiCard({ label, value, sub, icon: Icon, tone = 'default', badge }) {
  const tones = {
    default: 'text-ink',
    danger: 'text-danger',
    accent: 'text-accent',
    info: 'text-info',
  }
  return (
    <Card hover className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</p>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-muted">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <p className={`num mt-2.5 text-xl font-semibold ${tones[tone]} md:text-2xl`}>{value}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {badge}
        {sub && <p className="truncate text-[11px] text-faint">{sub}</p>}
      </div>
    </Card>
  )
}

export default function Overview({ user, summary, budgets, transactions, onNavigate, onRefresh, refreshing, loading, error }) {
  if (loading && !summary) {
    return (
      <Card>
        <Spinner label="Loading your dashboard" />
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card>
        <EmptyState
          icon={Wallet}
          title="No data yet"
          description="Import a bank statement or load the demo dataset to see your spending habits and hidden waste."
          action={
            <Button onClick={() => onNavigate('import')} className="mt-1">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Load demo data
            </Button>
          }
        />
      </Card>
    )
  }

  const wasteRows = summary.top_waste || []
  const maxWaste = Math.max(1, ...wasteRows.map((r) => r.amount))
  const recent = (transactions || []).slice(0, 6)

  return (
    <div className="space-y-4 md:space-y-5">
      {error && <ErrorNote>{error}</ErrorNote>}

      {/* Intro */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-faint">Welcome back</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink md:text-2xl">
            Here&apos;s where your money went, {user.username}.
          </h2>
          <p className="mt-1 text-xs text-muted">
            {summary.period} · {summary.transaction_count} transactions analysed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh} loading={refreshing}>
            Refresh
          </Button>
          <Button size="sm" onClick={() => onNavigate('import')}>
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            Import statement
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          label="Total spent"
          value={currency(summary.total_spent)}
          sub={`${currency(summary.avg_daily_spend)} avg / day`}
          icon={ReceiptText}
        />
        <KpiCard
          label="Waste detected"
          value={currency(summary.waste_total)}
          tone="danger"
          badge={<Badge tone="danger">{summary.waste_share}% of spend</Badge>}
          icon={ShieldAlert}
        />
        <KpiCard
          label="Annual leak"
          value={currency(summary.annual_waste_projection)}
          tone="warn"
          sub="If habits stay the same"
          icon={Flame}
        />
        <KpiCard
          label="10-yr opportunity"
          value={currency(summary.potential_investment_value_10yr, { maximumFractionDigits: 0 })}
          tone="accent"
          sub="Redirected waste @ 7% APY"
          icon={TrendingUp}
        />
      </div>

      {/* Budget health */}
      {budgets && (
        <Card>
          <CardHeader
            title="Budget health"
            subtitle={`${budgets.label} · ${budgets.total.percentage}% of ${currency(budgets.total.budget)} used`}
            icon={PiggyBank}
            action={
              <button
                onClick={() => onNavigate('budgets')}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent"
              >
                Open plan <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            }
          />
          <div className="space-y-3 px-5 pb-5">
            {budgets.alerts.length > 0 ? (
              <div
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                  budgets.total.status === 'over' || budgets.alerts.some((a) => a.status === 'over')
                    ? 'border-danger/30 bg-danger/10 text-danger'
                    : 'border-warn/30 bg-warn/10 text-warn'
                }`}
                role="status"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {budgets.alerts[0].status === 'over'
                    ? `${budgets.alerts[0].category} is ${currency(Math.abs(budgets.alerts[0].remaining))} over budget.`
                    : `${budgets.alerts[0].category} is at ${budgets.alerts[0].percentage}% of its limit.`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-accent" role="status">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                All budgets are within plan this month.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              {budgets.categories
                .filter((c) => c.kind !== 'goal')
                .sort((a, b) => b.percentage - a.percentage)
                .slice(0, 3)
                .map((c) => (
                  <div key={c.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="truncate text-muted">{c.category}</span>
                      <span
                        className={`num ${
                          c.status === 'over' ? 'text-danger' : c.status === 'warn' ? 'text-warn' : 'text-accent'
                        }`}
                      >
                        {c.percentage}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={`h-full rounded-full ${
                          c.status === 'over' ? 'bg-danger' : c.status === 'warn' ? 'bg-warn' : 'bg-accent'
                        }`}
                        style={{ width: `${Math.min(100, c.percentage)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-faint">
                      {currency(c.spent)} of {currency(c.limit)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Spending trend"
            subtitle="Daily outflow over the imported period"
            icon={TrendingUp}
            action={<Badge tone="accent">Live</Badge>}
          />
          <SpendTrendChart daily={summary.daily || []} />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Where it goes"
            subtitle="Share of spend by category"
            icon={Wallet}
          />
          <CategoryDonut categories={summary.categories || []} total={summary.total_spent} />
        </Card>
      </div>

      {/* Waste + recent */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Top waste sources"
            subtitle="Merchants worth reconsidering"
            icon={Flame}
            action={
              <button
                onClick={() => onNavigate('transactions')}
                className="text-[11px] text-muted underline-offset-2 hover:text-accent hover:underline"
              >
                View all
              </button>
            }
          />
          <div className="px-5 pb-5">
            {wasteRows.length === 0 ? (
              <p className="py-6 text-xs text-muted">No leaky spend detected. Nice work.</p>
            ) : (
              <ul className="space-y-3">
                {wasteRows.map((row) => (
                  <li key={row.description}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="truncate text-muted">{row.description}</span>
                      <span className="num shrink-0 text-ink">{currency(row.amount)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-danger/70 to-danger"
                        style={{ width: `${Math.max(6, (row.amount / maxWaste) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader
            title="Recent transactions"
            subtitle="Newest activity at a glance"
            icon={ReceiptText}
            action={
              <button
                onClick={() => onNavigate('transactions')}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent"
              >
                All transactions <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            }
          />
          <ul className="divide-y divide-line/70 px-5 pb-3">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-[10px] font-semibold uppercase text-muted">
                  {t.description.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink">{t.description}</p>
                  <p className="text-[10px] text-faint">
                    {shortDate(t.date)} · {t.category}
                  </p>
                </div>
                {t.isWaste && <Badge tone="danger">Leak</Badge>}
                <span className="num shrink-0 text-xs text-ink">{currency(t.amount)}</span>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="py-6 text-center text-xs text-muted">No transactions yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  )
}
