import { createId } from '../domain/id';

/**
 * One node in a processing graph — Dataset -> Raster -> Field Clip ->
 * Quality Mask -> Spectral Feature -> ... Every derived artifact this
 * module produces (FieldRasterSubset, spatial statistics, temporal
 * comparisons) carries one of these, so an old result computed with an
 * older `algorithmVersion` never mysteriously changes when the algorithm
 * is updated — the version travels with the result, not just the code.
 */
export interface ProcessingStep {
  id: string;
  /** e.g. "field_clip", "zone_clip", "spatial_statistics", "temporal_comparison". */
  operation: string;
  algorithmVersion: string;
  parentIds: string[];
  parameters: Record<string, string | number | boolean> | null;
  computedAt: number;
}

export function recordProcessingStep(params: {
  operation: string;
  algorithmVersion: string;
  parentIds: string[];
  parameters?: Record<string, string | number | boolean> | null;
}): ProcessingStep {
  return {
    id: createId('processing_step'),
    operation: params.operation,
    algorithmVersion: params.algorithmVersion,
    parentIds: params.parentIds,
    parameters: params.parameters ?? null,
    computedAt: Date.now()
  };
}
