import React from 'react';
import { TrendingDown, ShieldAlert, Sparkles, DollarSign } from 'lucide-react';

const AnalyticsSummary = ({ data }) => {
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-sm font-medium">Total Spent</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            ${data.total_spent?.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-sm font-medium">Identified Waste</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-500">
            ${data.waste_total?.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-sm font-medium">Potential Annual Savings</span>
            <Sparkles className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-green-500">
            ${data.annual_waste_projection?.toFixed(2) || '0.00'}
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Expenses by Category</h3>
        <div className="space-y-4">
          {data.categories?.map((cat, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 flex items-center gap-2">
                  {cat.name}
                  {cat.is_waste && (
                    <span className="text-xs bg-red-950 text-red-400 border border-red-800 px-1.5 py-0.5 rounded">
                      High Leakage
                    </span>
                  )}
                </span>
                <span className="font-mono text-slate-400">
                  ${cat.amount.toFixed(2)} ({cat.percentage}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${cat.is_waste ? 'bg-red-500' : 'bg-green-500'}`} 
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsSummary;
