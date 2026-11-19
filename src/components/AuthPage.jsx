import React, { useState } from 'react'
import { ShieldCheck, Wallet, ArrowRight, Eye, EyeOff, Lock, User, LineChart, CloudOff, Smartphone } from 'lucide-react'
import { login } from '../lib/api'
import { Button, ErrorNote } from '../components/ui'

const HIGHLIGHTS = [
  { icon: LineChart, title: 'Waste radar', text: 'See the leak in dining, subscriptions and fees, then project it forward.' },
  { icon: CloudOff, title: 'Local-first', text: 'Statements are parsed on your machine. No bank credentials, no cloud.' },
  { icon: Smartphone, title: 'Ready to roam', text: 'Responsive by design, with a mobile layout that works at 375px.' },
]

export default function AuthPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      onLoginSuccess(user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setUsername('demo')
    setPassword('demo123')
    setMode('login')
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-2">
        {/* Brand panel */}
        <section className="relative hidden overflow-hidden border-r border-line lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                'radial-gradient(600px 320px at 20% 10%, #22c55e1f, transparent 60%), radial-gradient(500px 300px at 90% 90%, #0ea5e91a, transparent 60%)',
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#0d9488] text-[#04140a] shadow-[0_0_24px_-4px_#22c55e77]">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold tracking-tight text-ink">MoneyTrack</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-faint">Finance OS</p>
              </div>
            </div>

            <h1 className="mt-14 max-w-md text-4xl font-semibold leading-[1.1] tracking-tight text-ink">
              Your spending, <span className="text-accent">minus the noise.</span>
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
              Import a statement, spot the leaks, and see what those small habits cost
              over ten years. Runs on a Raspberry Pi, a laptop, or a small VM.
            </p>

            <ul className="mt-10 space-y-4">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-accent">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 max-w-xs text-[11px] leading-relaxed text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-[11px] text-faint">
            SQLite by default · PostgreSQL when you scale · MIT-friendly local deployment
          </p>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-accent to-[#0d9488] text-[#04140a]">
                <Wallet className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <p className="text-sm font-bold tracking-tight text-ink">MoneyTrack</p>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              {mode === 'login' ? 'Sign in' : 'Create an account'}
            </h2>
            <p className="mt-1.5 text-xs text-muted">
              {mode === 'login'
                ? 'New here? Enter any username and password to register instantly.'
                : 'The first account created becomes the administrator.'}
            </p>

            <div className="mt-6 space-y-4">
              {error && <ErrorNote onDismiss={() => setError('')}>{error}</ErrorNote>}

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
                    Username
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="demo"
                      className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent/60 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-faint">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-11 text-sm text-ink placeholder:text-faint transition-colors focus:border-accent/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-faint transition-colors hover:text-ink"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" size="lg" loading={loading} className="w-full">
                  {mode === 'login' ? 'Continue' : 'Create account'}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                  className="text-muted underline-offset-2 hover:text-accent hover:underline"
                >
                  {mode === 'login' ? 'Register instead' : 'I already have an account'}
                </button>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="text-accent underline-offset-2 hover:underline"
                >
                  Use demo account
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <p className="text-[11px] leading-relaxed text-muted">
                  <span className="font-medium text-ink">First user becomes admin.</span>{' '}
                  Demo credentials: <span className="num text-ink">demo / demo123</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
