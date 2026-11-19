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

export async function uploadStatement(user, file) {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/transactions/upload', { user, method: 'POST', body: form, raw: true })
}
