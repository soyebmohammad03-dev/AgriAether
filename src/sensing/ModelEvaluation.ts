import { createId } from '../domain/id';
import type { ModelRecord } from './ModelRegistry';

export type DatasetSplitRole = 'TRAIN' | 'VALIDATION' | 'TEST';

export interface BaselineComparison {
  baselineName: string;
  baselineMetrics: Record<string, number>;
}

/**
 * One evaluation run for a model — the record a future real training/eval
 * pipeline would produce. This module never computes or invents metrics:
 * `createEvaluationRun` requires the caller to supply real, non-empty
 * `metrics`, and refuses to record a run for a model that hasn't declared
 * which dataset version/split it was measured against. Nothing in
 * PLANNED_MODELS (see ModelRegistry.ts) has ever had one of these created,
 * because none of them has real training/eval data yet — this is
 * infrastructure for when that changes, not a claim that it already has.
 */
export interface EvaluationRun {
  id: string;
  modelId: string;
  modelVersion: string;
  datasetVersion: string;
  splitRole: DatasetSplitRole;
  metrics: Record<string, number>;
  baselineComparison: BaselineComparison | null;
  limitations: string;
  runAt: number;
}

export function createEvaluationRun(params: {
  model: ModelRecord;
  datasetVersion: string;
  splitRole: DatasetSplitRole;
  metrics: Record<string, number>;
  baselineComparison?: BaselineComparison | null;
  limitations: string;
}): EvaluationRun {
  if (Object.keys(params.metrics).length === 0) {
    throw new Error(`EvaluationRun for model "${params.model.id}" requires at least one real metric — metrics are never fabricated.`);
  }
  if (!params.datasetVersion.trim()) {
    throw new Error(`EvaluationRun for model "${params.model.id}" requires a dataset version.`);
  }
  return {
    id: createId('evaluation_run'),
    modelId: params.model.id,
    modelVersion: params.model.version,
    datasetVersion: params.datasetVersion,
    splitRole: params.splitRole,
    metrics: params.metrics,
    baselineComparison: params.baselineComparison ?? null,
    limitations: params.limitations,
    runAt: Date.now()
  };
}
