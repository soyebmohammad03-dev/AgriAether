import { describe, expect, it, vi } from 'vitest';
import { OpenMeteoHistoricalProvider } from './OpenMeteoHistoricalProvider';
import { WeatherProviderError } from './WeatherProvider';

const SAMPLE_JSON = {
  latitude: 0,
  longitude: 0,
  daily: {
    time: ['2026-01-01', '2026-01-02'],
    temperature_2m_max: [25, 27],
    temperature_2m_min: [15, null],
    precipitation_sum: [0, 3.2]
  }
};

function mockFetch(impl: (url: string) => Promise<Response>): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

describe('OpenMeteoHistoricalProvider (mocked fetch, no live network)', () => {
  it('normalizes a successful daily response, preserving a null field as a real gap', async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify(SAMPLE_JSON), { status: 200 }));
    const provider = new OpenMeteoHistoricalProvider(fetchFn);
    const records = await provider.fetchDailyHistory({ lat: 0, lon: 0 }, 2);
    expect(records).toHaveLength(2);
    expect(records[0].tMaxC).toBe(25);
    expect(records[1].tMinC).toBeNull();
    expect(records.every((r) => r.provenance === 'EXTERNAL')).toBe(true);
  });

  it('throws WeatherProviderError on a non-OK response', async () => {
    const fetchFn = mockFetch(async () => new Response('server error', { status: 503 }));
    const provider = new OpenMeteoHistoricalProvider(fetchFn);
    await expect(provider.fetchDailyHistory({ lat: 0, lon: 0 }, 2)).rejects.toBeInstanceOf(WeatherProviderError);
  });
});
