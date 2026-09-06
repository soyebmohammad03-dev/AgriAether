import { describe, expect, it } from 'vitest';
import { createDatasetRecord } from './Dataset';

describe('createDatasetRecord', () => {
  it('requires a CRS for RASTER/IMAGERY datasets — never silently assumes WGS84', () => {
    expect(() =>
      createDatasetRecord({
        name: 'Untitled raster',
        provider: 'test',
        source: 'test',
        type: 'RASTER',
        acquiredAtStart: Date.now(),
        provenance: 'SIMULATED',
        quality: 'VALID'
      })
    ).toThrow(/no CRS/);
  });

  it('accepts a TABULAR dataset with no CRS', () => {
    expect(() =>
      createDatasetRecord({
        name: 'Sensor CSV',
        provider: 'test',
        source: 'test.csv',
        type: 'TABULAR',
        acquiredAtStart: Date.now(),
        provenance: 'EXTERNAL',
        quality: 'VALID'
      })
    ).not.toThrow();
  });

  it('retains provider/source/license/attribution for traceability', () => {
    const dataset = createDatasetRecord({
      name: 'Demo field boundary',
      provider: 'AgriAether fixture',
      source: 'geo/demoGeometry.ts',
      type: 'VECTOR',
      acquiredAtStart: Date.now(),
      license: 'N/A — fixture data',
      attribution: 'AgriAether',
      provenance: 'SIMULATED',
      quality: 'VALID'
    });
    expect(dataset.provider).toBe('AgriAether fixture');
    expect(dataset.license).toBe('N/A — fixture data');
  });
});
