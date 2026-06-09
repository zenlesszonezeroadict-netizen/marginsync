/** One row from a supplier file — all values are raw strings at this stage. */
export type ParsedRow = Record<string, string>

/** Which columns hold SKU and cost data (confirmed by user or auto-detected). */
export interface ColumnConfig {
  skuCol: string
  costCol: string
}

/** Confidence score for a column guess. */
export interface ColumnGuess {
  skuCol: string
  skuConfidence: number
  costCol: string
  costConfidence: number
  headers: string[]
}
