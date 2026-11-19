import React from 'react'
import {
  LayoutDashboard,
  ReceiptText,
  UploadCloud,
  Settings as SettingsIcon,
  LogOut,
  Wallet,
  ShieldCheck,
} from 'lucide-react'

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'import', label: 'Import', icon: UploadCloud },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#0d9488] text-[#04140a] shadow-[0_0_20px_-4px_#22c55e66]">
        <Wallet className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-ink">MoneyTrack</p>
        <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Finance OS</p>
      </div>
    </div>
  )
}

export default function AppShell({ user, view, onNavigate, onLogout, period, children }) {
  const active = NAV.find((n) => n.id === view)

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-surface/50 backdrop-blur lg:flex">
        <div className="px-5 py-5">
          <Brand />
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3" aria-label="Primary">
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
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#0d9488] text-[#04140a]">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </span>
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

      {/* Bottom nav (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
        aria-label="Primary"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ id, label, icon: Icon }) => {
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
                {label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
