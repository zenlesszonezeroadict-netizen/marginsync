'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export interface RunAnalytics {
  id: string
  date: string
  filename: string
  itemsChanged: number
  itemsTotal: number
  avgMargin: number | null
  retailValue: number
  profit: number
}

export interface AnalyticsTotals {
  retailValue: number
  profit: number
  avgMargin: number | null
  totalChanged: number
}

interface Props {
  runs: RunAnalytics[]
  totals: AnalyticsTotals
}

export function AnalyticsCharts({ runs, totals }: Props) {
  if (runs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center mt-6">
        <p className="text-sm text-gray-500">
          No completed runs yet — charts will appear here after your first sync.
        </p>
      </div>
    )
  }

  const chartData = runs.map((r) => ({
    name: new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    margin: r.avgMargin,
    items: r.itemsChanged,
  }))

  return (
    <div className="mt-6 space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Avg Gross Margin"
          value={totals.avgMargin !== null ? `${totals.avgMargin.toFixed(1)}%` : '—'}
          color="text-emerald-700"
        />
        <StatCard
          label="Products Updated"
          value={totals.totalChanged.toLocaleString()}
          color="text-indigo-700"
        />
        <StatCard
          label="Total Retail Value"
          value={`$${totals.retailValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="text-gray-800"
        />
        <StatCard
          label="Est. Total Profit"
          value={`$${totals.profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          color="text-emerald-700"
        />
      </div>

      {/* Margin over time */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Avg Gross Margin % per Run</h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} unit="%" />
            <Tooltip
              formatter={(value) => [typeof value === 'number' ? `${value.toFixed(1)}%` : value, 'Avg Margin']}
              contentStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="margin"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Items changed per run */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Products Updated per Run</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [typeof value === 'number' ? value.toLocaleString() : value, 'Products']}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="items" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
