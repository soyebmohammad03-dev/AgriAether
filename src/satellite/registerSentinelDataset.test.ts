import { describe, expect, it } from 'vitest';
import { createSentinelDataSourceRecord, createSentinelDatasetRecord } from './registerSentinelDataset';
import { analyzeFieldFromSentinelRaster } from './SentinelFieldPipeline';
import { buildAgriculturalRasterFixture, FIXTURE_EXTENT } from '../data/fixtures/AgriculturalRasterFixture';
import type { SentinelSceneSummary } from './SentinelTypes';
import type { Polygon } from 'geojson';

function extentAsPolygon(extent: [number, number, number, number]): Polygon {
  const [minLon, minLat, maxLon, maxLat] = extent;
  return { type: 'Polygon', coordinates: [[[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]]] };
}

describe('createSentinelDataSourceRecord', () => {
  it('registers as type SATELLITE, provenance EXTERNAL, and only ever CONNECTED once this module is actually called', () => {
    const source = createSentinelDataSourceRecord();
    expect(source.type).toBe('SATELLITE');
    expect(source.nature).toBe('EXTERNAL');
    expect(source.ingestionStatus).toBe('CONNECTED');
    expect(source.isExternal).toBe(true);
  });
});

describe('createSentinelDatasetRecord', () => {
  it('builds a real DatasetRecord from a real analysis result, preserving scene id/date/CRS/bands', () => {
    const grid = buildAgriculturalRasterFixture();
    const scene: SentinelSceneSummary = {
      itemId: 'S2A_TEST',
      collection: 'sentinel-2-l2a',
      selfUrl: 'https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a/items/S2A_TEST',
      datetime: '2024-08-31T17:08:51.024000Z',
      cloudCoverPercent: 1,
      epsg: 32615,
      processingBaseline: '05.11',
      bbox: FIXTURE_EXTENT,
      assets: {}
    };
    const analysis = analyzeFieldFromSentinelRaster({ grid, scene, fieldGeometry: extentAsPolygon(FIXTURE_EXTENT), fieldId: 'field_1' });
    const dataset = createSentinelDatasetRecord({ analysis, fieldId: 'field_1' });

    expect(dataset.type).toBe('IMAGERY');
    expect(dataset.provenance).toBe('EXTERNAL');
    expect(dataset.crs).toBe('EPSG:4326');
    expect(dataset.bands).toEqual(['RED', 'NIR']);
    expect(dataset.source).toContain('S2A_TEST');
    expect(dataset.fieldId).toBe('field_1');
    expect(dataset.quality).toBe(analysis.quality);
  });
});
