import React, { useCallback, useEffect, useMemo, useState } from 'react'
import AuthPage from './components/AuthPage'
import AppShell from './components/AppShell'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Reports from './pages/Reports'
import AiSkills from './pages/AiSkills'
import Import from './pages/Import'
import Settings from './pages/Settings'
import { getSummary, getTransactions, getStatus, getBudgets } from './lib/api'

const VIEWS = ['overview', 'transactions', 'budgets', 'reports', 'ai', 'import', 'settings']

function viewFromHash() {
  const hash = window.location.hash.replace('#', '')
  return VIEWS.includes(hash) ? hash : 'overview'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState(viewFromHash)
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((next) => {
    window.location.hash = next
    setView(next)
  }, [])

  const loadData = useCallback(async (currentUser, { silent = false } = {}) => {
    if (!currentUser) return
    silent ? setRefreshing(true) : setLoading(true)
    setError(null)

    const [summaryRes, txRes, statusRes, budgetRes] = await Promise.allSettled([
      getSummary(currentUser),
      getTransactions(currentUser),
      getStatus(currentUser),
      getBudgets(currentUser),
    ])

    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value)
    if (txRes.status === 'fulfilled') setTransactions(txRes.value)
    if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
    if (budgetRes.status === 'fulfilled') setBudgets(budgetRes.value)

    if (summaryRes.status === 'rejected') setError(summaryRes.reason.message)
    silent ? setRefreshing(false) : setLoading(false)
  }, [])

  useEffect(() => {
    if (user) loadData(user)
  }, [user, loadData])

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    navigate('overview')
  }

  const handleLogout = () => {
    setUser(null)
    setSummary(null)
    setTransactions([])
    setBudgets(null)
    setStatus(null)
    window.location.hash = ''
  }

  const handleImported = useCallback(async () => {
    await loadData(user, { silent: true })
  }, [user, loadData])

  const handleBudgetsChanged = useCallback((next) => {
    setBudgets(next)
  }, [])

  const period = useMemo(() => {
    if (!summary?.period) return null
    const count = summary.transaction_count
    return count ? `${summary.period} · ${count} transactions` : summary.period
  }, [summary])

  if (!user) return <AuthPage onLoginSuccess={handleLogin} />

  return (
    <AppShell
      user={user}
      view={view}
      onNavigate={navigate}
      onLogout={handleLogout}
      period={period}
    >
      {view === 'overview' && (
        <Overview
          user={user}
          summary={summary}
          budgets={budgets}
          transactions={transactions}
          loading={loading}
          refreshing={refreshing}
          onNavigate={navigate}
          onRefresh={() => loadData(user, { silent: true })}
          error={error}
        />
      )}

      {view === 'transactions' && (
        <Transactions
          transactions={transactions}
          loading={refreshing}
          onRefresh={() => loadData(user, { silent: true })}
        />
      )}

      {view === 'budgets' && (
        <Budgets user={user} onChanged={handleBudgetsChanged} />
      )}

      {view === 'reports' && <Reports user={user} />}

      {view === 'ai' && <AiSkills user={user} />}

      {view === 'import' && (
        <Import user={user} onImported={handleImported} onNavigate={navigate} />
      )}

      {view === 'settings' && (
        <Settings
          user={user}
          status={status}
          onStatusRefresh={() => loadData(user, { silent: true })}
          onLogout={handleLogout}
          onDataChanged={handleImported}
        />
      )}
    </AppShell>
  )
}
