import { describe, expect, it } from 'vitest';
import { assertValidLatLon, assertValidPolygon, distanceMeters, isPointInPolygon, boundingBox, areaHectares } from './geometry';
import type { Polygon } from 'geojson';

const SQUARE: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-0.001, -0.001],
      [0.001, -0.001],
      [0.001, 0.001],
      [-0.001, 0.001],
      [-0.001, -0.001]
    ]
  ]
};

describe('assertValidLatLon', () => {
  it('accepts valid coordinates', () => {
    expect(() => assertValidLatLon(0, 0)).not.toThrow();
    expect(() => assertValidLatLon(89.9, 179.9)).not.toThrow();
  });

  it('rejects out-of-range latitude', () => {
    expect(() => assertValidLatLon(91, 0)).toThrow(/Invalid latitude/);
  });

  it('rejects out-of-range longitude', () => {
    expect(() => assertValidLatLon(0, 181)).toThrow(/Invalid longitude/);
  });

  it('rejects NaN', () => {
    expect(() => assertValidLatLon(NaN, 0)).toThrow();
  });
});

describe('assertValidPolygon', () => {
  it('accepts a valid closed ring', () => {
    expect(() => assertValidPolygon(SQUARE)).not.toThrow();
  });

  it('rejects an unclosed ring', () => {
    const open: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] };
    expect(() => assertValidPolygon(open)).toThrow(/not closed/);
  });

  it('rejects a ring with fewer than 4 positions', () => {
    const tooShort: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] };
    expect(() => assertValidPolygon(tooShort)).toThrow(/at least 4/);
  });
});

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0);
  });

  it('is approximately 111km per degree of latitude at the equator', () => {
    const d = distanceMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('isPointInPolygon', () => {
  it('detects a point inside the polygon', () => {
    expect(isPointInPolygon({ lat: 0, lon: 0 }, SQUARE)).toBe(true);
  });

  it('detects a point outside the polygon', () => {
    expect(isPointInPolygon({ lat: 10, lon: 10 }, SQUARE)).toBe(false);
  });
});

describe('boundingBox', () => {
  it('matches the square corners', () => {
    expect(boundingBox(SQUARE)).toEqual([-0.001, -0.001, 0.001, 0.001]);
  });
});

describe('areaHectares', () => {
  it('returns a small positive area for the demo-scale square', () => {
    const area = areaHectares(SQUARE);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(10); // ~4.9 ha expected for a ~0.002deg square
  });
});
