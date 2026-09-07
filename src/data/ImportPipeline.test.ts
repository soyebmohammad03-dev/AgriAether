import { describe, expect, it } from 'vitest';
import { runCsvObservationImport, runFieldBoundaryImport } from './ImportPipeline';
import { createDataSourceRecord } from './DataSource';
import type { ColumnMapping } from './CsvImport';

const csvSource = createDataSourceRecord({
  type: 'CSV_UPLOAD',
  provider: 'test',
  name: 'Test CSV Source',
  isExternal: true,
  nature: 'MEASURED',
  supportedObservationTypes: ['soil.moisture'],
  reliability: 'MEDIUM',
  ingestionStatus: 'MANUAL_UPLOAD'
});

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

const csvHeader = 'date_time,lat,lon,soil_moisture,unit,obs_type\n';

describe('runCsvObservationImport', () => {
  it('accepts well-formed rows and produces a matching report', () => {
    const csvText = csvHeader + '2026-01-01T00:00:00Z,10,20,35.5,percent,soil.moisture\n2026-01-01T01:00:00Z,10,20,36.1,percent,soil.moisture\n';
    const result = runCsvObservationImport({
      csvText,
      mapping,
      source: csvSource,
      provenance: 'MEASURED',
      existingObservationIds: new Set()
    });

    expect(result.report.recordsReceived).toBe(2);
    expect(result.report.recordsAccepted).toBe(2);
    expect(result.report.recordsRejected).toBe(0);
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted[0].provenance).toBe('MEASURED');
    expect(result.accepted[0].source).toBe(`import:${csvSource.id}`);
    expect(result.accepted[0].location).toEqual({ frame: 'geodetic', crs: 'EPSG:4326', lat: 10, lon: 20 });
  });

  it('rejects malformed rows without dropping the whole import', () => {
    const csvText = csvHeader + '2026-01-01T00:00:00Z,10,20,35.5,percent,soil.moisture\nnot-a-date,10,20,35.5,percent,soil.moisture\n';
    const result = runCsvObservationImport({
      csvText,
      mapping,
      source: csvSource,
      provenance: 'MEASURED',
      existingObservationIds: new Set()
    });
    expect(result.report.recordsAccepted).toBe(1);
    expect(result.report.recordsRejected).toBe(1);
    expect(result.accepted).toHaveLength(1);
  });

  it('is idempotent — importing the same CSV twice skips the second batch as duplicates', () => {
    const csvText = csvHeader + '2026-01-01T00:00:00Z,10,20,35.5,percent,soil.moisture\n';
    const first = runCsvObservationImport({ csvText, mapping, source: csvSource, provenance: 'MEASURED', existingObservationIds: new Set() });
    expect(first.report.recordsAccepted).toBe(1);

    const existingIds = new Set(first.accepted.map((o) => o.id));
    const second = runCsvObservationImport({ csvText, mapping, source: csvSource, provenance: 'MEASURED', existingObservationIds: existingIds });
    expect(second.report.recordsAccepted).toBe(0);
    expect(second.report.duplicatesSkipped).toBe(1);
    expect(second.accepted).toHaveLength(0);
  });

  it('detects duplicates within the same batch', () => {
    const csvText = csvHeader + '2026-01-01T00:00:00Z,10,20,35.5,percent,soil.moisture\n2026-01-01T00:00:00Z,10,20,35.5,percent,soil.moisture\n';
    const result = runCsvObservationImport({ csvText, mapping, source: csvSource, provenance: 'MEASURED', existingObservationIds: new Set() });
    expect(result.report.recordsAccepted).toBe(1);
    expect(result.report.duplicatesSkipped).toBe(1);
  });

  it('reports a completely empty CSV cleanly', () => {
    const result = runCsvObservationImport({ csvText: '', mapping, source: csvSource, provenance: 'MEASURED', existingObservationIds: new Set() });
    expect(result.report.recordsReceived).toBe(0);
    expect(result.report.validationErrors.length).toBeGreaterThan(0);
    expect(result.accepted).toHaveLength(0);
  });
});

const geojsonSource = createDataSourceRecord({
  type: 'GEOJSON_UPLOAD',
  provider: 'test',
  name: 'Test GeoJSON Source',
  isExternal: true,
  nature: 'EXTERNAL',
  supportedObservationTypes: ['field.boundary'],
  reliability: 'MEDIUM',
  ingestionStatus: 'MANUAL_UPLOAD'
});

const validPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [10, 10],
      [10.001, 10],
      [10.001, 10.001],
      [10, 10.001],
      [10, 10]
    ]
  ]
};

describe('runFieldBoundaryImport', () => {
  it('accepts a valid WGS84 polygon with no crs member', () => {
    const result = runFieldBoundaryImport({ raw: validPolygon, source: geojsonSource, provenance: 'EXTERNAL' });
    expect(result.report.recordsAccepted).toBe(1);
    expect(result.geoReference).toEqual({ kind: 'geodetic', crs: 'EPSG:4326', geometry: validPolygon, provenance: 'EXTERNAL' });
    expect(result.areaHectares).not.toBeNull();
  });

  it('rejects a declared non-WGS84 CRS rather than guessing', () => {
    const raw = { ...validPolygon, crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::3857' } } };
    const result = runFieldBoundaryImport({ raw, source: geojsonSource, provenance: 'EXTERNAL' });
    expect(result.report.recordsRejected).toBe(1);
    expect(result.geoReference).toBeNull();
    expect(result.report.validationErrors.some((e) => e.includes('CRS'))).toBe(true);
  });

  it('accepts an explicit CRS84 declaration', () => {
    const raw = { ...validPolygon, crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } } };
    const result = runFieldBoundaryImport({ raw, source: geojsonSource, provenance: 'EXTERNAL' });
    expect(result.report.recordsAccepted).toBe(1);
  });

  it('rejects an invalid geometry (self-intersecting) rather than repairing it into something else', () => {
    const bowtie = {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0]
        ]
      ]
    };
    const result = runFieldBoundaryImport({ raw: bowtie, source: geojsonSource, provenance: 'EXTERNAL' });
    expect(result.report.recordsRejected).toBe(1);
    expect(result.geoReference).toBeNull();
  });

  it('rejects non-GeoJSON input cleanly', () => {
    const result = runFieldBoundaryImport({ raw: { hello: 'world' }, source: geojsonSource, provenance: 'EXTERNAL' });
    expect(result.report.recordsRejected).toBe(1);
  });
});
