import { describe, expect, it } from 'vitest';
import { validateObservationDraft } from './ImportValidation';
import type { CsvObservationDraft } from './CsvImport';

function draft(overrides: Partial<CsvObservationDraft> = {}): CsvObservationDraft {
  return {
    rowNumber: 2,
    timestampRaw: '2026-01-01T00:00:00Z',
    latRaw: '10',
    lonRaw: '20',
    fieldId: null,
    zoneId: null,
    sensorId: null,
    observationType: 'soil.moisture',
    valueRaw: '35.5',
    unit: 'percent',
    ...overrides
  };
}

describe('validateObservationDraft', () => {
  it('accepts a well-formed row', () => {
    const result = validateObservationDraft(draft());
    expect(result.status).toBe('ACCEPTED');
    expect(result.normalizedValue).toBe(35.5);
    expect(result.normalizedUnit).toBe('percent');
  });

  it('rejects a missing timestamp', () => {
    const result = validateObservationDraft(draft({ timestampRaw: null }));
    expect(result.status).toBe('REJECTED');
    expect(result.errors.some((e) => e.includes('missing timestamp'))).toBe(true);
  });

  it('rejects an unparseable timestamp', () => {
    const result = validateObservationDraft(draft({ timestampRaw: 'not-a-date' }));
    expect(result.status).toBe('REJECTED');
  });

  it('rejects a future timestamp', () => {
    const result = validateObservationDraft(draft({ timestampRaw: new Date(Date.now() + 86_400_000).toISOString() }));
    expect(result.status).toBe('REJECTED');
  });

  it('rejects an out-of-range latitude', () => {
    const result = validateObservationDraft(draft({ latRaw: '200' }));
    expect(result.status).toBe('REJECTED');
  });

  it('rejects latitude without longitude', () => {
    const result = validateObservationDraft(draft({ lonRaw: null }));
    expect(result.status).toBe('REJECTED');
    expect(result.errors.some((e) => e.includes('both be present'))).toBe(true);
  });

  it('warns (does not reject) when neither coordinates nor field/zone are given', () => {
    const result = validateObservationDraft(draft({ latRaw: null, lonRaw: null }));
    expect(result.status).toBe('QUESTIONABLE');
    expect(result.warnings.some((w) => w.includes('globally scoped'))).toBe(true);
  });

  it('rejects a non-numeric value', () => {
    const result = validateObservationDraft(draft({ valueRaw: 'abc' }));
    expect(result.status).toBe('REJECTED');
  });

  it('rejects an incompatible unit for a known observation type', () => {
    const result = validateObservationDraft(draft({ unit: 'kg' }));
    expect(result.status).toBe('REJECTED');
    expect(result.errors.some((e) => e.includes('not compatible'))).toBe(true);
  });

  it('converts a known alternate unit to canonical', () => {
    const result = validateObservationDraft(draft({ observationType: 'soil.temperature', valueRaw: '68', unit: 'degF' }));
    expect(result.status).toBe('QUESTIONABLE');
    expect(result.normalizedUnit).toBe('degC');
    expect(result.normalizedValue).toBeCloseTo(20, 5);
  });

  it('flags a missing unit as questionable and assumes the canonical unit', () => {
    const result = validateObservationDraft(draft({ unit: null }));
    expect(result.status).toBe('QUESTIONABLE');
    expect(result.normalizedUnit).toBe('percent');
  });

  it('rejects a field_id not in the known set', () => {
    const result = validateObservationDraft(draft({ fieldId: 'field_unknown' }), { knownFieldIds: new Set(['field_real']) });
    expect(result.status).toBe('REJECTED');
  });

  it('rejects a sensor producing an observation type outside its declared capabilities', () => {
    const result = validateObservationDraft(draft({ sensorId: 'sensor_1', observationType: 'soil.ph' }), {
      knownSensorCapabilities: (id) => (id === 'sensor_1' ? ['soil.moisture'] : null)
    });
    expect(result.status).toBe('REJECTED');
    expect(result.errors.some((e) => e.includes('does not declare capability'))).toBe(true);
  });

  it('accepts a sensor producing a declared capability', () => {
    const result = validateObservationDraft(draft({ sensorId: 'sensor_1', observationType: 'soil.moisture' }), {
      knownSensorCapabilities: (id) => (id === 'sensor_1' ? ['soil.moisture'] : null)
    });
    expect(result.status).toBe('ACCEPTED');
  });
});
