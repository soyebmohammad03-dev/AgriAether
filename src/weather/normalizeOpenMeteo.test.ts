import { describe, expect, it } from 'vitest';
import { normalizeOpenMeteoResponse } from './normalizeOpenMeteo';
import { WeatherProviderError } from './WeatherProvider';

const SAMPLE_RESPONSE = {
  latitude: 0,
  longitude: 0,
  current: {
    time: '2025-01-01T12:00',
    temperature_2m: 24.3,
    relative_humidity_2m: 61,
    pressure_msl: 1011.2,
    wind_speed_10m: 4.1,
    wind_direction_10m: 220,
    precipitation: 0,
    cloud_cover: 55
  }
};

describe('normalizeOpenMeteoResponse', () => {
  it('maps every field to its canonical name and unit', () => {
    const obs = normalizeOpenMeteoResponse(SAMPLE_RESPONSE, { lat: 0, lon: 0 }, Date.now());
    expect(obs.provider).toBe('open-meteo');
    expect(obs.airTemperatureC).toBe(24.3);
    expect(obs.relativeHumidityPercent).toBe(61);
    expect(obs.pressureHpa).toBe(1011.2);
    expect(obs.windSpeedMs).toBe(4.1);
    expect(obs.windDirectionDeg).toBe(220);
    expect(obs.provenance).toBe('EXTERNAL');
  });

  it('keeps observedAt distinct from retrievedAt', () => {
    const retrievedAt = Date.now();
    const obs = normalizeOpenMeteoResponse(SAMPLE_RESPONSE, { lat: 0, lon: 0 }, retrievedAt);
    expect(obs.retrievedAt).toBe(retrievedAt);
    expect(obs.observedAt).not.toBe(retrievedAt);
    expect(obs.observedAt).toBe(Date.parse('2025-01-01T12:00Z'));
  });

  it('keeps the raw response for traceability', () => {
    const obs = normalizeOpenMeteoResponse(SAMPLE_RESPONSE, { lat: 0, lon: 0 }, Date.now());
    expect(obs.raw).toEqual(SAMPLE_RESPONSE);
  });

  it('throws a MALFORMED_RESPONSE error when the current block is missing', () => {
    expect(() => normalizeOpenMeteoResponse({ latitude: 0, longitude: 0 }, { lat: 0, lon: 0 }, Date.now())).toThrow(
      WeatherProviderError
    );
  });

  it('throws when current.time cannot be parsed', () => {
    const bad = { ...SAMPLE_RESPONSE, current: { ...SAMPLE_RESPONSE.current, time: 'not-a-date' } };
    expect(() => normalizeOpenMeteoResponse(bad, { lat: 0, lon: 0 }, Date.now())).toThrow(WeatherProviderError);
  });

  it('maps a missing optional field to null rather than fabricating a value', () => {
    const partial = { latitude: 0, longitude: 0, current: { time: '2025-01-01T12:00', temperature_2m: 20 } };
    const obs = normalizeOpenMeteoResponse(partial, { lat: 0, lon: 0 }, Date.now());
    expect(obs.airTemperatureC).toBe(20);
    expect(obs.windSpeedMs).toBeNull();
  });
});
