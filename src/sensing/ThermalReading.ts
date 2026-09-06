import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';

/**
 * Three distinct things this module deliberately keeps separate, per the
 * Phase 4 brief — collapsing them is exactly how "it's a bit warm" becomes
 * "water stress detected":
 *
 * 1. ThermalReading — a MEASURED temperature (surface or canopy), nothing more.
 * 2. ThermalFeature — a DERIVED quantity computed from one or more readings
 *    (e.g. a temperature difference between two zones), still just physics.
 * 3. Agricultural interpretation of a ThermalFeature (e.g. "possible water
 *    stress") is NOT modeled here at all — that requires a validated model
 *    and belongs to AgriculturalAnalysis (see AgriculturalAnalysis.ts),
 *    never asserted directly from a temperature number.
 */
export type ThermalTarget = 'CANOPY' | 'SOIL_SURFACE' | 'AIR' | 'UNKNOWN';

export interface ThermalReading {
  id: string;
  target: ThermalTarget;
  temperatureC: number;
  capturedAt: number;
  sensorId: string | null;
  fieldId: string | null;
  zoneId: string | null;
  provenance: Provenance;
}

export function createThermalReading(params: {
  target: ThermalTarget;
  temperatureC: number;
  capturedAt: number;
  sensorId?: string | null;
  fieldId?: string | null;
  zoneId?: string | null;
  provenance: Provenance;
}): ThermalReading {
  if (params.temperatureC < -90 || params.temperatureC > 90) {
    throw new Error(`ThermalReading temperature ${params.temperatureC}°C is outside a plausible surface/canopy/air range`);
  }
  return {
    id: createId('thermal_reading'),
    target: params.target,
    temperatureC: params.temperatureC,
    capturedAt: params.capturedAt,
    sensorId: params.sensorId ?? null,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    provenance: params.provenance
  };
}

export interface ThermalFeature {
  id: string;
  /** e.g. "canopy_minus_air_temperature_difference" — a documented, named computation, not a black box. */
  method: string;
  valueC: number;
  inputReadingIds: string[];
  computedAt: number;
}

/** A documented, deterministic thermal feature: canopy temperature minus air temperature. Nothing agronomic is claimed about the result here. */
export function computeCanopyAirTemperatureDifference(canopy: ThermalReading, air: ThermalReading): ThermalFeature {
  if (canopy.target !== 'CANOPY' || air.target !== 'AIR') {
    throw new Error('computeCanopyAirTemperatureDifference requires one CANOPY and one AIR reading');
  }
  return {
    id: createId('thermal_feature'),
    method: 'canopy_minus_air_temperature_difference',
    valueC: canopy.temperatureC - air.temperatureC,
    inputReadingIds: [canopy.id, air.id],
    computedAt: Date.now()
  };
}
