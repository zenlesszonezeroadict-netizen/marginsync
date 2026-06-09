import { describe, it, expect } from 'vitest'
import { applyRounding } from '../apply-rounding'

describe('applyRounding', () => {
  describe('mode: 0.99', () => {
    it('rounds up to nearest .99', () => {
      expect(applyRounding(12.5, '0.99')).toBe(12.99)
    })

    it('keeps .99 values unchanged', () => {
      expect(applyRounding(12.99, '0.99')).toBe(12.99)
    })

    it('rounds 13.01 up to 13.99', () => {
      expect(applyRounding(13.01, '0.99')).toBe(13.99)
    })

    it('rounds exact integer up to .99', () => {
      expect(applyRounding(10.0, '0.99')).toBe(9.99)
    })
  })

  describe('mode: 0.00', () => {
    it('rounds to nearest cent', () => {
      expect(applyRounding(12.504, '0.00')).toBe(12.50)
    })

    it('rounds 12.505 up', () => {
      expect(applyRounding(12.505, '0.00')).toBeCloseTo(12.51, 1)
    })

    it('keeps exact values', () => {
      expect(applyRounding(10.0, '0.00')).toBe(10.0)
    })
  })

  describe('mode: none', () => {
    it('returns price rounded to 2 decimal places', () => {
      expect(applyRounding(12.4950, 'none')).toBe(12.50)
    })

    it('does not apply .99 rounding', () => {
      expect(applyRounding(12.34, 'none')).toBe(12.34)
    })
  })
})
