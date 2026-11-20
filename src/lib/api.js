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

export const getSummary = (user, accountId) =>
  apiFetch(`/analytics/summary${accountId && accountId !== 'all' ? `?account_id=${encodeURIComponent(accountId)}` : ''}`, { user })
export const getTransactions = (user, accountId) =>
  apiFetch(`/transactions${accountId && accountId !== 'all' ? `?account_id=${encodeURIComponent(accountId)}` : ''}`, { user })
export const loadDemo = (user) => apiFetch('/demo/load', { method: 'POST', user })
export const clearDemo = (user) => apiFetch('/demo/clear', { method: 'POST', user })
export const getStatus = (user) => apiFetch('/system/status', { user })

export const getAccounts = (user) => apiFetch('/accounts', { user })
export const createAccount = (user, body) =>
  apiFetch('/accounts', { user, method: 'POST', body })
export const updateAccount = (user, id, body) =>
  apiFetch(`/accounts/${id}`, { user, method: 'PATCH', body })
export const deleteAccount = (user, id) =>
  apiFetch(`/accounts/${id}`, { user, method: 'DELETE' })

export const createTransaction = (user, body) =>
  apiFetch('/transactions', { user, method: 'POST', body })
export const updateTransaction = (user, id, body) =>
  apiFetch(`/transactions/${id}`, { user, method: 'PATCH', body })
export const deleteTransaction = (user, id) =>
  apiFetch(`/transactions/${id}`, { user, method: 'DELETE' })
export const clearAllTransactions = (user) =>
  apiFetch('/transactions/all', { user, method: 'DELETE' })

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

export async function uploadStatement(user, file, accountId) {
  const form = new FormData()
  form.append('file', file)
  if (accountId && accountId !== 'auto') form.append('account_id', accountId)
  return apiFetch('/transactions/upload', { user, method: 'POST', body: form, raw: true })
}
