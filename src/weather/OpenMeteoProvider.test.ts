import { describe, expect, it, vi } from 'vitest';
import { OpenMeteoProvider } from './OpenMeteoProvider';
import { WeatherProviderError } from './WeatherProvider';

const SAMPLE_JSON = {
  latitude: 0,
  longitude: 0,
  current: { time: '2025-01-01T12:00', temperature_2m: 21 }
};

function mockFetch(impl: (url: string) => Promise<Response>): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

describe('OpenMeteoProvider (mocked fetch, no live network)', () => {
  it('normalizes a successful response', async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify(SAMPLE_JSON), { status: 200 }));
    const provider = new OpenMeteoProvider(fetchFn);
    const obs = await provider.fetchCurrent({ lat: 0, lon: 0 });
    expect(obs.airTemperatureC).toBe(21);
    expect(obs.provider).toBe('open-meteo');
  });

  it('throws a WeatherProviderError("HTTP") on a non-OK response', async () => {
    const fetchFn = mockFetch(async () => new Response('server error', { status: 503 }));
    const provider = new OpenMeteoProvider(fetchFn);
    await expect(provider.fetchCurrent({ lat: 0, lon: 0 })).rejects.toMatchObject({ kind: 'HTTP' });
  });

  it('throws a WeatherProviderError("NETWORK") when fetch itself rejects', async () => {
    const fetchFn = mockFetch(async () => {
      throw new TypeError('network unavailable');
    });
    const provider = new OpenMeteoProvider(fetchFn);
    await expect(provider.fetchCurrent({ lat: 0, lon: 0 })).rejects.toMatchObject({ kind: 'NETWORK' });
  });

  it('throws a WeatherProviderError("MALFORMED_RESPONSE") on invalid JSON', async () => {
    const fetchFn = mockFetch(async () => new Response('not json', { status: 200 }));
    const provider = new OpenMeteoProvider(fetchFn);
    await expect(provider.fetchCurrent({ lat: 0, lon: 0 })).rejects.toBeInstanceOf(WeatherProviderError);
  });
});
