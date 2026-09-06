import { describe, expect, it } from 'vitest';
import { generateSyntheticFieldDataset } from './SyntheticDatasetGenerator';
import { calculateIndex } from '../IndexEngine';

describe('generateSyntheticFieldDataset', () => {
  it('is deterministic for a given seed', () => {
    const a = generateSyntheticFieldDataset(42, 5);
    const b = generateSyntheticFieldDataset(42, 5);
    expect(a.multispectralReadings.map((r) => r.bands)).toEqual(b.multispectralReadings.map((r) => r.bands));
  });

  it('produces a different dataset for a different seed', () => {
    const a = generateSyntheticFieldDataset(1, 5);
    const b = generateSyntheticFieldDataset(2, 5);
    expect(a.multispectralReadings.map((r) => r.bands)).not.toEqual(b.multispectralReadings.map((r) => r.bands));
  });

  it('every generated reading is explicitly labeled SIMULATED — never presented as a real measurement', () => {
    const dataset = generateSyntheticFieldDataset(7, 3);
    expect(dataset.multispectralReadings.every((r) => r.provenance === 'SIMULATED')).toBe(true);
    expect(dataset.thermalReadings.every((r) => r.provenance === 'SIMULATED')).toBe(true);
  });

  it('feeds cleanly into the real IndexEngine (all 5 bands present, reflectance-unit)', () => {
    const dataset = generateSyntheticFieldDataset(3, 1);
    const result = calculateIndex('NDVI', dataset.multispectralReadings[0]);
    expect(result.status).toBe('OK');
    expect(result.value).toBeGreaterThanOrEqual(-1);
    expect(result.value).toBeLessThanOrEqual(1);
  });
});
