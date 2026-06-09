import { describe, it, expect } from 'vitest'
import { normalizeSKU } from '../normalize-sku'

describe('normalizeSKU', () => {
  it('uppercases input', () => {
    expect(normalizeSKU('abc-123')).toBe('ABC-123')
  })

  it('trims whitespace', () => {
    expect(normalizeSKU('  SKU-1  ')).toBe('SKU-1')
  })

  it('strips non-alphanumeric characters except hyphens', () => {
    expect(normalizeSKU('SKU.1 / foo')).toBe('SKU1FOO')
  })

  it('preserves hyphens', () => {
    expect(normalizeSKU('AB-CD-EF')).toBe('AB-CD-EF')
  })

  it('strips UTF-8 BOM', () => {
    const withBom = '﻿SKU-1'
    expect(normalizeSKU(withBom)).toBe('SKU-1')
  })

  it('handles empty string', () => {
    expect(normalizeSKU('')).toBe('')
  })

  it('handles numbers-only SKUs', () => {
    expect(normalizeSKU('00123')).toBe('00123')
  })
})
