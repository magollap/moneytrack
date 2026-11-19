import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { compactCurrency, currency, categoryColor, shortDate } from '../lib/format'

const axisStyle = { fontSize: 11, fill: '#64748b', fontFamily: 'Fira Code, monospace' }

function ChartTooltip({ active, payload, label, money = true }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line-strong bg-canvas/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-muted">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="flex items-center gap-2 text-ink">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color || entry.payload?.fill }}
            aria-hidden="true"
          />
          <span className="text-muted">{entry.name}</span>
          <span className="num ml-auto">{money ? currency(entry.value) : entry.value}</span>
        </p>
      ))}
    </div>
  )
}

export function SpendTrendChart({ daily = [] }) {
  const data = daily.map((d) => ({
    ...d,
    label: shortDate(d.date),
  }))

  if (!data.length) {
    return (
      <p className="px-5 pb-8 text-xs text-muted">No spending recorded for this period.</p>
    )
  }

  return (
    <div className="h-64 w-full px-1 pb-2" role="img" aria-label="Daily spending trend for the last 90 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={axisStyle}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v) => compactCurrency(v)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#334155' }} />
          <Area
            type="monotone"
            dataKey="amount"
            name="Spent"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#spendFill)"
            activeDot={{ r: 4, fill: '#22c55e', stroke: '#020617', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryDonut({ categories = [], total = 0 }) {
  if (!categories.length) {
    return <p className="px-5 pb-8 text-xs text-muted">Upload a statement to see the breakdown.</p>
  }

  return (
    <div className="flex flex-col items-center gap-2 px-4 pb-5 sm:flex-row sm:items-center">
      <div
        className="relative h-44 w-44 shrink-0"
        role="img"
        aria-label={`Spending split across ${categories.length} categories`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categories}
              dataKey="amount"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="#0e1223"
              strokeWidth={2}
            >
              {categories.map((c) => (
                <Cell key={c.name} fill={categoryColor(c.name)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-faint">Total</p>
            <p className="num text-sm font-semibold text-ink">{compactCurrency(total)}</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-2 text-xs">
        {categories.slice(0, 6).map((c) => (
          <li key={c.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: categoryColor(c.name) }}
              aria-hidden="true"
            />
            <span className="truncate text-muted">{c.name}</span>
            <span className="num ml-auto shrink-0 text-ink">{currency(c.amount)}</span>
            <span className="num w-10 shrink-0 text-right text-faint">{c.percentage}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
