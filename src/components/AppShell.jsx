import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ReceiptText,
  PiggyBank,
  BarChart3,
  Sparkles,
  UploadCloud,
  Settings as SettingsIcon,
  LogOut,
  Wallet,
  ShieldCheck,
  MoreHorizontal,
  X,
  Landmark,
  CreditCard,
  Plus,
} from 'lucide-react'
import { currency } from '../lib/format'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'budgets', label: 'Plan & Budget', icon: PiggyBank },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'ai', label: 'AI Skills', icon: Sparkles },
  { id: 'import', label: 'Import', icon: UploadCloud },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

const MOBILE_PRIMARY = ['overview', 'transactions', 'budgets', 'ai']

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#0d9488] text-[#04140a] shadow-[0_0_20px_-4px_#22c55e66]">
        <Wallet className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-ink">MoneyTrack</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Finance OS</p>
        </div>
      )}
    </div>
  )
}

export default function AppShell({
  user,
  view,
  onNavigate,
  onLogout,
  period,
  accounts,
  accountScope = 'all',
  onSelectAccount,
  children,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const active = NAV.find((n) => n.id === view)
  const moreActive = ['accounts', 'reports', 'import', 'settings'].includes(view)
  const accountList = accounts?.accounts || []
  const totals = accounts?.totals
  const unassigned = accounts?.unassigned

  const selectAccount = (id) => {
    setMoreOpen(false)
    if (onSelectAccount) onSelectAccount(id)
  }

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e) => e.key === 'Escape' && setMoreOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moreOpen])

  const go = (id) => {
    setMoreOpen(false)
    onNavigate(id)
  }

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface/50 backdrop-blur lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>

        <nav className="mt-1 flex-1 space-y-1 overflow-y-auto px-3" aria-label="Primary">
          {NAV.map(({ id, label, icon: Icon }) => {
            const isActive = view === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-200 ${
                  isActive
                    ? 'bg-accent/10 font-medium text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />
                )}
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {label}
              </button>
            )
          })}

          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-center justify-between px-3 pb-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Accounts</p>
              <button
                onClick={() => onNavigate('accounts')}
                className="inline-flex items-center gap-0.5 text-[10px] text-muted hover:text-accent"
              >
                <Plus className="h-3 w-3" aria-hidden="true" /> Manage
              </button>
            </div>

            <button
              onClick={() => selectAccount('all')}
              aria-current={accountScope === 'all' ? 'true' : undefined}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                accountScope === 'all'
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-ink'
              }`}
            >
              <span className="truncate">All accounts</span>
              <span className="num shrink-0 text-[11px]">{currency(totals?.balance || 0)}</span>
            </button>

            {accountList.map((a) => {
              const Icon = a.type === 'credit_card' ? CreditCard : Landmark
              const isActive = accountScope === a.id
              return (
                <button
                  key={a.id}
                  onClick={() => selectAccount(a.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                    isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink'
                  }`}
                  title={`${a.institution}${a.last4 ? ` ••${a.last4}` : ''}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="num shrink-0 text-[11px]">{currency(a.balance)}</span>
                </button>
              )
            })}

            {unassigned?.transaction_count > 0 && (
              <button
                onClick={() => selectAccount('unassigned')}
                aria-current={accountScope === 'unassigned' ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                  accountScope === 'unassigned'
                    ? 'bg-warn/10 text-warn'
                    : 'text-muted hover:bg-surface-2 hover:text-ink'
                }`}
              >
                <span className="truncate">Unassigned</span>
                <span className="num shrink-0 text-[11px]">{unassigned.transaction_count}</span>
              </button>
            )}

            {accountList.length === 0 && (
              <button
                onClick={() => onNavigate('accounts')}
                className="mx-2 mt-1 flex w-[calc(100%-1rem)] items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-muted hover:border-accent/50 hover:text-accent"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add your first account
              </button>
            )}
          </div>
        </nav>

        <div className="px-3 pb-4">
          <div className="rounded-xl border border-line bg-surface-2/60 p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-xs font-semibold uppercase text-accent">
                {user.username.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink">{user.username}</p>
                <p className="flex items-center gap-1 text-[10px] text-faint">
                  {user.isAdmin ? (
                    <>
                      <ShieldCheck className="h-3 w-3 text-accent" aria-hidden="true" /> Admin
                    </>
                  ) : (
                    'Member'
                  )}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 md:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="lg:hidden">
                <Brand compact />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-tight text-ink md:text-lg">
                  {active?.label}
                </h1>
                <p className="hidden text-[11px] text-faint sm:block">{period || 'Your money, explained.'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] uppercase tracking-wider text-faint sm:inline">
                Local-first
              </span>
              <span
                className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-[11px] font-semibold uppercase text-accent lg:hidden"
                title={user.username}
              >
                {user.username.slice(0, 2)}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-6 md:pt-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* More sheet (mobile) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More destinations"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            <div className="flex items-center justify-between px-5 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="px-2">
              {NAV.filter((n) => ['accounts', 'reports', 'import', 'settings'].includes(n.id)).map(
                ({ id, label, icon: Icon }) => (
                  <li key={id}>
                    <button
                      onClick={() => go(id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-ink transition-colors hover:bg-surface-2"
                    >
                      <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
                      {label}
                    </button>
                  </li>
                )
              )}
              <li className="mt-1 border-t border-line pt-1">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-danger transition-colors hover:bg-danger/10"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Bottom nav (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        aria-label="Primary"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.id)).map(({ id, label, icon: Icon }) => {
            const isActive = view === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-accent' : 'text-faint hover:text-muted'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label === 'Plan & Budget' ? 'Budget' : label === 'AI Skills' ? 'AI' : label}
              </button>
            )
          })}
          <button
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${
              moreActive ? 'text-accent' : 'text-faint hover:text-muted'
            }`}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            More
          </button>
        </div>
      </nav>
    </div>
  )
}
