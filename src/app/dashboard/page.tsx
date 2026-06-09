import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AnalyticsCharts } from '@/components/AnalyticsCharts'
import type { RunAnalytics, AnalyticsTotals } from '@/components/AnalyticsCharts'
import { OnboardingBanner } from '@/components/OnboardingBanner'
import type { OnboardingStatus } from '@/components/OnboardingBanner'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  let onboarding: OnboardingStatus = { shopifyConnected: false, pricingConfigured: false, hasRuns: false }
  let totalRuns = 0
  let lastRun: {
    id: string
    created_at: string
    status: string
    items_changed: number
    source_filename: string | null
  } | null = null
  let analyticsRuns: RunAnalytics[] = []
  let analyticsTotals: AnalyticsTotals = { retailValue: 0, profit: 0, avgMargin: null, totalChanged: 0 }

  if (membership) {
    const admin = createAdminClient()
    const orgId = membership.organization_id

    const { count } = await supabase
      .from('reprice_runs')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    totalRuns = count ?? 0

    // Onboarding status checks
    const [{ count: shopifyCount }, { data: orgRow }] = await Promise.all([
      supabase
        .from('shopify_connections')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId),
      supabase
        .from('organizations')
        .select('pricing_rule')
        .eq('id', orgId)
        .single(),
    ])
    onboarding = {
      shopifyConnected: (shopifyCount ?? 0) > 0,
      pricingConfigured: orgRow?.pricing_rule !== null && orgRow?.pricing_rule !== undefined,
      hasRuns: totalRuns > 0,
    }

    const { data: runRow } = await supabase
      .from('reprice_runs')
      .select('id, created_at, status, items_changed, source_filename')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    lastRun = runRow ? { ...runRow, items_changed: runRow.items_changed ?? 0 } : null

    // Step 2: Fetch analytics for charts
    const { data: completedRuns } = await admin
      .from('reprice_runs')
      .select('id, created_at, source_filename, items_total, items_changed, items_below_margin')
      .eq('organization_id', orgId)
      .eq('status', 'completed')
      .order('created_at', { ascending: true })
      .limit(30)

    if (completedRuns && completedRuns.length > 0) {
      const runIds = completedRuns.map((r) => r.id)
      const { data: items } = await admin
        .from('reprice_run_items')
        .select('run_id, margin_pct, new_price, new_cost')
        .in('run_id', runIds)
        .eq('synced', true)
        .not('new_price', 'is', null)

      const statsByRun = new Map<string, { margins: number[]; retailValue: number; profit: number }>()
      for (const item of items ?? []) {
        if (!statsByRun.has(item.run_id)) {
          statsByRun.set(item.run_id, { margins: [], retailValue: 0, profit: 0 })
        }
        const s = statsByRun.get(item.run_id)!
        if (item.margin_pct !== null) s.margins.push(item.margin_pct)
        if (item.new_price !== null) {
          s.retailValue += item.new_price
          s.profit += item.new_price - (item.new_cost ?? 0)
        }
      }

      analyticsRuns = completedRuns.map((run) => {
        const s = statsByRun.get(run.id)
        const avgMargin =
          s && s.margins.length > 0
            ? Math.round((s.margins.reduce((a, b) => a + b, 0) / s.margins.length) * 10) / 10
            : null
        return {
          id: run.id,
          date: run.created_at,
          filename: run.source_filename ?? 'Unnamed',
          itemsChanged: run.items_changed ?? 0,
          itemsTotal: run.items_total ?? 0,
          avgMargin,
          retailValue: Math.round((s?.retailValue ?? 0) * 100) / 100,
          profit: Math.round((s?.profit ?? 0) * 100) / 100,
        }
      })

      const allMargins = analyticsRuns.flatMap((r) => (r.avgMargin !== null ? [r.avgMargin] : []))
      analyticsTotals = {
        retailValue: Math.round(analyticsRuns.reduce((a, r) => a + r.retailValue, 0) * 100) / 100,
        profit: Math.round(analyticsRuns.reduce((a, r) => a + r.profit, 0) * 100) / 100,
        avgMargin:
          allMargins.length > 0
            ? Math.round((allMargins.reduce((a, b) => a + b, 0) / allMargins.length) * 10) / 10
            : null,
        totalChanged: analyticsRuns.reduce((a, r) => a + r.itemsChanged, 0),
      }
    }
  }

  return (
    <div className="p-8 max-w-4xl">
      <OnboardingBanner status={onboarding} />

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back,{' '}
          <span className="font-medium text-gray-700">{user.email}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Runs" value={String(totalRuns)} />
        <StatCard
          label="Last Run"
          value={lastRun ? new Date(lastRun.created_at).toLocaleDateString() : '—'}
        />
        <StatCard
          label="Products Updated"
          value={lastRun ? String(lastRun.items_changed) : '—'}
          sub="in last run"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ready to reprice?</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload a supplier price list to get started.</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          New Run
        </Link>
      </div>

      {lastRun && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Last reprice run</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                {lastRun.source_filename ?? 'Unnamed file'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(lastRun.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={lastRun.status} />
              <Link
                href={`/dashboard/history`}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Analytics Charts */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Profit Analytics</h2>
        <p className="text-sm text-gray-500">Performance across all completed repricing runs.</p>
        <AnalyticsCharts runs={analyticsRuns} totals={analyticsTotals} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    syncing: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-gray-50 text-gray-600 border-gray-200',
    parsed: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    previewed: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex text-xs font-medium border rounded-full px-2 py-0.5 ${cls}`}>
      {status}
    </span>
  )
}
