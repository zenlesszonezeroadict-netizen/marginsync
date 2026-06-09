import { describe, it, expect } from 'vitest'
import { parseCsv } from '../parse-csv'

function buf(s: string) {
  return Buffer.from(s, 'utf-8')
}

describe('parseCsv', () => {
  it('parses a basic CSV', () => {
    const rows = parseCsv(buf('sku,cost\nABC-1,10.00\nXYZ-2,20.00'))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ sku: 'ABC-1', cost: '10.00' })
    expect(rows[1]).toEqual({ sku: 'XYZ-2', cost: '20.00' })
  })

  it('trims header whitespace', () => {
    const rows = parseCsv(buf(' sku , cost \nA,5'))
    expect(rows[0]).toHaveProperty('sku', 'A')
    expect(rows[0]).toHaveProperty('cost', '5')
  })

  it('trims cell whitespace', () => {
    const rows = parseCsv(buf('sku,cost\n  ABC  ,  12.5  '))
    expect(rows[0]).toEqual({ sku: 'ABC', cost: '12.5' })
  })

  it('strips UTF-8 BOM', () => {
    const withBom = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('sku,cost\nA,1')])
    const rows = parseCsv(withBom)
    expect(rows[0]).toHaveProperty('sku', 'A')
  })

  it('skips empty lines', () => {
    const rows = parseCsv(buf('sku,cost\nA,1\n\nB,2\n'))
    expect(rows).toHaveLength(2)
  })

  it('returns empty array for header-only file', () => {
    const rows = parseCsv(buf('sku,cost'))
    expect(rows).toHaveLength(0)
  })

  it('handles extra columns gracefully', () => {
    const rows = parseCsv(buf('sku,cost,description\nA,5,widget'))
    expect(rows[0]).toMatchObject({ sku: 'A', cost: '5', description: 'widget' })
  })
})
