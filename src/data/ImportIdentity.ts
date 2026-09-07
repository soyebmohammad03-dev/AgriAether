/**
 * Deterministic identity for imported records — the mechanism that makes a
 * re-run of the same import idempotent (Phase 7, Part 7). domain/id.ts's
 * `createId` is intentionally random (time+counter), which is right for
 * anything created fresh inside the app but wrong here: importing the same
 * CSV twice must produce the same observation id both times, so the second
 * import overwrites identical content instead of duplicating rows.
 *
 * FNV-1a: a small, well-known non-cryptographic hash — good enough for a
 * stable content key, not intended to resist tampering.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Builds a stable id for an imported Observation from the fields that
 * define its identity: which source it came from, and what it says. Two
 * rows with identical (sourceId, type, timestamp, value, unit, location,
 * fieldId/zoneId/sensorId) collapse to the same id — that IS the duplicate
 * definition used by ImportPipeline.ts's dedupe check.
 */
export function deterministicObservationId(parts: {
  sourceId: string;
  type: string;
  timestamp: number;
  value: unknown;
  unit: string | null;
  lat?: number | null;
  lon?: number | null;
  fieldId?: string | null;
  zoneId?: string | null;
  sensorId?: string | null;
}): string {
  const key = [
    parts.sourceId,
    parts.type,
    parts.timestamp,
    JSON.stringify(parts.value),
    parts.unit ?? '',
    parts.lat ?? '',
    parts.lon ?? '',
    parts.fieldId ?? '',
    parts.zoneId ?? '',
    parts.sensorId ?? ''
  ].join('|');
  return `obs_import_${fnv1a(key)}`;
}

/** Same idea for a field boundary import — identity is the source + the raw geometry text, so re-importing an unchanged boundary is a no-op, not a duplicate field. */
export function deterministicFieldBoundaryId(sourceId: string, farmId: string, rawGeometryJson: string): string {
  return `field_import_${fnv1a(`${sourceId}|${farmId}|${rawGeometryJson}`)}`;
}
