export const currency = (n, opts = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    ...opts,
  }).format(Number(n) || 0)

export const compactCurrency = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(n) || 0)

export const percent = (n) => `${(Number(n) || 0).toFixed(1)}%`

export const shortDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export const longDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const CATEGORY_COLORS = {
  Groceries: '#22c55e',
  'Dining Out': '#fb7185',
  Subscriptions: '#a78bfa',
  Transport: '#38bdf8',
  Utilities: '#fbbf24',
  Housing: '#2dd4bf',
  Fees: '#f97316',
  General: '#94a3b8',
}

export const categoryColor = (name) => CATEGORY_COLORS[name] || '#94a3b8'
