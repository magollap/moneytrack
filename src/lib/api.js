const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function apiPath(path) {
  return `/api/v1${path}`
}

export async function apiFetch(path, { user, method = 'GET', body, headers = {}, raw } = {}) {
  const res = await fetch(apiPath(path), {
    method,
    headers: {
      ...(raw ? {} : JSON_HEADERS),
      ...(user ? { 'x-user-id': user.id } : {}),
      ...headers,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  })

  let payload
  try {
    payload = await res.json()
  } catch {
    throw new Error(`Unexpected response (${res.status})`)
  }

  if (!res.ok || payload.success === false) {
    throw new Error(payload.error || `Request failed (${res.status})`)
  }
  return payload.data
}

export const login = (username, password) =>
  apiFetch('/auth/login', { method: 'POST', body: { username, password } })

export const getSummary = (user) => apiFetch('/analytics/summary', { user })
export const getTransactions = (user) => apiFetch('/transactions', { user })
export const loadDemo = (user) => apiFetch('/demo/load', { method: 'POST', user })
export const getStatus = (user) => apiFetch('/system/status', { user })

export const getBudgets = (user, month) =>
  apiFetch(`/budgets${month ? `?month=${month}` : ''}`, { user })
export const saveBudget = (user, { category, amount, month, view_month }) =>
  apiFetch('/budgets', { user, method: 'POST', body: { category, amount, month, view_month } })
export const deleteBudget = (user, id, month) =>
  apiFetch(`/budgets/${id}${month ? `?month=${month}` : ''}`, { user, method: 'DELETE' })
export const generatePlan = (user, month) =>
  apiFetch('/budgets/generate', { user, method: 'POST', body: { month } })

export const getReport = (user, month) =>
  apiFetch(`/reports${month ? `?month=${month}` : ''}`, { user })

export const getAiStatus = (user, refresh = false) =>
  apiFetch(`/ai/status${refresh ? '?refresh=true' : ''}`, { user })
export const askAi = (user, question, month) =>
  apiFetch('/ai/ask', { user, method: 'POST', body: { question, month } })

export async function uploadStatement(user, file) {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/transactions/upload', { user, method: 'POST', body: form, raw: true })
}
