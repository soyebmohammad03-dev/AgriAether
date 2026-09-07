import type { DatasetRecord } from '../data/Dataset';
import type { ModelRecord } from '../sensing/ModelRegistry';
import type { Experiment } from './Experiment';
import type { DecisionTrace } from '../explainability/DecisionTrace';

export type ResearchCatalogEntryKind = 'dataset' | 'model' | 'experiment' | 'decision_trace';

export interface ResearchCatalogEntry {
  kind: ResearchCatalogEntryKind;
  refId: string;
  title: string;
  provenance: string;
  createdAt: number;
}

/**
 * A read-only index over records this codebase already maintains
 * (DatasetRecord, ModelRecord, Experiment, DecisionTrace) — not a new
 * store. Exists so a researcher can see "what data/models/experiments
 * touch this field" in one list instead of four separate panels. Every
 * entry's `refId` points at a real record elsewhere; nothing here is
 * synthesized.
 */
export function buildResearchCatalog(params: {
  datasets: readonly DatasetRecord[];
  models: readonly ModelRecord[];
  experiments: readonly Experiment[];
  decisionTraces: readonly DecisionTrace[];
}): ResearchCatalogEntry[] {
  return [
    ...params.datasets.map((d) => ({ kind: 'dataset' as const, refId: d.id, title: d.name, provenance: d.provenance, createdAt: d.createdAt })),
    ...params.models.map((m) => ({ kind: 'model' as const, refId: m.id, title: `${m.name} (${m.deploymentStatus})`, provenance: m.trainingDatasetRef ?? 'no training dataset', createdAt: 0 })),
    ...params.experiments.map((e) => ({ kind: 'experiment' as const, refId: e.id, title: e.name, provenance: e.provenance, createdAt: e.createdAt })),
    ...params.decisionTraces.map((t) => ({ kind: 'decision_trace' as const, refId: t.id, title: `Trace: ${t.explanation.subjectType}`, provenance: t.explanation.provenance, createdAt: t.generatedAt }))
  ].sort((a, b) => b.createdAt - a.createdAt);
}
