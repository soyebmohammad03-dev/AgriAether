import { assertValidLatLon } from '../geo/geometry';
import { fahrenheitToCelsius, inchesToMillimeters } from '../sensing/Units';
import type { CsvObservationDraft } from './CsvImport';

/**
 * The canonical unit AgriAether stores each importable observation type in,
 * plus any alternate unit this module knows how to convert from — never a
 * silent unit reinterpretation. Reuses the exact unit strings soil/SoilSample.ts
 * and weather/weatherObservationToObservations.ts already use, so an
 * imported observation is unit-compatible with the equivalent live-pipeline
 * observation.
 */
const CANONICAL_UNITS: Record<string, { canonical: string; convertFrom?: Record<string, (v: number) => number> }> = {
  'soil.moisture': { canonical: 'percent' },
  'soil.temperature': { canonical: 'degC', convertFrom: { degF: fahrenheitToCelsius, F: fahrenheitToCelsius } },
  'soil.ec': { canonical: 'dS/m' },
  'soil.ph': { canonical: 'pH' },
  'soil.nitrogen': { canonical: 'ppm' },
  'soil.phosphorus': { canonical: 'ppm' },
  'soil.potassium': { canonical: 'ppm' },
  'air.temperature': { canonical: 'degC', convertFrom: { degF: fahrenheitToCelsius, F: fahrenheitToCelsius } },
  'weather.air_temperature': { canonical: 'degC', convertFrom: { degF: fahrenheitToCelsius, F: fahrenheitToCelsius } },
  humidity: { canonical: 'percent' },
  'weather.relative_humidity': { canonical: 'percent' },
  precipitation: { canonical: 'mm', convertFrom: { in: inchesToMillimeters, inches: inchesToMillimeters } },
  'weather.precipitation': { canonical: 'mm', convertFrom: { in: inchesToMillimeters, inches: inchesToMillimeters } }
};

export function knownCanonicalUnitTypes(): string[] {
  return Object.keys(CANONICAL_UNITS);
}

export type RowStatus = 'ACCEPTED' | 'QUESTIONABLE' | 'REJECTED';

export interface RowValidationResult {
  status: RowStatus;
  errors: string[];
  warnings: string[];
  /** Set only on ACCEPTED/QUESTIONABLE — the value normalized into the canonical unit, if a conversion table applies; otherwise the raw parsed number unchanged. */
  normalizedValue: number | null;
  normalizedUnit: string | null;
  lat: number | null;
  lon: number | null;
  timestamp: number | null;
}

export interface RowValidationContext {
  /** Sensor capability check (Part 6) — pass the sensor's declared capabilities if sensorId is set and known; undefined if the sensor is unknown (flagged as a warning, not a hard rejection, since a CSV sensor id may simply not be registered yet). */
  knownSensorCapabilities?: (sensorId: string) => readonly string[] | null;
  /** Known field/zone ids, for ownership validation (Part 6) — a row naming an unknown field/zone is rejected, never silently accepted with a dangling reference. */
  knownFieldIds?: ReadonlySet<string>;
  knownZoneIds?: ReadonlySet<string>;
  /** Rows older than this are flagged QUESTIONABLE (stale), never rejected outright — staleness is a quality signal, not a structural defect. */
  staleAfterMs?: number;
  now?: number;
}

/**
 * Validates and normalizes one CSV draft row against the reusable rules from
 * Part 6: required fields, timestamp validity, coordinate validity, unit
 * compatibility, numeric validity, impossible/null values, field/zone
 * ownership, and sensor capability compatibility. Duplicate detection is
 * intentionally NOT here — it needs the whole batch/repository, see
 * ImportPipeline.ts.
 */
