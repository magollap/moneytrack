import React, { useState } from 'react'
import {
  User,
  Server,
  Database,
  HardDrive,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Clock,
  Cpu,
  Trash2,
  Sparkles,
} from 'lucide-react'
import { Card, CardHeader, Badge, Button, ErrorNote } from '../components/ui'
import { loadDemo, clearDemo, clearAllTransactions } from '../lib/api'
import { longDate } from '../lib/format'

function Row({ label, value, mono = true }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 py-2.5 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={`${mono ? 'num' : ''} text-right text-xs text-ink`}>{value}</span>
    </div>
  )
}

function uptime(seconds = 0) {
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

const PLATFORM_LABEL = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' }

export default function Settings({ user, status, onStatusRefresh, onLogout, onDataChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const reloadDemo = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await loadDemo(user)
      await onDataChanged()
      setNotice('Demo dataset regenerated with 90 days of transactions.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeDemo = async () => {
    if (
      !window.confirm(
        'Remove all demo data? Statements and transactions you uploaded or added are kept.'
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await clearDemo(user)
      await onDataChanged()
      setNotice(
        `Removed ${result.removed} demo transaction${result.removed === 1 ? '' : 's'}. Your own data is untouched.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const clearEverything = async () => {
    if (
      !window.confirm(
        'Delete every transaction for this profile? Accounts are kept, but all uploaded, manual and demo transactions are removed.'
      )
    ) {
      return
    }
    if (!window.confirm('This cannot be undone. Delete all transactions now?')) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const result = await clearAllTransactions(user)
      await onDataChanged()
      setNotice(`Deleted ${result.removed} transaction${result.removed === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-ink">Settings</h2>
        <p className="mt-1 text-xs text-muted">Account, runtime and data controls.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" subtitle="Local profile" icon={User} />
          <div className="px-5 pb-4">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-sm font-semibold uppercase text-accent">
                {user.username.slice(0, 2)}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{user.username}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {user.isAdmin ? (
                    <Badge tone="accent">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Administrator
                    </Badge>
                  ) : (
                    <Badge>Member</Badge>
                  )}
                </div>
              </div>
            </div>
            <Row label="User ID" value={`${user.id.slice(0, 8)}…`} />
            <Row label="Joined" value={user.createdAt ? longDate(user.createdAt) : '—'} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Runtime"
            subtitle="Local service health"
            icon={Server}
            action={
              <button
                onClick={onStatusRefresh}
                className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-accent"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" /> Refresh
              </button>
            }
          />
          <div className="px-5 pb-4">
            <Row label="Status" value={
              <span className="inline-flex items-center gap-1.5 text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {status?.status || 'unknown'}
              </span>
            } mono={false} />
            <Row label="Version" value={status?.version || '—'} />
            <Row label="Database" value={(status?.db_type || 'sqlite').toUpperCase()} />
            <Row label="Platform" value={PLATFORM_LABEL[status?.platform] || status?.platform || '—'} />
            <Row label="Uptime" value={uptime(status?.uptime_seconds)} />
            <Row label="Memory" value={status?.memory_usage_mb != null ? `${status.memory_usage_mb} MB` : '—'} />
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Data" subtitle="Everything stays on this machine" icon={Database} />
        <div className="space-y-3 px-5 pb-5">
          <div className="rounded-xl border border-line bg-canvas/50 p-3.5">
            <div className="flex items-start gap-2.5">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-info" aria-hidden="true" />
              <div className="text-xs text-muted">
                <p className="font-medium text-ink">SQLite file: prisma/dev.db</p>
                <p className="mt-1">
                  Back it up by copying that single file. Prisma is configured to switch to
                  PostgreSQL by changing one line in <span className="num text-[11px] text-ink">schema.prisma</span>{' '}
                  — useful once you import years of history.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={reloadDemo} loading={busy}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Regenerate demo data
            </Button>
            <Button variant="secondary" size="sm" onClick={removeDemo} loading={busy}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove demo data
            </Button>
            <Button variant="danger" size="sm" onClick={clearEverything} loading={busy}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear all transactions
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>

          <p className="text-[11px] leading-relaxed text-faint">
            “Remove demo data” only deletes generated demo rows and the demo account. Statements you
            imported and transactions you added manually are kept.
          </p>

          {notice && (
            <p className="flex items-center gap-1.5 text-xs text-accent" role="status">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {notice}
            </p>
          )}
          {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}
        </div>
      </Card>

      <div className="flex items-center gap-2 text-[11px] text-faint">
        <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
        Designed for Raspberry Pi, small VMs, Windows, macOS and Linux.
      </div>
    </div>
  )
}
