import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { TrendingDown, ShieldAlert, Sparkles, DollarSign, PieChart, BarChart2 } from 'lucide-react';

const AnalyticsSummary = ({ data }) => {
  if (!data) return null;

  const chartData = data.categories?.map(cat => ({
    name: cat.name,
    amount: cat.amount,
    isWaste: cat.is_waste
  })) || [];

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg shadow-lg">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-sm font-medium">Total Spent</span>
            <DollarSign className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            ${data.total_spent?.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg shadow-lg">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-sm font-medium">Identified Waste</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-red-500">
            ${data.waste_total?.toFixed(2) || '0.00'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-lg shadow-lg">
          <div className="flex justify-between items-center text-slate-400 mb-2">
            <span className="text-sm font-medium">Potential 10Yr Wealth Growth</span>
            <Sparkles className="w-4 h-4 text-green-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-green-500">
            ${data.potential_investment_value_10yr?.toFixed(2) || '0.00'}
          </div>
          <p className="text-xs text-slate-500 mt-1">Assuming redirected annual waste ($ {data.annual_waste_projection?.toFixed(2)}) invested at 7% APY</p>
        </div>
      </div>

      {/* Visual Bar Chart Breakdown */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-green-500" />
            Spending & Leakage by Category
          </h3>
        </div>
        
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Spent']}
              />
              <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Breakdown list */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg shadow-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Detailed Breakdown</h3>
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
