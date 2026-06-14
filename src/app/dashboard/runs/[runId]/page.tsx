import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PreviewTable } from './PreviewTable'

interface PageProps {
  params: Promise<{ runId: string }>
}

export default async function RunPreviewPage({ params }: PageProps) {
  const { runId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/dashboard')

  const admin = createAdminClient()

  const [{ data: run }, { data: orgRow }] = await Promise.all([
    admin
      .from('reprice_runs')
      .select('id, status, source_filename, items_total, items_changed, items_below_margin, created_at')
      .eq('id', runId)
      .eq('organization_id', membership.organization_id)
      .single(),
    admin
      .from('organizations')
      .select('plan')
      .eq('id', membership.organization_id)
      .single(),
  ])

  if (!run) redirect('/dashboard')

  // Redirect back to upload wizard if not yet priced
  if (run.status === 'parsed') redirect(`/dashboard/upload/${runId}/map-columns`)
  if (run.status === 'pending') redirect('/dashboard/upload')

  const PAGE_LIMIT = 50

  const [
    { data: initialItems },
    { count: okCount },
    { count: costUpCount },
    { count: belowMarginCount },
    { count: unmatchedCount },
    { count: selectedCount },
  ] = await Promise.all([
    admin
      .from('reprice_run_items')
      .select('id, supplier_sku, shopify_variant_id, product_title, variant_title, old_cost, new_cost, old_price, new_price, margin_pct, flag, selected')
      .eq('run_id', runId)
      .order('flag', { ascending: true })
      .range(0, PAGE_LIMIT - 1),
    admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'ok'),
    admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'cost_up'),
    admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'below_margin'),
    admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'unmatched'),
    admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('selected', true).not('shopify_variant_id', 'is', null),
  ])

  const initialCounts = {
    all:            run.items_total    ?? 0,
    ok:             okCount            ?? 0,
    cost_up:        costUpCount        ?? 0,
    below_margin:   belowMarginCount   ?? 0,
    unmatched:      unmatchedCount     ?? 0,
    selectedForSync: selectedCount     ?? 0,
  }

  const isPro = orgRow?.plan === 'pro'
  const canSync = run.status === 'previewed'
  const isSyncing = run.status === 'syncing'
  const isCompleted = run.status === 'completed'

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href="/dashboard" className="hover:text-gray-600">Dashboard</Link>
            <span>/</span>
            <span className="text-gray-600">Run preview</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {run.source_filename ?? 'Unnamed file'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {new Date(run.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isPro ? (
            <Link
              href={`/api/runs/${runId}/export`}
              className="inline-flex items-center gap-1.5 border border-gray-200 bg-white text-sm text-gray-600 font-medium px-3 py-2 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </Link>
          ) : (
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-1.5 border border-gray-200 bg-white text-sm text-gray-400 font-medium px-3 py-2 rounded-lg hover:border-indigo-200 hover:text-indigo-600 transition-colors"
              title="Export CSV — Pro feature"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              Export CSV
              <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded px-1">Pro</span>
            </Link>
          )}
          <StatusBadge status={run.status} />
          {canSync && (
            <SyncButton runId={runId} isPro={isPro} />
          )}
          {isSyncing && (
            <span className="text-sm text-blue-600 font-medium animate-pulse">
              Syncing to Shopify…
            </span>
          )}
          {isCompleted && (
            <span className="text-sm text-emerald-600 font-medium">
              ✓ Synced to Shopify
            </span>
          )}
        </div>
      </div>

      <PreviewTable
        initialItems={initialItems ?? []}
        initialTotalCount={run.items_total ?? 0}
        initialCounts={initialCounts}
        runId={runId}
        canSync={canSync}
        itemsBelowMargin={run.items_below_margin ?? 0}
      />
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
    <span className={`inline-flex text-xs font-medium border rounded-full px-2.5 py-1 ${cls}`}>
      {status}
    </span>
  )
}

function SyncButton({ runId, isPro }: { runId: string; isPro: boolean }) {
  if (!isPro) {
    return (
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-200 transition-colors"
        title="Sync to Shopify — Pro feature"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Push to Shopify
        <span className="text-[10px] font-semibold bg-indigo-200 text-indigo-800 rounded px-1">Pro</span>
      </Link>
    )
  }
  return (
    <Link
      href={`/dashboard/runs/${runId}/sync`}
      className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
      Push to Shopify
    </Link>
  )
}
