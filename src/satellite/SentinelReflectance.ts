/**
 * Sentinel-2 L2A pixel values are stored as scaled digital numbers (DN),
 * not reflectance directly. Converting them correctly requires two
 * documented, source-cited facts, not a guess:
 *
 * 1. QUANTIFICATION_VALUE = 10000 — reflectance = DN / 10000 (ESA's
 *    Sentinel-2 User Handbook, unchanged since the mission's L2A product
 *    definition).
 * 2. Starting with Processing Baseline 04.00 (deployed 2022-01-25), ESA
 *    added a fixed BOA_ADD_OFFSET = -1000 to every band's DN before
 *    quantification, to allow small negative reflectance near-zero
 *    surfaces to be represented without clipping at 0. Products from an
 *    earlier baseline do NOT carry this offset. The STAC item property
 *    `s2:processing_baseline` (e.g. "05.11") tells us, per scene, which
 *    rule applies — this module never assumes one baseline for all scenes.
 *    See: https://sentinels.copernicus.eu/web/sentinel/-/copernicus-sentinel-2-major-products-upgrade-upcoming
 *
 * DN === 0 is Sentinel-2's documented nodata sentinel (edge-of-swath /
 * outside footprint) and is checked BEFORE the offset is applied — a real
 * offset-adjusted zero is a valid (very dark) reading, but a raw DN of
 * exactly 0 never is.
 */

const QUANTIFICATION_VALUE = 10000;
const BOA_ADD_OFFSET = -1000;
/** Baseline versions are "MM.mm" strings; 04.00 is the first to carry BOA_ADD_OFFSET. */
const OFFSET_BASELINE_THRESHOLD = 4.0;

export function processingBaselineHasOffset(processingBaseline: string | null): boolean {
  if (!processingBaseline) return false;
  const numeric = Number.parseFloat(processingBaseline);
  return Number.isFinite(numeric) && numeric >= OFFSET_BASELINE_THRESHOLD;
}

/**
 * Converts one raw Sentinel-2 L2A DN to calibrated reflectance [0,1], or
 * null for a nodata pixel. Never clamps a genuinely out-of-range result —
 * the caller (IndexEngine/DataQuality) is responsible for flagging
 * implausible values, this function only does the documented conversion.
 */
export function dnToReflectance(dn: number, processingBaseline: string | null): number | null {
  if (dn === 0) return null;
  const offset = processingBaselineHasOffset(processingBaseline) ? BOA_ADD_OFFSET : 0;
  return (dn + offset) / QUANTIFICATION_VALUE;
}
