import type { AgriAetherRepositories } from '../persistence/repositories';
import type { AgriculturalAnalysis } from './AgriculturalAnalysis';
import type { Observation } from '../observation/Observation';
import type { SensorRecord } from '../domain/SensorRecord';

/**
 * Walks Analysis -> its input Observations -> their Sensors, the chain the
 * Phase 4 brief calls the platform's "core differentiator." A read-only
 * query, not a new stored relationship — everything it returns was already
 * recorded by the pipeline stages that produced it (TelemetryGenerator,
 * weatherObservationToObservations, soilSampleToObservations, IndexEngine,
 * TemporalChange, SpatialAggregation all set inputObservationIds/sensorId).
 */
export interface LineageTrace {
  analysis: AgriculturalAnalysis;
  inputObservations: Observation<unknown>[];
  sourceSensors: SensorRecord[];
  /** Observation ids referenced by the analysis that could not be found — a broken or pruned lineage link, reported rather than hidden. */
  missingObservationIds: string[];
}

export async function traceLineage(analysis: AgriculturalAnalysis, repositories: AgriAetherRepositories): Promise<LineageTrace> {
  const inputObservations: Observation<unknown>[] = [];
  const missingObservationIds: string[] = [];

  for (const obsId of analysis.inputObservationIds) {
    const obs = await repositories.observations.getById(obsId);
    if (obs) inputObservations.push(obs);
    else missingObservationIds.push(obsId);
  }

  const sensorIds = Array.from(new Set(inputObservations.map((o) => o.sensorId).filter((id): id is string => !!id)));
  const sourceSensors: SensorRecord[] = [];
  for (const sensorId of sensorIds) {
    const sensor = await repositories.sensors.getById(sensorId);
    if (sensor) sourceSensors.push(sensor);
  }

  return { analysis, inputObservations, sourceSensors, missingObservationIds };
}
