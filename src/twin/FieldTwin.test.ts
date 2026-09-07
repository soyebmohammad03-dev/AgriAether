import { describe, expect, it } from 'vitest';
import { buildFieldTwin } from './FieldTwin';
import { createField } from '../domain/Field';
import { createSoilSample } from '../soil/SoilSample';
import type { FieldCoverageReport } from '../data/Coverage';

const field = createField({ farmId: 'farm_1', name: 'Field 01', geoReference: { kind: 'simulation' } });

const coverage: FieldCoverageReport = {
  fieldId: field.id,
  spatialCoveragePercent: null,
  sensorCoverage: { rgb: 'unavailable', multispectral: 'unavailable', thermal: 'unavailable', soil: 'unavailable', weather: 'unavailable' },
  temporalCoverage: { earliestObservation: null, latestObservation: null },
  freshnessMs: null
};

describe('buildFieldTwin', () => {
  it('reports INSUFFICIENT_DATA for soil/weather when nothing has been recorded, never a fabricated value', () => {
    const twin = buildFieldTwin({
      field,
      zones: [],
      activeSensors: [],
      recentObservations: [],
      soilSamples: [],
      cropObservations: [],
      dailyWeatherRecords: [],
      coverage,
      dataGaps: []
    });
    expect(twin.soilState).toBe('INSUFFICIENT_DATA');
    expect(twin.weatherState).toBe('INSUFFICIENT_DATA');
    expect(twin.cropState.observationCount).toBe(0);
    expect(twin.vegetationEvidence).toEqual([]);
    expect(twin.diseasePestRisk.status).toBe('INSUFFICIENT_DATA');
  });

  it('summarizes the latest soil sample when one exists, keyed to real recorded measurements', () => {
    const sample = createSoilSample({ fieldId: field.id, method: 'FIELD_SAMPLING', measurements: { moisturePercent: 22 } });
    const twin = buildFieldTwin({
      field,
      zones: [],
      activeSensors: [],
      recentObservations: [],
      soilSamples: [sample],
      cropObservations: [],
      dailyWeatherRecords: [],
      coverage,
      dataGaps: []
    });
    expect(twin.soilState).not.toBe('INSUFFICIENT_DATA');
    if (twin.soilState !== 'INSUFFICIENT_DATA') {
      expect(twin.soilState.moistureStatus).toBe('ADEQUATE');
    }
  });
});
