import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Pencil,
  Check,
  X,
  Trash2,
  Plus,
  AlertTriangle,
  ShieldCheck,
  Target,
} from 'lucide-react'
import { Card, CardHeader, Badge, Button, ErrorNote, Spinner, EmptyState } from '../components/ui'
import { getBudgets, saveBudget, deleteBudget, generatePlan } from '../lib/api'
import { currency } from '../lib/format'

const KIND_LABEL = {
  essential: 'Essential',
  leak: 'Leak risk',
  lifestyle: 'Lifestyle',
  goal: 'Goal',
}

const STATUS_TEXT = {
  ok: { label: 'On track', tone: 'accent' },
  warn: { label: 'Close to limit', tone: 'warn' },
  over: { label: 'Over budget', tone: 'danger' },
  unset: { label: 'No limit', tone: 'neutral' },
}

const barTone = {
  ok: 'bg-accent',
  warn: 'bg-warn',
  over: 'bg-danger',
  unset: 'bg-line-strong',
}

const textTone = {
  ok: 'text-accent',
  warn: 'text-warn',
  over: 'text-danger',
  unset: 'text-muted',
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function Ring({ percentage, status, spent, budget }) {
  const pct = Math.min(100, Math.max(0, percentage))
  const color = status === 'over' ? '#ef4444' : status === 'warn' ? '#fbbf24' : '#22c55e'
  const radius = 42
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${percentage}% of budget used`}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="num text-xl font-semibold text-ink">{Math.round(percentage)}%</p>
          <p className="text-[10px] uppercase tracking-wider text-faint">of {currency(budget, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>
    </div>
  )
}

function BudgetCard({ item, month, user, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(item.limit))
  const [busy, setBusy] = useState(false)
  const status = STATUS_TEXT[item.status] || STATUS_TEXT.unset

  const save = async () => {
    setBusy(true)
    try {
      const next = await saveBudget(user, { category: item.category, amount: Number(draft), view_month: month })
      onSaved(next)
      setEditing(false)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      const next = await deleteBudget(user, item.id, month)
      onSaved(next)
    } catch (err) {
      onError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{item.category}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">
            {KIND_LABEL[item.kind] || 'Custom'}
            {item.isWaste && <span className="text-danger"> · leak risk</span>}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="mt-3 flex items-baseline justify-between text-xs">
        <span className={`num text-sm font-semibold ${textTone[item.status]}`}>{currency(item.spent)}</span>
        <span className="num text-faint">of {currency(item.limit)}</span>
      </div>

      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${barTone[item.status]} transition-all duration-500`}
          style={{ width: `${Math.min(100, item.percentage)}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className={textTone[item.status]}>
          {item.status === 'over'
            ? `${currency(Math.abs(item.remaining))} over`
            : `${currency(item.remaining)} left`}
        </span>
        <span className="num text-faint">{item.percentage}%</span>
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-1.5">
          <label className="sr-only" htmlFor={`budget-${item.id}`}>
            Monthly limit for {item.category}
          </label>
          <input
            id={`budget-${item.id}`}
            type="number"
            min="0"
            step="5"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
          />
          <button
            onClick={save}
            disabled={busy}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50"
            aria-label="Save budget"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setDraft(String(item.limit))
            }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
            aria-label="Cancel edit"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" /> Edit limit
          </button>
          {item.kind !== 'goal' && item.source !== 'plan' && (
            <button
              onClick={remove}
              disabled={busy}
              className="grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-danger/10 hover:text-danger disabled:opacity-50"
              aria-label={`Remove ${item.category} budget`}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Budgets({ user, onChanged }) {
  const [month, setMonth] = useState(currentMonth())
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [newAmount, setNewAmount] = useState('100')

  const load = useCallback(
    async (target = month) => {
      setLoading(true)
      setError(null)
      try {
        const data = await getBudgets(user, target)
        setState(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [user, month]
  )

  useEffect(() => {
    load(month)
  }, [month, load])

  const applyState = (next) => {
    setState(next)
    onChanged?.(next)
  }

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await generatePlan(user, month)
      applyState(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const addCategory = async (e) => {
    e.preventDefault()
    if (!newCategory.trim()) return
    setBusy(true)
    setError(null)
    try {
      const next = await saveBudget(user, {
        category: newCategory.trim(),
        amount: Number(newAmount),
        view_month: month,
      })
      applyState(next)
      setNewCategory('')
      setNewAmount('100')
      setShowAdd(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const total = state?.total
  const spendItems = useMemo(
    () => (state?.categories || []).filter((c) => c.kind !== 'goal'),
    [state]
  )
  const goal = state?.categories?.find((c) => c.kind === 'goal')
  const isCurrent = month === currentMonth()

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Plan &amp; budget</h2>
          <p className="mt-1 text-xs text-muted">
            Fixed monthly limits. Green means in control, amber is close, red is over.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-line bg-surface">
            <button
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              className="grid h-9 w-9 place-items-center rounded-l-xl text-muted hover:bg-surface-2 hover:text-ink"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="min-w-[124px] px-2 text-center text-xs font-medium text-ink">
              {state?.label || month}
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
          <Button variant="secondary" size="sm" onClick={generate} loading={busy}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Smart plan
          </Button>
        </div>
      </div>

      {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}

      {loading && !state ? (
        <Card>
          <Spinner label="Loading budgets" />
        </Card>
      ) : !state ? (
        <Card>
          <EmptyState icon={PiggyBank} title="No budget data" description="Create a plan to start tracking limits." />
        </Card>
      ) : (
        <>
          {/* Overall */}
          <Card className={total.status === 'over' ? 'border-danger/40' : total.status === 'warn' ? 'border-warn/40' : ''}>
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <Ring
                  percentage={total.percentage}
                  status={total.status}
                  spent={total.spent}
                  budget={total.budget}
                />
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-faint">Monthly plan</p>
                  <p className={`num mt-1 text-2xl font-semibold ${textTone[total.status]}`}>
                    {currency(total.spent)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    of {currency(total.budget)} planned ·{' '}
                    {total.status === 'over' ? (
                      <span className="font-medium text-danger">{currency(Math.abs(total.remaining))} over</span>
                    ) : (
                      <span className="text-muted">{currency(total.remaining)} left</span>
                    )}
                  </p>
                  {goal && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted">
                      <Target className="h-3.5 w-3.5 text-info" aria-hidden="true" />
                      Savings goal {currency(goal.limit)} / month
                    </p>
                  )}
                </div>
              </div>

              <div className="sm:max-w-xs">
                {state.alerts.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 text-xs text-accent">
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Everything is within plan. Keep it up.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {state.alerts.map((a) => (
                      <li
                        key={a.id}
                        className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                          a.status === 'over'
                            ? 'border-danger/30 bg-danger/10 text-danger'
                            : 'border-warn/30 bg-warn/10 text-warn'
                        }`}
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {a.status === 'over'
                            ? `${a.category} is ${currency(Math.abs(a.remaining))} over its limit.`
                            : `${a.category} is at ${a.percentage}% of its limit.`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>

          {/* Category grid */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">Limits by category</h3>
            <button
              onClick={() => setShowAdd((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add category
            </button>
          </div>

          {showAdd && (
            <Card>
              <form onSubmit={addCategory} className="flex flex-wrap items-end gap-2 p-4">
                <div className="min-w-[160px] flex-1">
                  <label htmlFor="new-category" className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                    Category
                  </label>
                  <input
                    id="new-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="e.g. Pet care"
                    className="h-9 w-full rounded-lg border border-line bg-canvas px-2.5 text-xs text-ink focus:border-accent/60 focus:outline-none"
                  />
                </div>
                <div className="w-28">
                  <label htmlFor="new-amount" className="mb-1 block text-[10px] uppercase tracking-wider text-faint">
                    Monthly limit
                  </label>
                  <input
                    id="new-amount"
                    type="number"
                    min="0"
                    step="5"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="h-9 w-full rounded-lg border border-line bg-canvas px-2.5 text-xs text-ink focus:border-accent/60 focus:outline-none"
                  />
                </div>
                <Button type="submit" size="sm" loading={busy}>
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
              </form>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {spendItems.map((item) => (
              <BudgetCard
                key={item.id}
                item={item}
                month={month}
                user={user}
                onSaved={applyState}
                onError={setError}
              />
            ))}
          </div>

          {state.unbudgeted.length > 0 && (
            <Card>
              <CardHeader title="Unbudgeted spending" subtitle="Categories without a fixed limit" icon={PiggyBank} />
              <ul className="divide-y divide-line/70 px-5 pb-3">
                {state.unbudgeted.map((u) => (
                  <li key={u.category} className="flex items-center justify-between py-2 text-xs">
                    <span className="text-muted">{u.category}</span>
                    <span className="num text-ink">{currency(u.spent)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
