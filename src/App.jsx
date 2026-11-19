import React, { useState } from 'react';
import TransactionUpload from './components/TransactionUpload';
import AnalyticsSummary from './components/AnalyticsSummary';

function App() {
  const [data, setData] = useState(null);

  const handleUploadSuccess = (uploadedData) => {
    setData(uploadedData);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="mb-10 max-w-4xl mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">MoneyTrack</h1>
          <p className="text-slate-400 text-sm mt-1">Personal Finance & Waste Optimizer</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        {!data ? (
          <TransactionUpload onUploadSuccess={handleUploadSuccess} />
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
