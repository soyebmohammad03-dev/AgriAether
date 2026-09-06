export type CellQuality = 'VALID' | 'NODATA' | 'CLOUD' | 'SHADOW' | 'SATURATED' | 'OUT_OF_RANGE' | 'LOW_QUALITY' | 'UNKNOWN';

/**
 * This codebase never invents a cloud/shadow mask — no dataset it ingests
 * provides one (the fixture raster doesn't, and no real provider is wired
 * up yet). `deriveCellQuality` only ever returns NODATA, VALID, or
 * OUT_OF_RANGE, all derived from data actually present; CLOUD/SHADOW/
 * SATURATED/LOW_QUALITY exist in the type for when a real provider that
 * supplies its own mask is added, and UNKNOWN is what a caller should use
 * for a dataset with no mask information rather than assuming VALID.
 */
export function deriveCellQuality(value: number | null, plausibleRange: [number, number] | null): CellQuality {
  if (value === null) return 'NODATA';
  if (plausibleRange && (value < plausibleRange[0] || value > plausibleRange[1])) return 'OUT_OF_RANGE';
  return 'VALID';
}
