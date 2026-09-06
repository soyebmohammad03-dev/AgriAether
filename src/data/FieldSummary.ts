import type { AnalysisEvaluation } from '../sensing/AnalysisRegistry';
import type { FieldCoverageReport } from './Coverage';
import type { DataGap } from './DataGap';

/**
 * Everything real that's known about a field, assembled from data this
 * codebase already computed elsewhere — never a generic "health score."
 * When nothing agricultural has been analyzed yet, `note` says so in plain
 * language instead of the panel showing an empty or misleading number.
 */
export interface FieldSummary {
  fieldId: string;
  fieldName: string;
  areaHectares: number | null;
  datasetCount: number;
  sensorObservationCount: number;
  latestAcquisition: number | null;
  coverage: FieldCoverageReport;
  gaps: DataGap[];
  availableAnalyses: string[];
  note: string | null;
}

export function buildFieldSummary(params: {
  fieldId: string;
  fieldName: string;
  areaHectares: number | null;
  datasetCount: number;
  sensorObservationCount: number;
  latestAcquisition: number | null;
  coverage: FieldCoverageReport;
  gaps: DataGap[];
  analysisEvaluations: readonly AnalysisEvaluation[];
}): FieldSummary {
  const availableAnalyses = params.analysisEvaluations.filter((e) => e.availability === 'SUPPORTED').map((e) => e.definition.name);
  return {
    fieldId: params.fieldId,
    fieldName: params.fieldName,
    areaHectares: params.areaHectares,
    datasetCount: params.datasetCount,
    sensorObservationCount: params.sensorObservationCount,
    latestAcquisition: params.latestAcquisition,
    coverage: params.coverage,
    gaps: params.gaps,
    availableAnalyses,
    note: availableAnalyses.length === 0 ? 'No agricultural analysis available yet.' : null
  };
}
