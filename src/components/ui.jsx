import React from 'react'
import { Loader2 } from 'lucide-react'

export function Card({ children, className = '', hover = false, ...rest }) {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted leading-snug">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-line',
    accent: 'bg-accent/10 text-accent border-accent/30',
    danger: 'bg-danger/10 text-danger border-danger/30',
    warn: 'bg-warn/10 text-warn border-warn/30',
    info: 'bg-info/10 text-info border-info/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  ...rest
}) {
  const variants = {
    primary: 'bg-accent text-[#04140a] hover:bg-[#2ee06a] font-semibold',
    secondary: 'bg-surface-2 text-ink border border-line-strong hover:border-accent/50 hover:text-accent',
    ghost: 'text-muted hover:text-ink hover:bg-surface-2',
    danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
  }
  const sizes = {
    sm: 'h-9 px-3 text-xs gap-1.5',
    md: 'h-11 px-4 text-sm gap-2',
    lg: 'h-12 px-5 text-sm gap-2',
  }
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

export function ErrorNote({ children, onDismiss }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-xs text-danger"
    >
      <span>{children}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 underline hover:no-underline">
          Dismiss
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {Icon && (
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
