import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  computeSupplierStats,
  type SupplierGrade,
  type SupplierRunRecord,
} from '@/lib/suppliers/reliability'

export default async function SuppliersPage() {
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
    .select('id, source_filename, created_at')
    .eq('organization_id', membership.organization_id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(50)

  let stats: ReturnType<typeof computeSupplierStats> = []

  if (runs && runs.length > 0) {
    const runIds = runs.map((r) => r.id)
    const { data: items } = await admin
      .from('reprice_run_items')
      .select('run_id, flag, old_cost, new_cost')
      .in('run_id', runIds)

    const itemsByRun = new Map<string, NonNullable<typeof items>>()
    for (const item of items ?? []) {
      const list = itemsByRun.get(item.run_id)
      if (list) list.push(item)
      else itemsByRun.set(item.run_id, [item])
    }

    const records: SupplierRunRecord[] = runs.map((r) => ({
      runId: r.id,
      sourceFilename: r.source_filename,
      createdAt: r.created_at,
      items: (itemsByRun.get(r.id) ?? []).map((i) => ({
        flag: i.flag,
        oldCost: i.old_cost,
        newCost: i.new_cost,
      })),
    }))

    stats = computeSupplierStats(records)
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Supplier Reliability</h1>
        <p className="text-sm text-gray-500 mt-1">
          How stable each supplier&apos;s pricing has been across your uploads. Scores are
          computed from your own price-list history — frequent or large cost increases and
          items pushed below your margin floor lower the score.
        </p>
      </div>

      {stats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-500 mb-2">No supplier data yet</p>
          <p className="text-xs text-gray-400 mb-4">
            Complete at least one repricing run and your suppliers will be scored here.
          </p>
          <Link
            href="/dashboard/upload"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Upload a price list →
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Supplier</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">Grade</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Score</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Uploads</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">SKUs changed / upload</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Avg cost hike</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Below margin</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Last upload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.map((s) => (
                <tr key={s.supplier} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{s.supplier}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <GradeBadge grade={s.grade} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{s.score}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.uploads}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{s.avgChangedPct}%</td>
                  <td className="px-4 py-3 text-right">
                    {s.avgIncreasePct > 0 ? (
                      <span className="font-medium text-amber-700">+{s.avgIncreasePct}%</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.belowMarginPct > 0 ? (
                      <span className="font-medium text-red-600">{s.belowMarginPct}%</span>
                    ) : (
                      <span className="text-gray-400">0%</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                    {new Date(s.lastUpload).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Scores are informational, derived only from price lists you uploaded. They are not a
        statement about any supplier&apos;s business and should not be the sole basis for
        supplier decisions.
      </p>
    </div>
  )
}

function GradeBadge({ grade }: { grade: SupplierGrade }) {
  const map: Record<SupplierGrade, string> = {
    A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    B: 'bg-lime-50 text-lime-700 border-lime-200',
    C: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    D: 'bg-orange-50 text-orange-700 border-orange-200',
    F: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`inline-flex w-7 h-7 items-center justify-center text-sm font-bold border rounded-full ${map[grade]}`}>
      {grade}
    </span>
  )
}
