/**
 * Supplier reliability scoring.
 *
 * Suppliers are identified by normalizing the uploaded price-list filename
 * (there is no supplier entity in the schema). Stats are computed from
 * item-level run data the org already owns — no external data sources.
 */

export interface SupplierItemRecord {
  flag: 'ok' | 'cost_up' | 'below_margin' | 'unmatched' | null
  oldCost: number | null
  newCost: number | null
}

export interface SupplierRunRecord {
  runId: string
  sourceFilename: string | null
  createdAt: string
  items: SupplierItemRecord[]
}

export type SupplierGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface SupplierStats {
  /** Display name derived from the filename */
  supplier: string
  uploads: number
  lastUpload: string
  /** Matched items in the most recent upload */
  latestItemCount: number
  /** Avg % of matched items whose cost changed, per upload */
  avgChangedPct: number
  /** Avg magnitude of cost increases across all increased items (%) */
  avgIncreasePct: number
  /** % of matched items flagged below margin, across all uploads */
  belowMarginPct: number
  /** 0–100, higher = more stable supplier */
  score: number
  grade: SupplierGrade
}

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'

const NOISE_WORDS = new Set(['final', 'update', 'updated', 'new', 'copy', 'latest', 'rev'])

/**
 * Derive a human-readable supplier name from an uploaded filename.
 * Strips extension, dates, month names, version markers and counters so
 * "acme_pricelist_2026-06_v2.csv" and "Acme Pricelist July.csv" group together.
 */
export function normalizeSupplierName(filename: string | null): string {
  if (!filename) return 'Unknown supplier'

  let s = filename.replace(/\.(csv|xlsx|xls|tsv|txt)$/i, '')
  s = s.replace(/[_\-.]+/g, ' ')
  s = s.replace(/\(\d+\)/g, ' ') // "(1)" duplicate-download counters
  s = s.replace(new RegExp(`\\b(${MONTHS})\\b`, 'gi'), ' ')
  s = s.replace(/\bv\d+\b/gi, ' ')
  s = s.replace(/\b\d{1,8}\b/g, ' ') // years, dates, counters
  s = s
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w.toLowerCase()))
    .join(' ')
    .trim()

  if (!s) return 'Unknown supplier'

  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function gradeFor(score: number): SupplierGrade {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

/**
 * Group runs by supplier and compute reliability metrics.
 * Returned list is sorted best score first.
 */
export function computeSupplierStats(runs: SupplierRunRecord[]): SupplierStats[] {
  const groups = new Map<string, { name: string; runs: SupplierRunRecord[] }>()

  for (const run of runs) {
    const name = normalizeSupplierName(run.sourceFilename)
    const key = name.toLowerCase()
    const group = groups.get(key)
    if (group) group.runs.push(run)
    else groups.set(key, { name, runs: [run] })
  }

  const stats: SupplierStats[] = []

  for (const { name, runs: supplierRuns } of groups.values()) {
    const sorted = [...supplierRuns].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    let totalMatched = 0
    let totalBelowMargin = 0
    const changedPcts: number[] = []
    const increasePcts: number[] = []

    for (const run of sorted) {
      const matched = run.items.filter((i) => i.flag !== 'unmatched' && i.flag !== null)
      if (matched.length === 0) continue

      let changed = 0
      for (const item of matched) {
        if (item.oldCost != null && item.newCost != null && item.newCost !== item.oldCost) {
          changed++
          if (item.newCost > item.oldCost && item.oldCost > 0) {
            increasePcts.push(((item.newCost - item.oldCost) / item.oldCost) * 100)
          }
        }
        if (item.flag === 'below_margin') totalBelowMargin++
      }

      totalMatched += matched.length
      changedPcts.push((changed / matched.length) * 100)
    }

    const latest = sorted[sorted.length - 1]
    const latestItemCount = latest
      ? latest.items.filter((i) => i.flag !== 'unmatched' && i.flag !== null).length
      : 0

    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const avgChangedPct = mean(changedPcts)
    const avgIncreasePct = mean(increasePcts)
    const belowMarginPct = totalMatched > 0 ? (totalBelowMargin / totalMatched) * 100 : 0

    const volatilityPenalty = Math.min(40, avgChangedPct * 0.8)
    const magnitudePenalty = Math.min(30, avgIncreasePct * 2)
    const marginPenalty = Math.min(30, belowMarginPct * 1.5)
    const score = Math.max(0, Math.round(100 - volatilityPenalty - magnitudePenalty - marginPenalty))

    stats.push({
      supplier: name,
      uploads: supplierRuns.length,
      lastUpload: sorted[sorted.length - 1]?.createdAt ?? '',
      latestItemCount,
      avgChangedPct: Math.round(avgChangedPct * 10) / 10,
      avgIncreasePct: Math.round(avgIncreasePct * 10) / 10,
      belowMarginPct: Math.round(belowMarginPct * 10) / 10,
      score,
      grade: gradeFor(score),
    })
  }

  return stats.sort((a, b) => b.score - a.score)
}
