import { describe, expect, it } from 'vitest';
import { parseCsv, mapCsvRowsToDrafts, type ColumnMapping } from './CsvImport';

describe('parseCsv', () => {
  it('parses a simple header + rows', () => {
    const result = parseCsv('date_time,lat,lon,soil_moisture,unit\n2026-01-01T00:00:00Z,10,20,35.5,percent\n');
    expect(result.errors).toEqual([]);
    expect(result.header).toEqual(['date_time', 'lat', 'lon', 'soil_moisture', 'unit']);
    expect(result.rows).toEqual([['2026-01-01T00:00:00Z', '10', '20', '35.5', 'percent']]);
  });

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    const result = parseCsv('name,note\n"Field A","has a ""quote"", and a comma"\n');
    expect(result.rows).toEqual([['Field A', 'has a "quote", and a comma']]);
  });

  it('reports an empty file as an error', () => {
    const result = parseCsv('   \n');
    expect(result.errors).toEqual(['CSV file is empty.']);
  });

  it('reports a ragged row (wrong field count) and skips it, keeping well-formed rows', () => {
    const result = parseCsv('a,b\n1,2\n3\n4,5\n');
    expect(result.rows).toEqual([['1', '2'], ['4', '5']]);
    expect(result.errors.some((e) => e.includes('Row 3'))).toBe(true);
  });

  it('rejects a field longer than the max field length', () => {
    const longValue = 'x'.repeat(10_001);
    const result = parseCsv(`a\n${longValue}\n`);
    expect(result.rows).toEqual([]);
    expect(result.errors.some((e) => e.includes('longer than'))).toBe(true);
  });
});

describe('mapCsvRowsToDrafts', () => {
  const mapping: ColumnMapping = {
    timestamp: 'date_time',
    latitude: 'lat',
    longitude: 'lon',
    fieldId: null,
    zoneId: null,
    sensorId: null,
    observationType: 'obs_type',
    value: 'soil_moisture',
    unit: 'unit'
  };
  const header = ['date_time', 'lat', 'lon', 'soil_moisture', 'unit', 'obs_type'];

  it('maps columns by name, independent of column order', () => {
    const rows = [['2026-01-01T00:00:00Z', '10', '20', '35.5', 'percent', 'soil.moisture']];
    const drafts = mapCsvRowsToDrafts(header, rows, mapping);
    expect(drafts).toEqual([
      {
        rowNumber: 2,
        timestampRaw: '2026-01-01T00:00:00Z',
        latRaw: '10',
        lonRaw: '20',
        fieldId: null,
        zoneId: null,
        sensorId: null,
        observationType: 'soil.moisture',
        valueRaw: '35.5',
        unit: 'percent'
      }
    ]);
  });

  it('treats an empty cell as absent, not as an empty string', () => {
    const rows = [['2026-01-01T00:00:00Z', '', '', '35.5', '', 'soil.moisture']];
    const drafts = mapCsvRowsToDrafts(header, rows, mapping);
    expect(drafts[0].latRaw).toBeNull();
    expect(drafts[0].unit).toBeNull();
  });
});
