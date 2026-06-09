'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { toggleItem } from './actions'

interface RunItem {
  id: string
  supplier_sku: string
  shopify_variant_id: string | null
  product_title: string | null
  variant_title: string | null
  old_cost: number | null
  new_cost: number | null
  old_price: number | null
  new_price: number | null
  margin_pct: number | null
  flag: 'ok' | 'cost_up' | 'below_margin' | 'unmatched' | null
  selected: boolean
}

type FlagFilter = 'all' | 'ok' | 'cost_up' | 'below_margin' | 'unmatched'

interface ItemCounts {
  all: number
  ok: number
  cost_up: number
  below_margin: number
  unmatched: number
  selectedForSync: number
}

interface ItemsApiResponse {
  items: RunItem[]
  totalCount: number
  page: number
  limit: number
  totalPages: number
  counts: ItemCounts
}

interface FetchParams {
  page: number
  filter: FlagFilter
  limit: number
}

export function PreviewTable({
  initialItems,
  initialTotalCount,
  initialCounts,
  runId,
  canSync,
  itemsBelowMargin,
}: {
  initialItems: RunItem[]
  initialTotalCount: number
  initialCounts: ItemCounts
  runId: string
  canSync: boolean
  itemsBelowMargin: number
}) {
  const [fetchParams, setFetchParams] = useState<FetchParams>({ page: 1, filter: 'all', limit: 50 })
  const [items, setItems] = useState<RunItem[]>(initialItems)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil(initialTotalCount / 50)))
  const [counts, setCounts] = useState<ItemCounts>(initialCounts)
  const [selectedForSync, setSelectedForSync] = useState(initialCounts.selectedForSync)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isFirst = useRef(true)

  const doFetch = useCallback(async (p: FetchParams) => {
    setIsLoading(true)
    try {
      const url =
        `/api/runs/${runId}/items` +
        `?page=${p.page}&limit=${p.limit}&filter=${p.filter}`
      const res = await fetch(url)
      if (!res.ok) return
      const data = (await res.json()) as ItemsApiResponse
      setItems(data.items)
      setTotalCount(data.totalCount)
      setTotalPages(data.totalPages)
      setCounts(data.counts)
      setSelectedForSync(data.counts.selectedForSync)
    } finally {
      setIsLoading(false)
    }
  }, [runId])

  // Skip the initial mount — SSR data is already in state.
  // Every subsequent change to fetchParams triggers a real fetch.
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    void doFetch(fetchParams)
  }, [fetchParams, doFetch])

  const handleFilterChange = (f: FlagFilter) => {
    setFetchParams(p => ({ ...p, filter: f, page: 1 }))
  }

  const handlePageChange = (pg: number) => {
    setFetchParams(p => ({ ...p, page: pg }))
  }

  const handleLimitChange = (lim: number) => {
    setFetchParams({ page: 1, filter: fetchParams.filter, limit: lim })
  }

  const handleToggle = (item: RunItem) => {
    if (!canSync) return
    const newSelected = !item.selected
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, selected: newSelected } : i))
    // Only matched items count toward "selected for sync"
    if (item.shopify_variant_id) {
      setSelectedForSync(n => n + (newSelected ? 1 : -1))
    }
    startTransition(async () => {
      await toggleItem(runId, item.id, newSelected)
    })
  }

  const { page, filter, limit } = fetchParams
  const rangeStart = (page - 1) * limit + 1
  const rangeEnd   = Math.min(page * limit, totalCount)

  return (
    <div>
      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Items</p>
            <span className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">{counts.all.toLocaleString()}</p>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Prices Updated</p>
            <span className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-emerald-700 tabular-nums">{selectedForSync.toLocaleString()}</p>
          <p className="text-xs text-emerald-500 -mt-1">selected for sync</p>
        </div>

        <div className={[
          'bg-white rounded-xl p-4 flex flex-col gap-3 border',
          counts.below_margin > 0 ? 'border-amber-300' : 'border-amber-200',
        ].join(' ')}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Below Margin</p>
            <span className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </span>
          </div>
          <p className={[
            'text-3xl font-bold tabular-nums',
            counts.below_margin > 0 ? 'text-amber-700' : 'text-amber-400',
          ].join(' ')}>{counts.below_margin.toLocaleString()}</p>
          <p className="text-xs text-amber-500 -mt-1">flagged items</p>
        </div>

        <div className={[
          'bg-white rounded-xl p-4 flex flex-col gap-3 border',
          counts.unmatched > 0 ? 'border-red-300' : 'border-red-200',
        ].join(' ')}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Unmatched SKUs</p>
            <span className="h-8 w-8 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
          </div>
          <p className={[
            'text-3xl font-bold tabular-nums',
            counts.unmatched > 0 ? 'text-red-600' : 'text-red-300',
          ].join(' ')}>{counts.unmatched.toLocaleString()}</p>
          <p className="text-xs text-red-400 -mt-1">no catalog match</p>
        </div>
      </div>

      {/* ── Below-margin alert banner ─────────────────────────────────────── */}
      {itemsBelowMargin > 0 && (
        <div className="mb-6 flex items-start gap-4 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 shadow-sm shadow-amber-100">
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">
              Warning: Some products fell below your target margin threshold during this run.
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Review the highlighted rows below before syncing, or adjust your pricing rules.{' '}
              <Link
                href="/dashboard/settings/pricing"
                className="font-medium underline underline-offset-2 hover:no-underline"
              >
                Open Pricing Settings →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {(
          [
            { key: 'all',          label: 'All' },
            { key: 'ok',           label: 'OK' },
            { key: 'cost_up',      label: 'Cost up' },
            { key: 'below_margin', label: 'Below margin' },
            { key: 'unmatched',    label: 'Unmatched' },
          ] satisfies { key: FlagFilter; label: string }[]
        ).map(({ key, label }) => {
          const count = counts[key === 'all' ? 'all' : key] ?? 0
          if (key !== 'all' && count === 0) return null
          return (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
                filter === key
                  ? flagButtonActive(key)
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white',
              ].join(' ')}
            >
              {label}
              <span className={[
                'rounded-full px-1.5 py-0.5 text-xs font-bold',
                filter === key ? 'bg-white/30' : 'bg-gray-100 text-gray-500',
              ].join(' ')}>
                {count.toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Table (dims during page load) ────────────────────────────────── */}
      <div className={[
        'rounded-xl border border-gray-200 overflow-hidden bg-white transition-opacity duration-200',
        isLoading ? 'opacity-50 pointer-events-none' : '',
      ].join(' ')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {canSync && (
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Include</span>
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Flag</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Product</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 font-mono">Supplier SKU</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Old cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">New cost</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Current price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">New price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={canSync ? 9 : 8}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    No items match this filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    canSync={canSync}
                    isPending={isPending}
                    onToggle={() => handleToggle(item)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination controls ───────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        {/* Left: rows per page + range info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Rows per page:</span>
            <select
              value={limit}
              onChange={e => handleLimitChange(Number(e.target.value))}
              className="border border-gray-200 rounded-md px-2 py-1 text-xs bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            >
              {[25, 50, 100].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-400">
            {totalCount > 0
              ? `${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalCount.toLocaleString()}`
              : 'No items'}
          </span>
        </div>

        {/* Right: page buttons */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <PageButton
              label="←"
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              aria-label="Previous page"
            />
            {visiblePages(page, totalPages).map((p, i) =>
              p === null ? (
                <span key={`ellipsis-${i}`} className="px-1 text-gray-400 select-none">…</span>
              ) : (
                <PageButton
                  key={p}
                  label={String(p)}
                  onClick={() => handlePageChange(p)}
                  disabled={isLoading}
                  active={p === page}
                />
              )
            )}
            <PageButton
              label="→"
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              aria-label="Next page"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function visiblePages(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | null)[] = [1]
  if (current > 3) pages.push(null)
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p)
  }
  if (current < total - 2) pages.push(null)
  pages.push(total)
  return pages
}

function PageButton({
  label,
  onClick,
  disabled,
  active,
  'aria-label': ariaLabel,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  'aria-label'?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'min-w-[2rem] h-8 px-2 rounded-md text-xs font-medium border transition-colors',
        active
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : disabled
            ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-white'
            : 'border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 bg-white',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function ItemRow({
  item,
  canSync,
  isPending,
  onToggle,
}: {
  item: RunItem
  canSync: boolean
  isPending: boolean
  onToggle: () => void
}) {
  const isUnmatched   = item.flag === 'unmatched'
  const isBelowMargin = item.flag === 'below_margin'

  const rowCls = [
    'transition-all duration-150',
    !item.selected ? 'opacity-40' : '',
    isBelowMargin ? 'bg-amber-50/60 hover:bg-amber-50' : isUnmatched ? 'bg-gray-50/50' : 'hover:bg-gray-50',
  ].join(' ')

  const priceChange =
    item.new_price !== null && item.old_price !== null
      ? item.new_price - item.old_price
      : null

  return (
    <tr className={rowCls}>
      {canSync && (
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={item.selected}
            onChange={onToggle}
            disabled={isUnmatched || isPending}
            className="h-4 w-4 rounded border-gray-300 accent-indigo-600 disabled:cursor-not-allowed transition-opacity duration-150"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <FlagBadge flag={item.flag} />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-gray-800 truncate max-w-[180px]">
          {item.product_title ?? '—'}
        </p>
        {item.variant_title && (
          <p className="text-xs text-gray-400 mt-0.5">{item.variant_title}</p>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">
        {item.supplier_sku}
      </td>
      <td className="px-4 py-3 text-right text-gray-600">{fmt(item.old_cost)}</td>
      <td className={`px-4 py-3 text-right font-medium ${item.new_cost !== null && item.old_cost !== null && item.new_cost > item.old_cost ? 'text-amber-700' : 'text-gray-800'}`}>
        {fmt(item.new_cost)}
      </td>
      <td className="px-4 py-3 text-right text-gray-600">{fmt(item.old_price)}</td>
      <td className="px-4 py-3 text-right">
        {item.new_price !== null ? (
          <div>
            <span className="font-semibold text-gray-900">{fmt(item.new_price)}</span>
            {priceChange !== null && priceChange !== 0 && (
              <span className={`ml-1.5 text-xs ${priceChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {priceChange > 0 ? '+' : ''}{fmt(priceChange)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {item.margin_pct !== null ? (
          <span className={isBelowMargin ? 'text-amber-700 font-semibold' : 'text-gray-700'}>
            {item.margin_pct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
    </tr>
  )
}

function FlagBadge({ flag }: { flag: RunItem['flag'] }) {
  if (!flag || flag === 'ok') {
    return (
      <span className="inline-flex text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        ok
      </span>
    )
  }
  if (flag === 'cost_up') {
    return (
      <span className="inline-flex text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
        cost ↑
      </span>
    )
  }
  if (flag === 'below_margin') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
        below margin
      </span>
    )
  }
  return (
    <span className="inline-flex text-xs font-medium text-red-500 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
      unmatched
    </span>
  )
}

function flagButtonActive(key: FlagFilter): string {
  const map: Record<FlagFilter, string> = {
    all:          'border-gray-800 bg-gray-800 text-white',
    ok:           'border-emerald-600 bg-emerald-600 text-white',
    cost_up:      'border-blue-600 bg-blue-600 text-white',
    below_margin: 'border-amber-500 bg-amber-500 text-white',
    unmatched:    'border-red-500 bg-red-500 text-white',
  }
  return map[key]
}

function fmt(val: number | null): string {
  if (val === null) return '—'
  return `$${Math.abs(val).toFixed(2)}`
}
