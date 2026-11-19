// Answering engine: Ollama first, then the local Python skill, then a JS fallback.
// Everything runs on the user's machine; no data leaves it.

import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SKILL_PATH = path.resolve(__dirname, '..', '..', 'skills', 'spend_skill.py')

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '')
let ollamaCache = { at: 0, value: null }
let pythonCache = { at: 0, command: null }

export async function detectOllama({ force = false } = {}) {
  if (!force && ollamaCache.value && Date.now() - ollamaCache.at < 20000) {
    return ollamaCache.value
  }

  let value = { available: false, model: null, models: [], url: OLLAMA_URL }
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) })
    if (res.ok) {
      const body = await res.json()
      const models = (body.models || []).map((m) => m.name)
      value = {
        available: models.length > 0,
        model: process.env.OLLAMA_MODEL || models[0] || null,
        models,
        url: OLLAMA_URL,
      }
    }
  } catch {
    // Ollama not running — fine, we fall back.
  }
  ollamaCache = { at: Date.now(), value }
  return value
}

async function detectPython() {
  if (pythonCache.command) return pythonCache.command
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
  for (const cmd of candidates) {
    const ok = await new Promise((resolve) => {
      const child = spawn(cmd, ['--version'], { stdio: 'ignore' })
      const timer = setTimeout(() => {
        child.kill()
        resolve(false)
      }, 2500)
      child.on('error', () => {
        clearTimeout(timer)
        resolve(false)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve(code === 0)
      })
    })
    if (ok) {
      pythonCache.command = cmd
      return cmd
    }
  }
  return null
}

export async function aiStatus({ force = false } = {}) {
  const [ollama, python] = await Promise.all([detectOllama({ force }), detectPython()])
  return {
    ollama,
    python: { available: Boolean(python), command: python, skill: 'skills/spend_skill.py' },
    preferred: ollama.available ? 'ollama' : python ? 'python-skill' : 'local-js',
  }
}

function runPythonSkill(payload) {
  return new Promise(async (resolve, reject) => {
    const command = await detectPython()
    if (!command) return reject(new Error('Python is not available'))

    const child = spawn(command, [SKILL_PATH], { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Python skill timed out'))
    }, 20000)

    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(stderr || `Python skill exited with ${code}`))
      try {
        resolve(JSON.parse(stdout))
      } catch (err) {
        reject(new Error('Python skill returned invalid JSON'))
      }
    })

    child.stdin.end(JSON.stringify(payload))
  })
}

export async function askAi({ question, context, rows, budgets }) {
  const started = Date.now()
  const ollama = await detectOllama()

  if (ollama.available) {
    try {
      const answer = await askOllama(question, context, ollama.model)
      return {
        answer,
        engine: 'ollama',
        model: ollama.model,
        latency_ms: Date.now() - started,
      }
    } catch (err) {
      // fall through to local skills
      console.warn('Ollama failed, falling back:', err.message)
    }
  }

  const payload = {
    question,
    today: new Date().toISOString().slice(0, 10),
    transactions: rows.map((t) => ({
      date: new Date(t.date).toISOString().slice(0, 10),
      description: t.description,
      amount: Number(t.amount),
      category: t.category,
      is_waste: Boolean(t.isWaste),
    })),
    budgets: budgets.categories.map((b) => ({
      category: b.category,
      limit: b.limit,
      spent: b.spent,
      status: b.status,
      kind: b.kind,
    })),
  }

  try {
    const result = await runPythonSkill(payload)
    return {
      answer: result.answer,
      engine: 'python-skill',
      model: null,
      intent: result.intent,
      latency_ms: Date.now() - started,
    }
  } catch (err) {
    const result = localAnswer(question, rows, budgets)
    return {
      answer: result.answer,
      engine: 'local-js',
      model: null,
      intent: result.intent,
      latency_ms: Date.now() - started,
      note: err.message,
    }
  }
}

async function askOllama(question, context, model) {
  const system = [
    "You are MoneyTrack, a private personal-finance assistant running on the user's own machine.",
    'Answer ONLY from the DATA JSON. Never invent numbers or categories.',
    'Use USD with two decimals. Be direct: 2-4 short sentences, no markdown tables.',
    'If the data cannot answer the question, say exactly what is missing.',
    `Today is ${context.today}.`,
  ].join(' ')

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      keep_alive: '10m',
      options: { temperature: 0.2, num_predict: 180 },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: `DATA:\n${JSON.stringify(context)}\n\nQUESTION: ${question}`,
        },
      ],
    }),
  })

  if (!res.ok) throw new Error(`Ollama responded ${res.status}`)
  const body = await res.json()
  const answer = body?.message?.content?.trim()
  if (!answer) throw new Error('Ollama returned an empty answer')
  return answer
}

// ---------- Local JS fallback ----------

const CATEGORY_WORDS = [
  ['Dining Out', /(dining|eating out|restaurant|takeaway|takeout|delivery|doordash|uber eats|coffee)/],
  ['Groceries', /(grocer|supermarket|food shop|food at home)/],
  ['Subscriptions', /(subscription|streaming|netflix|spotify)/],
  ['Transport', /(transport|fuel|gas|petrol|uber|lyft|transit|parking)/],
  ['Utilities', /(utilit|electric|water|internet|phone bill)/],
  ['Housing', /(housing|rent|mortgage)/],
  ['Clothing', /(clothing|clothes|apparel|shoes)/],
  ['Health & Fitness', /(health|fitness|gym|pharmacy|medical)/],
  ['Entertainment', /(entertainment|games|cinema|movies|events)/],
  ['Fees', /(fees?|charges?|overdraft)/],
  ['Miscellaneous', /(misc|household|amazon|target)/],
  ['Savings', /(savings?|save)/],
]

