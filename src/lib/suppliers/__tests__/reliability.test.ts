import { describe, expect, it } from 'vitest'
import {
  computeSupplierStats,
  normalizeSupplierName,
  type SupplierRunRecord,
} from '../reliability'

describe('normalizeSupplierName', () => {
  it('strips extension and separators', () => {
    expect(normalizeSupplierName('acme_pricelist.csv')).toBe('Acme Pricelist')
  })

  it('removes dates, months and version markers', () => {
    expect(normalizeSupplierName('acme_pricelist_2026-06_v2.csv')).toBe('Acme Pricelist')
    expect(normalizeSupplierName('Acme Pricelist July.xlsx')).toBe('Acme Pricelist')
  })

  it('removes duplicate-download counters and noise words', () => {
    expect(normalizeSupplierName('acme pricelist (1).csv')).toBe('Acme Pricelist')
    expect(normalizeSupplierName('acme-pricelist-final-updated.csv')).toBe('Acme Pricelist')
  })

  it('groups date variants of the same supplier under one key', () => {
    const a = normalizeSupplierName('acme_pricelist_2026-05.csv')
    const b = normalizeSupplierName('acme_pricelist_2026-06.csv')
    expect(a).toBe(b)
  })

  it('falls back when nothing remains', () => {
    expect(normalizeSupplierName(null)).toBe('Unknown supplier')
    expect(normalizeSupplierName('2026-06-01.csv')).toBe('Unknown supplier')
  })
})

function run(
  filename: string,
  createdAt: string,
  items: SupplierRunRecord['items']
): SupplierRunRecord {
  return { runId: `${filename}-${createdAt}`, sourceFilename: filename, createdAt, items }
}

const stable = { flag: 'ok' as const, oldCost: 10, newCost: 10 }
const up10 = { flag: 'cost_up' as const, oldCost: 10, newCost: 11 }
const belowMargin = { flag: 'below_margin' as const, oldCost: 10, newCost: 14 }
const unmatched = { flag: 'unmatched' as const, oldCost: null, newCost: null }

describe('computeSupplierStats', () => {
  it('gives a perfect score to a supplier with no cost changes', () => {
    const stats = computeSupplierStats([
      run('calm_supplier.csv', '2026-05-01', [stable, stable, stable]),
      run('calm_supplier.csv', '2026-06-01', [stable, stable, stable]),
    ])
    expect(stats).toHaveLength(1)
    expect(stats[0].score).toBe(100)
    expect(stats[0].grade).toBe('A')
    expect(stats[0].uploads).toBe(2)
    expect(stats[0].avgChangedPct).toBe(0)
  })

  it('penalizes volatile suppliers and grades them lower', () => {
    const stats = computeSupplierStats([
      run('wild_supplier.csv', '2026-06-01', [up10, up10, belowMargin, stable]),
    ])
    expect(stats[0].avgChangedPct).toBe(75) // 3 of 4 changed
    expect(stats[0].avgIncreasePct).toBeCloseTo((10 + 10 + 40) / 3, 0)
    expect(stats[0].belowMarginPct).toBe(25)
    expect(stats[0].score).toBeLessThan(55)
    expect(['D', 'F']).toContain(stats[0].grade)
  })

  it('groups runs with date-stamped filenames into one supplier', () => {
    const stats = computeSupplierStats([
      run('acme_2026-05.csv', '2026-05-01', [stable]),
      run('acme_2026-06.csv', '2026-06-01', [up10]),
    ])
    expect(stats).toHaveLength(1)
    expect(stats[0].supplier).toBe('Acme')
    expect(stats[0].uploads).toBe(2)
    expect(stats[0].lastUpload).toBe('2026-06-01')
  })

  it('ignores unmatched items in all percentages', () => {
    const stats = computeSupplierStats([
      run('acme.csv', '2026-06-01', [stable, unmatched, unmatched]),
    ])
    expect(stats[0].latestItemCount).toBe(1)
    expect(stats[0].avgChangedPct).toBe(0)
    expect(stats[0].score).toBe(100)
  })

  it('sorts best score first', () => {
    const stats = computeSupplierStats([
      run('wild.csv', '2026-06-01', [up10, up10, up10]),
      run('calm.csv', '2026-06-01', [stable, stable, stable]),
    ])
    expect(stats[0].supplier).toBe('Calm')
    expect(stats[1].supplier).toBe('Wild')
  })
})
