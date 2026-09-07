import { describe, expect, it } from 'vitest';
import { createDailyWeatherRecord } from './DailyWeatherRecord';

describe('createDailyWeatherRecord', () => {
  it('accepts a valid record and produces a deterministic id', () => {
    const params = { location: { lat: 10, lon: 20 }, date: '2026-01-01', tMaxC: 25, tMinC: 15, precipitationMm: 2, provider: 'open-meteo-historical', retrievedAt: Date.now() };
    const a = createDailyWeatherRecord(params);
    const b = createDailyWeatherRecord(params);
    expect(a.id).toBe(b.id); // same provider/location/date -> same id, so a re-fetch overwrites rather than duplicates
    expect(a.provenance).toBe('EXTERNAL');
  });

  it('rejects an invalid date format', () => {
    expect(() =>
      createDailyWeatherRecord({ location: { lat: 0, lon: 0 }, date: '01/01/2026', tMaxC: null, tMinC: null, precipitationMm: null, provider: 'x', retrievedAt: Date.now() })
    ).toThrow(/invalid date/);
  });

  it('rejects tMaxC below tMinC', () => {
    expect(() =>
      createDailyWeatherRecord({ location: { lat: 0, lon: 0 }, date: '2026-01-01', tMaxC: 10, tMinC: 20, precipitationMm: null, provider: 'x', retrievedAt: Date.now() })
    ).toThrow(/below tMinC/);
  });

  it('accepts all-null fields as a real "no data reported" day', () => {
    expect(() =>
      createDailyWeatherRecord({ location: { lat: 0, lon: 0 }, date: '2026-01-01', tMaxC: null, tMinC: null, precipitationMm: null, provider: 'x', retrievedAt: Date.now() })
    ).not.toThrow();
  });
});