function detectCategory(q) {
  for (const [name, re] of CATEGORY_WORDS) if (re.test(q)) return name
  return null
}

function periodFor(question, now = new Date(), from, to) {
  const q = question.toLowerCase()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()

  if (/(last|previous) month/.test(q)) {
    return { key: 'last month', from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) }
  }
  if (/this month/.test(q)) {
    return { key: 'this month', from: new Date(Date.UTC(y, m, 1)), to: new Date(Date.UTC(y, m + 1, 1)) }
  }
  if (/(last|past) week/.test(q)) {
    const end = new Date(now)
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    return { key: 'the last 7 days', from: start, to: end }
  }
  if (/this year/.test(q)) {
    return { key: 'this year', from: new Date(Date.UTC(y, 0, 1)), to: new Date(Date.UTC(y + 1, 0, 1)) }
  }
  if (/(last|past) year/.test(q)) {
    return { key: 'last year', from: new Date(Date.UTC(y - 1, 0, 1)), to: new Date(Date.UTC(y, 0, 1)) }
  }
  if (/(last|past) 90|three months|3 months/.test(q)) {
    const start = new Date(now)
    start.setDate(start.getDate() - 90)
    return { key: 'the last 90 days', from: start, to: now }
  }
  if (/(last|past) 30|a month/.test(q)) {
    const start = new Date(now)
    start.setDate(start.getDate() - 30)
    return { key: 'the last 30 days', from: start, to: now }
  }
  if (from && to) return { key: 'last month', from: new Date(from), to: new Date(to) }
  const start = new Date(Date.UTC(y, m, 1))
  return { key: 'this month', from: start, to: new Date(Date.UTC(y, m + 1, 1)) }
}

const money = (n) => `$${Number(n).toFixed(2)}`

function localAnswer(question, rows, budgets, now = new Date()) {
  const q = String(question || '').toLowerCase()
  const category = detectCategory(q)
  const period = periodFor(q, now, budgets.monthStart, budgets.monthEnd)

  const inPeriod = rows.filter((t) => {
    const d = new Date(t.date)
    return d >= period.from && d < period.to
  })

  const sum = (list) => list.reduce((a, t) => a + Math.abs(Number(t.amount) || 0), 0)
  const scoped = category ? inPeriod.filter((t) => t.category === category) : inPeriod
  const total = sum(scoped)

  if (/(budget|limit|left|remaining|over)/.test(q)) {
    const item = category
      ? budgets.categories.find((c) => c.category === category)
      : null
    if (item) {
      if (item.status === 'over') {
        return {
          intent: 'budget',
          answer: `${category} is over budget: ${money(item.spent)} spent against a ${money(item.limit)} limit (${money(Math.abs(item.remaining))} over).`,
        }
      }
      return {
        intent: 'budget',
        answer: `${category} sits at ${money(item.spent)} of its ${money(item.limit)} limit — ${money(item.remaining)} left this month (${item.percentage}% used).`,
      }
    }
    const t = budgets.total
    return {
      intent: 'budget',
      answer:
        t.status === 'over'
          ? `You are ${money(Math.abs(t.remaining))} over the ${money(t.budget)} plan this month (${t.percentage}% used).`
          : `You have ${money(t.remaining)} left of the ${money(t.budget)} plan this month (${t.percentage}% used).`,
    }
  }

  if (/(waste|leak|wasting)/.test(q)) {
    const waste = sum(inPeriod.filter((t) => t.isWaste))
    return {
      intent: 'waste',
      answer: `Waste in ${period.key} was ${money(waste)} across ${inPeriod.filter((t) => t.isWaste).length} transactions.`,
    }
  }

  if (/(top|most|where|merchant|biggest)/.test(q)) {
    const map = new Map()
    for (const t of scoped) {
      map.set(t.description, (map.get(t.description) || 0) + Math.abs(Number(t.amount) || 0))
    }
    const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    if (!top.length) {
      return { intent: 'merchants', answer: `No spending found in ${period.key}${category ? ` for ${category}` : ''}.` }
    }
    return {
      intent: 'merchants',
      answer: `Top ${category || 'spending'} merchants in ${period.key}: ${top
        .map(([name, amount]) => `${name} (${money(amount)})`)
        .join(', ')}.`,
    }
  }

  if (/(how many|count|number of)/.test(q)) {
    return {
      intent: 'count',
      answer: `${scoped.length} transaction${scoped.length === 1 ? '' : 's'}${category ? ` for ${category}` : ''} in ${period.key}.`,
    }
  }

  if (/(compare|versus|vs\.?|more than|less than|change)/.test(q)) {
    const prev = periodFor('last month', now)
    const prevRows = rows.filter((t) => {
      const d = new Date(t.date)
      return d >= prev.from && d < prev.to && (!category || t.category === category)
    })
    const prevTotal = sum(prevRows)
    if (!prevTotal) {
      return {
        intent: 'compare',
        answer: `${category || 'Spending'} was ${money(total)} in ${period.key}; there is no previous-month baseline to compare against.`,
      }
    }
    const delta = total - prevTotal
    const pct = ((delta / prevTotal) * 100).toFixed(1)
    return {
      intent: 'compare',
      answer: `${category || 'Spending'} in ${period.key} was ${money(total)}, ${delta >= 0 ? 'up' : 'down'} ${money(Math.abs(delta))} (${Math.abs(pct)}%) versus last month.`,
    }
  }

  const count = scoped.length
  return {
    intent: 'total',
    answer: category
      ? `You spent ${money(total)} on ${category} in ${period.key} across ${count} transaction${count === 1 ? '' : 's'}.`
      : `You spent ${money(total)} in ${period.key} across ${count} transaction${count === 1 ? '' : 's'}.`,
  }
}