export function validateObservationDraft(draft: CsvObservationDraft, context: RowValidationContext = {}): RowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.observationType.trim()) {
    errors.push(`Row ${draft.rowNumber}: missing observation_type.`);
  }
  if (!draft.valueRaw.trim()) {
    errors.push(`Row ${draft.rowNumber}: missing value.`);
  }

  // Timestamp
  let timestamp: number | null = null;
  if (!draft.timestampRaw) {
    errors.push(`Row ${draft.rowNumber}: missing timestamp.`);
  } else {
    const parsed = Date.parse(draft.timestampRaw);
    if (Number.isNaN(parsed)) {
      errors.push(`Row ${draft.rowNumber}: unparseable timestamp "${draft.timestampRaw}".`);
    } else {
      timestamp = parsed;
      const now = context.now ?? Date.now();
      if (timestamp > now + 60_000) {
        errors.push(`Row ${draft.rowNumber}: timestamp is in the future.`);
      } else if (context.staleAfterMs !== undefined && now - timestamp > context.staleAfterMs) {
        warnings.push(`Row ${draft.rowNumber}: observation is older than the configured staleness threshold.`);
      }
    }
  }

  // Coordinates — optional, but if either is present both must be, and both must be valid.
  let lat: number | null = null;
  let lon: number | null = null;
  const hasLat = draft.latRaw !== null;
  const hasLon = draft.lonRaw !== null;
  if (hasLat !== hasLon) {
    errors.push(`Row ${draft.rowNumber}: latitude and longitude must both be present or both be absent.`);
  } else if (hasLat && hasLon) {
    const latNum = Number(draft.latRaw);
    const lonNum = Number(draft.lonRaw);
    try {
      assertValidLatLon(latNum, lonNum);
      lat = latNum;
      lon = lonNum;
    } catch (error) {
      errors.push(`Row ${draft.rowNumber}: ${(error as Error).message}`);
    }
  }

  // Location context — a row must establish location SOME way: coordinates, or field/zone.
  if (!hasLat && !draft.fieldId && !draft.zoneId) {
    warnings.push(`Row ${draft.rowNumber}: no coordinates, field_id, or zone_id — observation will be globally scoped.`);
  }
  if (draft.fieldId && context.knownFieldIds && !context.knownFieldIds.has(draft.fieldId)) {
    errors.push(`Row ${draft.rowNumber}: field_id "${draft.fieldId}" does not match any known field.`);
  }
  if (draft.zoneId && context.knownZoneIds && !context.knownZoneIds.has(draft.zoneId)) {
    errors.push(`Row ${draft.rowNumber}: zone_id "${draft.zoneId}" does not match any known zone.`);
  }

  // Sensor capability (Part 6): a sensor known to the world but not declaring this observation type is rejected.
  if (draft.sensorId && context.knownSensorCapabilities) {
    const capabilities = context.knownSensorCapabilities(draft.sensorId);
    if (capabilities !== null && draft.observationType && !capabilities.includes(draft.observationType)) {
      errors.push(
        `Row ${draft.rowNumber}: sensor "${draft.sensorId}" does not declare capability for "${draft.observationType}" (declares: ${capabilities.join(', ') || 'none'}).`
      );
    }
  }

  // Numeric validity + unit compatibility
  let normalizedValue: number | null = null;
  let normalizedUnit: string | null = draft.unit;
  const numericValue = Number(draft.valueRaw);
  if (draft.valueRaw.trim() && (Number.isNaN(numericValue) || !Number.isFinite(numericValue))) {
    errors.push(`Row ${draft.rowNumber}: value "${draft.valueRaw}" is not a valid number.`);
  } else if (draft.valueRaw.trim()) {
    const rule = CANONICAL_UNITS[draft.observationType];
    if (rule) {
      if (!draft.unit) {
        warnings.push(`Row ${draft.rowNumber}: no unit given for "${draft.observationType}" — assuming canonical unit "${rule.canonical}".`);
        normalizedValue = numericValue;
        normalizedUnit = rule.canonical;
      } else if (draft.unit === rule.canonical) {
        normalizedValue = numericValue;
        normalizedUnit = rule.canonical;
      } else if (rule.convertFrom?.[draft.unit]) {
        normalizedValue = rule.convertFrom[draft.unit](numericValue);
        normalizedUnit = rule.canonical;
        warnings.push(`Row ${draft.rowNumber}: converted "${draft.unit}" to canonical unit "${rule.canonical}".`);
      } else {
        errors.push(`Row ${draft.rowNumber}: unit "${draft.unit}" is not compatible with observation type "${draft.observationType}" (expected "${rule.canonical}").`);
      }
    } else {
      // Unknown observation type to this validator — accepted as QUESTIONABLE, never silently normalized.
      normalizedValue = numericValue;
      warnings.push(`Row ${draft.rowNumber}: observation type "${draft.observationType}" has no known canonical unit — unit not validated.`);
    }
  }

  if (errors.length > 0) {
    return { status: 'REJECTED', errors, warnings, normalizedValue: null, normalizedUnit: null, lat, lon, timestamp };
  }
  return {
    status: warnings.length > 0 ? 'QUESTIONABLE' : 'ACCEPTED',
    errors,
    warnings,
    normalizedValue,
    normalizedUnit,
    lat,
    lon,
    timestamp
  };
}
