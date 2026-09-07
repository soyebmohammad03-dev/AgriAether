import { describe, expect, it } from 'vitest';
import { createDataSourceRecord, builtInDataSources } from './DataSource';

describe('createDataSourceRecord', () => {
  it('requires at least one supported observation type', () => {
    expect(() =>
      createDataSourceRecord({
        type: 'FARMER_ENTRY',
        provider: 'test',
        name: 'Test',
        isExternal: false,
        nature: 'USER_REPORTED',
        supportedObservationTypes: [],
        reliability: 'UNKNOWN',
        ingestionStatus: 'MANUAL_UPLOAD'
      })
    ).toThrow(/at least one/);
  });

  it('refuses a RESEARCH_DATASET claiming CONNECTED without a real provider', () => {
    expect(() =>
      createDataSourceRecord({
        type: 'RESEARCH_DATASET',
        provider: 'Some Institute',
        name: 'Some Dataset',
        isExternal: true,
        nature: 'EXTERNAL',
        supportedObservationTypes: ['soil.moisture'],
        reliability: 'MEDIUM',
        ingestionStatus: 'CONNECTED'
      })
    ).toThrow(/RESEARCH_DATASET/);
  });

  it('allows a RESEARCH_DATASET marked UNCONFIGURED', () => {
    expect(() =>
      createDataSourceRecord({
        type: 'RESEARCH_DATASET',
        provider: 'Some Institute',
        name: 'Some Dataset',
        isExternal: true,
        nature: 'EXTERNAL',
        supportedObservationTypes: ['soil.moisture'],
        reliability: 'MEDIUM',
        ingestionStatus: 'UNCONFIGURED'
      })
    ).not.toThrow();
  });
});

describe('builtInDataSources', () => {
  it('never claims CONNECTED for a manual-upload pathway', () => {
    for (const source of builtInDataSources()) {
      if (source.type === 'CSV_UPLOAD' || source.type === 'GEOJSON_UPLOAD') {
        expect(source.ingestionStatus).toBe('MANUAL_UPLOAD');
      }
    }
  });

  it('produces unique ids', () => {
    const ids = builtInDataSources().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
