import { describe, expect, it } from 'vitest';
import { simulationLocalToDemoGeodetic } from './georeference';

describe('simulationLocalToDemoGeodetic (DEMO ONLY transform)', () => {
  it('maps the local origin exactly onto the anchor', () => {
    const anchor = { lat: 0, lon: 0 };
    expect(simulationLocalToDemoGeodetic(anchor, { x: 0, z: 0 })).toEqual({ lat: 0, lon: 0 });
  });

  it('moving +z moves north (increasing latitude) at the equator', () => {
    const anchor = { lat: 0, lon: 0 };
    const result = simulationLocalToDemoGeodetic(anchor, { x: 0, z: 111_320 });
    expect(result.lat).toBeCloseTo(1, 1);
    expect(result.lon).toBeCloseTo(0, 5);
  });

  it('moving +x moves east (increasing longitude) at the equator', () => {
    const anchor = { lat: 0, lon: 0 };
    const result = simulationLocalToDemoGeodetic(anchor, { x: 111_320, z: 0 });
    expect(result.lon).toBeCloseTo(1, 1);
    expect(result.lat).toBeCloseTo(0, 5);
  });
});
