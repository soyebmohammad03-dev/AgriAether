import { describe, expect, it } from 'vitest';
import { createDailyWeatherRecord } from './DailyWeatherRecord';
import { growingDegreeDays, summarizeWeatherWindow } from './WeatherIntelligence';

const loc = { lat: 0, lon: 0 };
const records = [
  createDailyWeatherRecord({ location: loc, date: '2026-01-01', tMaxC: 30, tMinC: 20, precipitationMm: 5, provider: 'x', retrievedAt: 0 }),
  createDailyWeatherRecord({ location: loc, date: '2026-01-02', tMaxC: null, tMinC: null, precipitationMm: null, provider: 'x', retrievedAt: 0 }),
  createDailyWeatherRecord({ location: loc, date: '2026-01-03', tMaxC: 20, tMinC: 10, precipitationMm: 0, provider: 'x', retrievedAt: 0 })
];

describe('summarizeWeatherWindow', () => {
  it('averages only real values and counts missing days separately, never assuming zero', () => {
    const summary = summarizeWeatherWindow(records);
    expect(summary.windowDays).toBe(3);
    expect(summary.tMaxAvgC).toBe(25); // (30+20)/2, day 2 excluded
    expect(summary.missingTempDays).toBe(1);
    expect(summary.precipitationTotalMm).toBe(5);
  });
});

describe('growingDegreeDays', () => {
  it('skips days with missing temperature data and reports how many', () => {
    const result = growingDegreeDays(records, 10);
    // day1: max(0,(30+20)/2-10)=15 ; day3: max(0,(20+10)/2-10)=5 ; day2 skipped
    expect(result.totalGdd).toBe(20);
    expect(result.daysUsed).toBe(2);
    expect(result.daysSkippedMissingData).toBe(1);
  });
});
