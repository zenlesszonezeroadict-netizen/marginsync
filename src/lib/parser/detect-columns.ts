import type { ColumnGuess } from './types'

/** Keywords that suggest a column holds SKU / item code data. */
const SKU_KEYWORDS = [
  'sku',
  'item',
  'code',
  'part',
  'part#',
  'part number',
  'itemcode',
  'item code',
  'product code',
  'barcode',
  'upc',
  'mpn',
  'model',
  'article',
]

/** Keywords that suggest a column holds wholesale cost data. */
const COST_KEYWORDS = [
  'cost',
  'wholesale',
  'unit cost',
  'unitcost',
  'net price',
  'net',
  'buy price',
  'purchase price',
  'dealer price',
  'trade price',
  'supplier price',
  'your price',
  'our cost',
]

function scoreHeader(header: string, keywords: string[]): number {
  const h = header.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim()
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i]
    if (h === kw) return 1.0 - i * 0.01          // exact match, earlier = higher score
    if (h.startsWith(kw)) return 0.8 - i * 0.01
    if (h.includes(kw)) return 0.6 - i * 0.01
  }
  return 0
}

/**
 * Score each header against SKU and cost keyword lists.
 * Returns the best candidate for each role plus confidence scores.
 */
export function detectColumns(headers: string[]): ColumnGuess {
  let bestSkuCol = headers[0] ?? ''
  let bestSkuScore = 0
  let bestCostCol = headers[1] ?? headers[0] ?? ''
  let bestCostScore = 0

  for (const header of headers) {
    const skuScore = scoreHeader(header, SKU_KEYWORDS)
    const costScore = scoreHeader(header, COST_KEYWORDS)

    if (skuScore > bestSkuScore) {
      bestSkuScore = skuScore
      bestSkuCol = header
    }
    if (costScore > bestCostScore) {
      bestCostScore = costScore
      bestCostCol = header
    }
  }

  // Prevent both fields from picking the same column
  if (bestSkuCol === bestCostCol && headers.length > 1) {
    if (bestSkuScore >= bestCostScore) {
      // Re-pick cost from remaining headers
      let nextBest = 0
      for (const header of headers) {
        if (header === bestSkuCol) continue
        const score = scoreHeader(header, COST_KEYWORDS)
        if (score > nextBest) {
          nextBest = score
          bestCostCol = header
          bestCostScore = score
        }
      }
    } else {
      // Re-pick sku from remaining headers
      let nextBest = 0
      for (const header of headers) {
        if (header === bestCostCol) continue
        const score = scoreHeader(header, SKU_KEYWORDS)
        if (score > nextBest) {
          nextBest = score
          bestSkuCol = header
          bestSkuScore = score
        }
      }
    }
  }

  return {
    skuCol: bestSkuCol,
    skuConfidence: bestSkuScore,
    costCol: bestCostCol,
    costConfidence: bestCostScore,
    headers,
  }
}
