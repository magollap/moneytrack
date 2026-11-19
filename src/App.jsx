import React, { useState, useEffect } from 'react';
import AuthPage from './components/AuthPage';
import TransactionUpload from './components/TransactionUpload';
import AnalyticsSummary from './components/AnalyticsSummary';
import { LogOut, ShieldCheck, Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);
  const [booting, setBooting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setBooting(true);

    fetch('/api/v1/analytics/summary', { headers: { 'x-user-id': user.id } })
      .then(r => r.json())
      .then(result => {
        if (cancelled) return;
        if (result.success && result.data.total_spent > 0) setData(result.data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setBooting(false));

    return () => { cancelled = true; };
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    setData(null);
  };

  if (!user) return <AuthPage onLoginSuccess={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8">
      <header className="mb-10 max-w-4xl mx-auto flex flex-wrap gap-4 justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">MoneyTrack</h1>
          <p className="text-slate-400 text-sm mt-1">Personal Finance &amp; Waste Optimizer</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full">
            {user.isAdmin && <ShieldCheck className="w-4 h-4 text-green-500" />}
            <span className="text-sm font-medium text-slate-200">{user.username}</span>
            {user.isAdmin && (
              <span className="text-[10px] uppercase tracking-wide bg-green-500/10 text-green-400 border border-green-800 px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        {booting ? (
          <div className="flex justify-center py-24 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !data ? (
          <TransactionUpload user={user} onUploadSuccess={setData} />
        ) : (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">Analysis Overview</h2>
              <button
                onClick={() => setData(null)}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Upload another statement
              </button>
            </div>
            <AnalyticsSummary data={data} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
