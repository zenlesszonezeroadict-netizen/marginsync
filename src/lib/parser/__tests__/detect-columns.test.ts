import { describe, it, expect } from 'vitest'
import { detectColumns } from '../detect-columns'

describe('detectColumns', () => {
  it('detects exact keyword matches', () => {
    const result = detectColumns(['sku', 'cost', 'description'])
    expect(result.skuCol).toBe('sku')
    expect(result.costCol).toBe('cost')
    expect(result.skuConfidence).toBeCloseTo(1.0, 1)
    expect(result.costConfidence).toBeCloseTo(1.0, 1)
  })

  it('detects partial keyword matches', () => {
    const result = detectColumns(['Item Code', 'Wholesale Price', 'Description'])
    expect(result.skuCol).toBe('Item Code')
    expect(result.costCol).toBe('Wholesale Price')
  })

  it('prevents sku and cost from selecting the same column', () => {
    const result = detectColumns(['SKU', 'Description'])
    expect(result.skuCol).not.toBe(result.costCol)
  })

  it('handles headers with no matches gracefully', () => {
    const result = detectColumns(['column_a', 'column_b'])
    expect(result.skuCol).toBeDefined()
    expect(result.costCol).toBeDefined()
    expect(result.skuCol).not.toBe(result.costCol)
  })

  it('returns the correct headers list', () => {
    const headers = ['sku', 'cost', 'qty']
    const result = detectColumns(headers)
    expect(result.headers).toEqual(headers)
  })

  it('prefers "sku" over "item" for sku column', () => {
    const result = detectColumns(['item', 'sku', 'cost'])
    expect(result.skuCol).toBe('sku')
  })

  it('detects part number header', () => {
    const result = detectColumns(['Part Number', 'Unit Cost', 'Qty'])
    expect(result.skuCol).toBe('Part Number')
    expect(result.costCol).toBe('Unit Cost')
  })
})
