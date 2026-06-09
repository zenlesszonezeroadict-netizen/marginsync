import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { RollbackButton } from '@/components/RollbackButton'

export default async function HistoryPage() {
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

  const { data: runs } = await admin
    .from('reprice_runs')
    .select('id, source_filename, status, items_total, items_changed, items_below_margin, rolled_back_at, created_at, completed_at')
    .eq('organization_id', membership.organization_id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Determine which completed runs have a newer completed run after them
  // (used to show the ⚠ warning on rollback)
  const completedRuns = (runs ?? []).filter((r) => r.status === 'completed')
  const latestCompletedId = completedRuns[0]?.id ?? null

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Run History</h1>
          <p className="text-sm text-gray-500 mt-1">All repricing runs for your organization.</p>
        </div>
        <Link
          href="/dashboard/upload"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + New Run
        </Link>
      </div>

      {(!runs || runs.length === 0) ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-500 mb-2">No runs yet</p>
          <p className="text-xs text-gray-400 mb-4">Upload a supplier price list to get started.</p>
          <Link
            href="/dashboard/upload"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Upload now →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">File</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Items</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Changed</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500">Rollback</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runs.map((run) => {
                const isNewestCompleted = run.id === latestCompletedId
                const showRollback = run.status === 'completed' && !run.rolled_back_at
                const hasNewerCompleted = showRollback && !isNewestCompleted

                return (
                  <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-800 truncate max-w-[180px]">
                        {run.source_filename ?? 'Unnamed file'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {run.items_total?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {run.items_changed != null && run.items_changed > 0 ? (
                        <span className="font-medium text-indigo-700">{run.items_changed.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">{run.items_changed ?? '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={run.status} rolledBack={!!run.rolled_back_at} />
                    </td>
                    <td className="px-4 py-3">
                      {run.rolled_back_at ? (
                        <span className="text-xs text-gray-400 font-medium">Rolled back</span>
                      ) : showRollback ? (
                        <RollbackButton
                          runId={run.id}
                          syncedCount={run.items_changed ?? 0}
                          hasNewerCompletedRun={hasNewerCompleted}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/runs/${run.id}`}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, rolledBack }: { status: string; rolledBack: boolean }) {
  if (rolledBack) {
    return (
      <span className="inline-flex text-xs font-medium border rounded-full px-2 py-0.5 bg-gray-50 text-gray-400 border-gray-200 line-through">
        {status}
      </span>
    )
  }
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
