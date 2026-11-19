import React, { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  Send,
  Cpu,
  RefreshCw,
  ShieldCheck,
  Bot,
  User as UserIcon,
  FlaskConical,
  CircleAlert,
} from 'lucide-react'
import { Card, Badge, Button, ErrorNote } from '../components/ui'
import { getAiStatus, askAi } from '../lib/api'

const SUGGESTIONS = [
  'How much did I spend on groceries last month?',
  'Where is my biggest leak this month?',
  'Compare dining out with last month',
  'Am I over budget on clothing?',
  'What are my top merchants this month?',
]

const ENGINE_META = {
  ollama: { label: 'Ollama', tone: 'accent', icon: Cpu },
  'python-skill': { label: 'Python skill', tone: 'info', icon: FlaskConical },
  'local-js': { label: 'Local rules', tone: 'neutral', icon: Sparkles },
}

export default function AiSkills({ user }) {
  const [status, setStatus] = useState(null)
  const [statusBusy, setStatusBusy] = useState(false)
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const endRef = useRef(null)

  const loadStatus = async (refresh = false) => {
    setStatusBusy(true)
    try {
      const data = await getAiStatus(user, refresh)
      setStatus(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setStatusBusy(false)
    }
  }

  useEffect(() => {
    loadStatus(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const ask = async (text) => {
    const q = (text ?? question).trim()
    if (!q || busy) return
    setQuestion('')
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', text: q }])
    setBusy(true)
    try {
      const result = await askAi(user, q)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.answer,
          engine: result.engine,
          latency: result.latency_ms,
        },
      ])
      if (result.engine_status) setStatus(result.engine_status)
    } catch (err) {
      setError(err.message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `I could not answer that: ${err.message}`, engine: 'local-js' },
      ])
    } finally {
      setBusy(false)
    }
  }

  const preferred = status?.preferred || 'local-js'
  const meta = ENGINE_META[preferred] || ENGINE_META['local-js']

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-ink">AI skills</h2>
          <p className="mt-1 text-xs text-muted">
            Ask about your own numbers. Runs against local Ollama when available, then the Python skill, then built-in rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={meta.tone}>
            <meta.icon className="h-3 w-3" aria-hidden="true" />
            {preferred === 'ollama'
              ? `Ollama · ${status?.ollama?.model || 'local'}`
              : meta.label}
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => loadStatus(true)} loading={statusBusy}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Check engines
          </Button>
        </div>
      </div>

      {error && <ErrorNote onDismiss={() => setError(null)}>{error}</ErrorNote>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex h-[440px] flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/10 text-accent">
                    <Sparkles className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Ask your ledger anything</p>
                    <p className="mt-1 max-w-sm text-xs text-muted">
                      Try a category plus a time range, ask about budgets, or compare two months.
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.slice(0, 3).map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => {
                const isUser = m.role === 'user'
                const engine = m.engine ? ENGINE_META[m.engine] : null
                return (
                  <div key={idx} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && (
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                        <Bot className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                    <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                          isUser
                            ? 'rounded-br-md bg-accent text-[#04140a]'
                            : 'rounded-bl-md border border-line bg-surface-2 text-ink'
                        }`}
                      >
                        {m.text}
                      </div>
                      {!isUser && engine && (
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-faint">
                          <engine.icon className="h-3 w-3" aria-hidden="true" />
                          {engine.label}
                          {m.latency ? ` · ${(m.latency / 1000).toFixed(1)}s` : ''}
                        </p>
                      )}
                    </div>
                    {isUser && (
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                        <UserIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                )
              })}

              {busy && (
                <div className="flex items-center gap-2.5 text-xs text-muted" role="status">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/10 text-accent">
                    <Bot className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:300ms]" />
                    Thinking locally{preferred === 'ollama' ? ' — the local model can take ~30s' : ''}…
                  </span>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                ask()
              }}
              className="flex items-center gap-2 border-t border-line p-3"
            >
              <label htmlFor="ai-question" className="sr-only">
                Ask a question about your spending
              </label>
              <input
                id="ai-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. how much did I spend on groceries last month?"
                maxLength={500}
                className="h-10 flex-1 rounded-xl border border-line bg-canvas px-3 text-xs text-ink placeholder:text-faint focus:border-accent/60 focus:outline-none"
              />
              <Button type="submit" size="md" loading={busy} disabled={!question.trim()}>
                <Send className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Ask</span>
              </Button>
            </form>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-ink">Suggested questions</p>
              <ul className="mt-2.5 space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => ask(s)}
                      disabled={busy}
                      className="w-full rounded-lg border border-line bg-canvas/40 px-2.5 py-2 text-left text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-ink">Engines</p>
              <ul className="mt-2.5 space-y-2.5 text-[11px]">
                <li className="flex items-start gap-2">
                  <Cpu className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${status?.ollama?.available ? 'text-accent' : 'text-faint'}`} aria-hidden="true" />
                  <div>
                    <p className="text-ink">Ollama {status?.ollama?.available ? 'ready' : 'offline'}</p>
                    <p className="text-faint">
                      {status?.ollama?.available
                        ? `${status.ollama.model} at ${status.ollama.url}`
                        : 'Start Ollama to use a local model.'}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <FlaskConical className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${status?.python?.available ? 'text-info' : 'text-faint'}`} aria-hidden="true" />
                  <div>
                    <p className="text-ink">Python skill {status?.python?.available ? 'ready' : 'missing'}</p>
                    <p className="text-faint">skills/spend_skill.py · offline rules</p>
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                  <div>
                    <p className="text-ink">Built-in rules</p>
                    <p className="text-faint">Always available fallback</p>
                  </div>
                </li>
              </ul>
            </div>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <p className="text-[11px] leading-relaxed text-muted">
              <span className="font-medium text-ink">Private by design.</span> Questions and aggregates stay on
              this machine, including when Ollama answers.
            </p>
          </div>

          {!status?.ollama?.available && status?.python?.available === false && (
            <p className="flex items-start gap-1.5 text-[11px] text-warn">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Install Python 3 or start Ollama for smarter answers; built-in rules still work.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
