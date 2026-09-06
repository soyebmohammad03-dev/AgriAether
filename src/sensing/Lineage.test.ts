import { describe, expect, it } from 'vitest';
import { traceLineage } from './Lineage';
import { createAgriculturalAnalysis } from './AgriculturalAnalysis';
import { createInMemoryRepositories } from '../persistence/repositories';
import { createSensorRecord } from '../domain/SensorRecord';
import type { Observation } from '../observation/Observation';

describe('traceLineage', () => {
  it('walks Analysis -> Observations -> Sensors', async () => {
    const repositories = createInMemoryRepositories();
    const sensor = createSensorRecord({ kind: 'barometer', name: 'Baro', platform: 'drone', capabilities: ['drone.altitude.agl'], isSimulated: true });
    await repositories.sensors.save(sensor);

    const observation: Observation<number> = {
      id: 'obs_1',
      type: 'drone.altitude.agl',
      value: 8,
      unit: 'm',
      timestamp: Date.now(),
      location: null,
      source: 'sim-sensor:barometer',
      provenance: 'SIMULATED',
      confidence: 0.9,
      status: 'OK',
      sensorId: sensor.id
    };
    await repositories.observations.save(observation);

    const analysis = createAgriculturalAnalysis({
      type: 'SPATIAL_AGGREGATION',
      method: 'mean',
      inputObservationIds: ['obs_1', 'obs_missing'],
      result: 8,
      quality: 'VALID',
      provenance: 'ESTIMATED'
    });

    const trace = await traceLineage(analysis, repositories);
    expect(trace.inputObservations.map((o) => o.id)).toEqual(['obs_1']);
    expect(trace.sourceSensors.map((s) => s.id)).toEqual([sensor.id]);
    expect(trace.missingObservationIds).toEqual(['obs_missing']);
  });
});
