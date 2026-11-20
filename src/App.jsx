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
import Accounts from './pages/Accounts'
import {
  getSummary,
  getTransactions,
  getStatus,
  getBudgets,
  getAccounts,
  updateTransaction,
  deleteTransaction,
} from './lib/api'

const VIEWS = ['overview', 'transactions', 'accounts', 'budgets', 'reports', 'ai', 'import', 'settings']

function viewFromHash() {
  const hash = window.location.hash.replace('#', '')
  return VIEWS.includes(hash) ? hash : 'overview'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [view, setView] = useState(viewFromHash)
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState(null)
  const [accountScope, setAccountScope] = useState('all')
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

  const loadData = useCallback(async (currentUser, { silent = false, scope = accountScope } = {}) => {
    if (!currentUser) return
    silent ? setRefreshing(true) : setLoading(true)
    setError(null)

    const [summaryRes, txRes, statusRes, budgetRes, accountRes] = await Promise.allSettled([
      getSummary(currentUser, scope),
      getTransactions(currentUser, scope),
      getStatus(currentUser),
      getBudgets(currentUser),
      getAccounts(currentUser),
    ])

    if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value)
    if (txRes.status === 'fulfilled') setTransactions(txRes.value)
    if (statusRes.status === 'fulfilled') setStatus(statusRes.value)
    if (budgetRes.status === 'fulfilled') setBudgets(budgetRes.value)
    if (accountRes.status === 'fulfilled') setAccounts(accountRes.value)

    if (summaryRes.status === 'rejected') setError(summaryRes.reason.message)
    silent ? setRefreshing(false) : setLoading(false)
  }, [accountScope])

  useEffect(() => {
    if (user) loadData(user)
  }, [user, loadData])

  const handleLogin = (loggedInUser) => {
    setUser(loggedInUser)
    setAccountScope('all')
    navigate('overview')
  }

  const handleLogout = () => {
    setUser(null)
    setSummary(null)
    setTransactions([])
    setAccounts(null)
    setAccountScope('all')
    setBudgets(null)
    setStatus(null)
    window.location.hash = ''
  }

  const handleImported = useCallback(async () => {
    await loadData(user, { silent: true })
  }, [user, loadData])

  const handleSelectAccount = useCallback(
    (id) => {
      setAccountScope(id || 'all')
      navigate('overview')
    },
    [navigate]
  )

  const handleUpdateTransaction = useCallback(
    async (id, patch) => {
      await updateTransaction(user, id, patch)
      await loadData(user, { silent: true })
    },
    [user, loadData]
  )

  const handleDeleteTransaction = useCallback(
    async (id) => {
      await deleteTransaction(user, id)
      await loadData(user, { silent: true })
    },
    [user, loadData]
  )

  const handleAccountsChanged = useCallback(
    async (next) => {
      if (next) setAccounts(next)
      await loadData(user, { silent: true })
    },
    [user, loadData]
  )

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
      accounts={accounts}
      accountScope={accountScope}
      onSelectAccount={handleSelectAccount}
    >
      {view === 'overview' && (
        <Overview
          user={user}
          summary={summary}
          budgets={budgets}
          transactions={transactions}
          accounts={accounts}
          accountScope={accountScope}
          onSelectAccount={handleSelectAccount}
          loading={loading}
          refreshing={refreshing}
          onNavigate={navigate}
          onRefresh={() => loadData(user, { silent: true })}
          error={error}
        />
      )}

      {view === 'transactions' && (
        <Transactions
          user={user}
          transactions={transactions}
          accounts={accounts}
          accountScope={accountScope}
          onScopeChange={setAccountScope}
          loading={refreshing}
          onRefresh={() => loadData(user, { silent: true })}
          onChanged={() => loadData(user, { silent: true })}
          onUpdateTransaction={handleUpdateTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />
      )}

      {view === 'accounts' && (
        <Accounts
          user={user}
          accounts={accounts}
          accountScope={accountScope}
          onSelectAccount={handleSelectAccount}
          onChanged={handleAccountsChanged}
          onScopeReset={() => setAccountScope('all')}
        />
      )}

      {view === 'budgets' && (
        <Budgets user={user} onChanged={handleBudgetsChanged} />
      )}

      {view === 'reports' && <Reports user={user} />}

      {view === 'ai' && <AiSkills user={user} />}

      {view === 'import' && (
        <Import
          user={user}
          accounts={accounts}
          onImported={handleImported}
          onNavigate={navigate}
        />
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
