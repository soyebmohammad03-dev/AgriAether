import { describe, expect, it } from 'vitest';
import { assessCropStress } from './CropStressSignal';

describe('assessCropStress', () => {
  it('returns INSUFFICIENT_DATA when no evidence at all is supplied', () => {
    const result = assessCropStress({ fieldId: 'f' });
    expect(result.status).toBe('INSUFFICIENT_DATA');
    expect(result.signals).toHaveLength(0);
    expect(result.missingEvidence.length).toBeGreaterThan(0);
  });

  it('returns NORMAL when evidence exists and nothing crosses a threshold', () => {
    const result = assessCropStress({
      fieldId: 'f',
      vegetationIndex: { id: 'obs_1', type: 'vegetation_index.ndvi', value: 0.7 },
      soilMoistureStatus: 'ADEQUATE',
      recentTMaxC: 25,
      hasCropObservation: true
    });
    expect(result.status).toBe('NORMAL');
    expect(result.signals).toHaveLength(0);
  });

  it('returns ATTENTION and names the signal when a threshold is crossed', () => {
    const result = assessCropStress({
      fieldId: 'f',
      vegetationIndex: { id: 'obs_1', type: 'vegetation_index.ndvi', value: 0.1 },
      soilMoistureStatus: 'DRY',
      recentTMaxC: 40,
      hasCropObservation: false
    });
    expect(result.status).toBe('ATTENTION');
    const types = result.signals.map((s) => s.type);
    expect(types).toContain('low_vegetation_index');
    expect(types).toContain('soil_moisture_deficit');
    expect(types).toContain('heat_stress_conditions');
  });

  it('never claims a diagnosis — signal descriptions are correlation flags only', () => {
    const result = assessCropStress({ fieldId: 'f', soilMoistureStatus: 'DRY' });
    expect(result.signals[0].description).not.toMatch(/disease|diagnos/i);
  });
});
