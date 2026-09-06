import { SPECTRAL_INDEX_DEFINITIONS, type SpectralIndexId } from './SpectralIndex';
import type { SpectralBand } from './SpectralBand';
import type { MultispectralReading } from './MultispectralReading';
import type { DataQuality } from './DataQuality';

export interface IndexCalculationResult {
  indexId: SpectralIndexId;
  status: 'OK' | 'UNSUPPORTED' | 'INSUFFICIENT_DATA';
  value: number | null;
  quality: DataQuality;
  method: string;
  requiredBands: SpectralBand[];
  availableBands: SpectralBand[];
  missingBands: SpectralBand[];
  sourceReadingId: string | null;
  computedAt: number;
  reason: string | null;
}

/**
 * The one place a vegetation index is actually computed. This function
 * cannot be called successfully without the exact bands the index's
 * published formula requires — there is no fallback, no substitution, no
 * "close enough" band. An RGB-only reading (no NIR key) always fails here
 * with INSUFFICIENT_DATA; a raw-radiance reading always fails with
 * UNSUPPORTED. Both are real return values, never a fabricated number.
 */
export function calculateIndex(indexId: SpectralIndexId, reading: MultispectralReading): IndexCalculationResult {
  const definition = SPECTRAL_INDEX_DEFINITIONS[indexId];
  const availableBands = Object.keys(reading.bands) as SpectralBand[];
  const missingBands = definition.requiredBands.filter((b) => reading.bands[b] === undefined);
  const computedAt = Date.now();

  if (reading.unitKind !== 'reflectance') {
    return {
      indexId,
      status: 'UNSUPPORTED',
      value: null,
      quality: 'UNSUPPORTED',
      method: definition.formula,
      requiredBands: definition.requiredBands,
      availableBands,
      missingBands,
      sourceReadingId: reading.id,
      computedAt,
      reason: `${indexId} requires calibrated reflectance; this reading is raw radiance (uncalibrated).`
    };
  }

  if (missingBands.length > 0) {
    return {
      indexId,
      status: 'INSUFFICIENT_DATA',
      value: null,
      quality: 'INSUFFICIENT_DATA',
      method: definition.formula,
      requiredBands: definition.requiredBands,
      availableBands,
      missingBands,
      sourceReadingId: reading.id,
      computedAt,
      reason: `${indexId} requires bands [${definition.requiredBands.join(', ')}]; this reading is missing [${missingBands.join(', ')}].`
    };
  }

  const bandValues = reading.bands as Record<SpectralBand, number>;
  const value = definition.calculate(bandValues);
  const inRange = definition.range === null || (value >= definition.range[0] && value <= definition.range[1]);

  return {
    indexId,
    status: 'OK',
    value,
    quality: inRange ? 'VALID' : 'QUESTIONABLE',
    method: definition.formula,
    requiredBands: definition.requiredBands,
    availableBands,
    missingBands: [],
    sourceReadingId: reading.id,
    computedAt,
    reason: inRange ? null : `Computed value ${value.toFixed(3)} falls outside ${indexId}'s defined range — treat as numerically unstable.`
  };
}
