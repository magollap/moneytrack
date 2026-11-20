import React, { useState } from 'react'
import {
  Landmark,
  CreditCard,
  Plus,
  Trash2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  ShieldCheck,
} from 'lucide-react'
import { Card, CardHeader, Button, Badge, ErrorNote, EmptyState } from '../components/ui'
import { createAccount, deleteAccount } from '../lib/api'
import { currency } from '../lib/format'

const TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'cash', label: 'Cash' },
]

const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]))

const EMPTY = {
  name: '',
  institution: '',
  type: 'checking',
  last4: '',
  opening_balance: '0',
}

function AccountIcon({ type, className = 'h-4 w-4' }) {
  return type === 'credit_card' ? (
    <CreditCard className={className} aria-hidden="true" />
  ) : (
    <Landmark className={className} aria-hidden="true" />
  )
}

export default function Accounts({ user, accounts, accountScope, onChanged, onScopeReset }) {
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState(null)

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await createAccount(user, {
        name: form.name,
        institution: form.institution,
        type: form.type,
        last4: form.last4,
        opening_balance: Number(form.opening_balance) || 0,
      })
      setForm(EMPTY)
      await onChanged(result.accounts)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (account) => {
    if (!window.confirm(`Delete "${account.name}"? Its transactions will stay, but become unassigned.`)) {
      return
    }
    setDeleting(account.id)
    setError(null)
    try {
      const result = await deleteAccount(user, account.id)
      if (accountScope === account.id && onScopeReset) onScopeReset()
      await onChanged(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(null)
    }
  }

  const list = accounts?.accounts || []
  const totals = accounts?.totals
  const unassigned = accounts?.unassigned

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">Accounts</h2>
          <p className="mt-1 text-xs text-muted">
            Add every bank account and card. Statements are matched to accounts, and the
            dashboard can show them together or one at a time.
          </p>
        </div>
        <Badge tone="accent">
          <Wallet className="h-3 w-3" aria-hidden="true" />
          Total {currency(totals?.balance || 0)}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Your accounts"
            subtitle={`${list.length} account${list.length === 1 ? '' : 's'} · balance = opening + money in − money out`}
            icon={Landmark}
          />
          {list.length === 0 ? (
            <EmptyState
              icon={Landmark}
              title="No accounts yet"
              description="Add your bank account or credit card, then import its statement. You can also let the importer create an account from statement details."
            />
          ) : (
            <ul className="divide-y divide-line/70 px-4 pb-4">
              {list.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
                      <AccountIcon type={a.type} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-ink">{a.name}</p>
                        <Badge tone={a.type === 'credit_card' ? 'warn' : 'neutral'}>
                          {TYPE_LABEL[a.type] || a.type}
                        </Badge>
                        {a.is_demo && <Badge tone="info">Demo</Badge>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-faint">
                        {a.institution}
                        {a.last4 ? ` ••${a.last4}` : ''} · {a.transaction_count} transactions
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                        <span className="flex items-center gap-1 text-accent">
                          <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                          In {currency(a.money_in)}
                        </span>
                        <span className="flex items-center gap-1 text-muted">
                          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                          Out {currency(a.money_out)}
                        </span>
                        <span className="text-faint">Opening {currency(a.opening_balance)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <p
                        className={`num text-sm font-semibold ${
                          a.balance >= 0 ? 'text-ink' : 'text-danger'
                        }`}
                      >
                        {currency(a.balance)}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onSelectAccount(a.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:border-accent/50 hover:text-accent"
                        >
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          View
                        </button>
                        <button
                          onClick={() => remove(a)}
                          disabled={deleting === a.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[10px] text-muted transition-colors hover:border-danger/50 hover:text-danger"
                          aria-label={`Delete ${a.name}`}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {unassigned?.transaction_count > 0 && (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-[11px] text-warn">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {unassigned.transaction_count} transaction
                {unassigned.transaction_count === 1 ? '' : 's'} are not assigned to an account.
                Open Transactions and pick an account for them.
              </span>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Add an account" subtitle="Bank, savings, card or cash" icon={Plus} />
          <form onSubmit={submit} className="space-y-3 px-5 pb-5">
            <label className="block">
              <span className="text-[11px] text-muted">Account name</span>
              <input
                required
                value={form.name}
                onChange={update('name')}
                placeholder="Everyday checking"
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted">Institution</span>
              <input
                value={form.institution}
                onChange={update('institution')}
                placeholder="Northwind Bank"
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-muted">Type</span>
                <select
                  value={form.type}
                  onChange={update('type')}
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-2 text-xs text-ink focus:border-accent/60 focus:outline-none"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted">Last 4</span>
                <input
                  value={form.last4}
                  onChange={update('last4')}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4821"
                  className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-[11px] text-muted">Opening balance</span>
              <input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={update('opening_balance')}
                className="mt-1 h-9 w-full rounded-lg border border-line bg-canvas px-3 text-xs text-ink focus:border-accent/60 focus:outline-none"
              />
            </label>
            <p className="text-[10px] leading-relaxed text-faint">
              Set the balance on the day before the first imported transaction. Later
              transactions add or subtract automatically.
            </p>
            <Button type="submit" size="sm" loading={busy} className="w-full">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add account
            </Button>
            {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}
          </form>
        </Card>
      </div>
    </div>
  )
}
