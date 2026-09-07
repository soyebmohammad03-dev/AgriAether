import { describe, expect, it } from 'vitest';
import { ingestFieldBoundaryGeoJson } from './GeoJsonIngestion';
import { buildDemoFieldBoundary } from '../geo/demoGeometry';
import type { Polygon } from 'geojson';

describe('ingestFieldBoundaryGeoJson', () => {
  it('accepts the existing demo field boundary as VALID', () => {
    const result = ingestFieldBoundaryGeoJson(buildDemoFieldBoundary());
    expect(result.status).toBe('VALID');
    expect(result.geometry).not.toBeNull();
    expect(result.areaHectares).toBeGreaterThan(0);
    expect(result.boundingBox).not.toBeNull();
  });

  it('repairs an unclosed ring and records the repair — never silently', () => {
    const unclosed: Polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [0.001, 0], [0.001, 0.001], [0, 0.001]]] // not closed
    };
    const result = ingestFieldBoundaryGeoJson(unclosed);
    expect(result.status).toBe('REPAIRED');
    expect(result.repairMethod).toBe('CLOSED_RING');
    expect(result.geometry).not.toBeNull();
    expect(result.originalGeometry).toEqual(unclosed);
  });

  it('rejects an unsupported geometry type', () => {
    const point = { type: 'Point', coordinates: [0, 0] } as unknown as Polygon;
    const result = ingestFieldBoundaryGeoJson(point);
    expect(result.status).toBe('INVALID');
    expect(result.geometry).toBeNull();
    expect(result.issues[0]).toMatch(/Unsupported geometry type/);
  });

  it('rejects out-of-range coordinates rather than silently accepting them', () => {
    const invalid: Polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [200, 0], [200, 95], [0, 95], [0, 0]]] // lon/lat out of range
    };
    const result = ingestFieldBoundaryGeoJson(invalid);
    expect(result.status).toBe('INVALID');
    expect(result.geometry).toBeNull();
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('rejects a ring with too few positions', () => {
    const tooFew: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] };
    const result = ingestFieldBoundaryGeoJson(tooFew);
    expect(result.status).toBe('INVALID');
  });

  it('rejects a self-intersecting polygon (bowtie)', () => {
    const bowtie: Polygon = {
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]]
    };
    const result = ingestFieldBoundaryGeoJson(bowtie);
    expect(result.status).toBe('INVALID');
    expect(result.issues.some((i) => i.includes('self-intersecting'))).toBe(true);
  });

  it('rejects a geometry with more vertices than the limit, before doing any expensive processing', () => {
    const hugeRing: number[][] = Array.from({ length: 50_001 }, (_, i) => [i % 180, 0]);
    hugeRing.push(hugeRing[0]);
    const oversized: Polygon = { type: 'Polygon', coordinates: [hugeRing] };
    const result = ingestFieldBoundaryGeoJson(oversized);
    expect(result.status).toBe('INVALID');
    expect(result.issues[0]).toMatch(/vertex limit/);
  });
});
