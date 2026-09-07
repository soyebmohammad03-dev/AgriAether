import { describe, expect, it } from 'vitest';
import { assessIrrigationNeed } from './IrrigationIntelligence';

describe('assessIrrigationNeed', () => {
  it('returns INSUFFICIENT_DATA when no moisture status is supplied', () => {
    const result = assessIrrigationNeed({ fieldId: 'f', moistureStatus: null, observations: [], recentRainfallMm: null, recentEvents: [] });
    expect(result.needStatus).toBe('INSUFFICIENT_DATA');
  });

  it('returns LIKELY_NEEDED when DRY with no recent rainfall or irrigation event', () => {
    const result = assessIrrigationNeed({ fieldId: 'f', moistureStatus: 'DRY', observations: [], recentRainfallMm: 0, recentEvents: [] });
    expect(result.needStatus).toBe('LIKELY_NEEDED');
  });

  it('returns NOT_INDICATED when DRY but a recent irrigation event was already logged', () => {
    const result = assessIrrigationNeed({
      fieldId: 'f',
      moistureStatus: 'DRY',
      observations: [],
      recentRainfallMm: 0,
      recentEvents: [{ id: 'e1', fieldId: 'f', zoneId: null, type: 'IRRIGATION', description: 'x', timestamp: Date.now(), source: 'MEASURED' }]
    });
    expect(result.needStatus).toBe('NOT_INDICATED');
  });

  it('returns NOT_INDICATED when SATURATED, flagging waterlogging risk instead of a demand number', () => {
    const result = assessIrrigationNeed({ fieldId: 'f', moistureStatus: 'SATURATED', observations: [], recentRainfallMm: null, recentEvents: [] });
    expect(result.needStatus).toBe('NOT_INDICATED');
  });

  it('never computes a water volume or litres/hectare figure', () => {
    const result = assessIrrigationNeed({ fieldId: 'f', moistureStatus: 'DRY', observations: [], recentRainfallMm: 0, recentEvents: [] });
    expect(result).not.toHaveProperty('litersPerHectare');
    expect(result).not.toHaveProperty('waterVolume');
  });
});
