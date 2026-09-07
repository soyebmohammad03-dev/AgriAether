import { describe, expect, it, vi } from 'vitest';
import { SentinelStacProvider } from './SentinelStacProvider';
import { SatelliteProviderError } from './SentinelTypes';

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

function stacFeature(overrides: Partial<{ id: string; datetime: string; cloudCover: number | null; epsg: number; baseline: string; hasRed: boolean; hasNir: boolean }> = {}) {
  const assets: Record<string, unknown> = {};
  if (overrides.hasRed !== false) assets.B04 = { href: 'https://sentinel2l2a01.blob.core.windows.net/fake/B04.tif' };
  if (overrides.hasNir !== false) assets.B08 = { href: 'https://sentinel2l2a01.blob.core.windows.net/fake/B08.tif' };
  return {
    id: overrides.id ?? 'S2A_TEST_ITEM',
    collection: 'sentinel-2-l2a',
    bbox: [-93.65, 42.02, -93.6, 42.06],
    properties: {
      datetime: overrides.datetime ?? '2024-08-31T17:08:51.024000Z',
      'eo:cloud_cover': overrides.cloudCover === undefined ? 0.1 : overrides.cloudCover,
      'proj:epsg': overrides.epsg ?? 32615,
      's2:processing_baseline': overrides.baseline ?? '05.11'
    },
    assets
  };
}

describe('SentinelStacProvider.search (mocked fetch, no live network)', () => {
  it('parses a valid FeatureCollection into SentinelSceneSummary objects', async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [stacFeature()] }), { status: 200 }));
    const provider = new SentinelStacProvider(fetchFn);
    const scenes = await provider.search({ bbox: [-93.65, 42.02, -93.6, 42.06], dateRangeStartIso: '2024-01-01T00:00:00Z', dateRangeEndIso: '2024-12-31T23:59:59Z' });
    expect(scenes).toHaveLength(1);
    expect(scenes[0].itemId).toBe('S2A_TEST_ITEM');
    expect(scenes[0].epsg).toBe(32615);
    expect(scenes[0].assets.RED?.bandId).toBe('B04');
    expect(scenes[0].assets.NIR?.bandId).toBe('B08');
  });

  it('throws MALFORMED_RESPONSE for a non-FeatureCollection body', async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    const provider = new SentinelStacProvider(fetchFn);
    await expect(provider.search({ bbox: [0, 0, 1, 1], dateRangeStartIso: 'x', dateRangeEndIso: 'y' })).rejects.toMatchObject({ kind: 'MALFORMED_RESPONSE' });
  });

  it('throws HTTP on a non-OK response', async () => {
    const fetchFn = mockFetch(async () => new Response('error', { status: 503 }));
    const provider = new SentinelStacProvider(fetchFn);
    await expect(provider.search({ bbox: [0, 0, 1, 1], dateRangeStartIso: 'x', dateRangeEndIso: 'y' })).rejects.toMatchObject({ kind: 'HTTP' });
  });

  it('throws NETWORK when fetch itself rejects', async () => {
    const fetchFn = mockFetch(async () => {
      throw new TypeError('offline');
    });
    const provider = new SentinelStacProvider(fetchFn);
    await expect(provider.search({ bbox: [0, 0, 1, 1], dateRangeStartIso: 'x', dateRangeEndIso: 'y' })).rejects.toMatchObject({ kind: 'NETWORK' });
  });

  it('throws TIMEOUT when the request aborts', async () => {
    const fetchFn = mockFetch(async () => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    });
    const provider = new SentinelStacProvider(fetchFn);
    await expect(provider.search({ bbox: [0, 0, 1, 1], dateRangeStartIso: 'x', dateRangeEndIso: 'y' })).rejects.toMatchObject({ kind: 'TIMEOUT' });
  });

  it('skips (does not throw on) a feature missing required fields, rather than crashing the whole search', async () => {
    const malformedFeature = { id: 'bad', properties: {} }; // no bbox, no assets
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ type: 'FeatureCollection', features: [malformedFeature, stacFeature()] }), { status: 200 }));
    const provider = new SentinelStacProvider(fetchFn);
    const scenes = await provider.search({ bbox: [0, 0, 1, 1], dateRangeStartIso: 'x', dateRangeEndIso: 'y' });
    expect(scenes).toHaveLength(1);
  });
});

describe('SentinelStacProvider.selectBestScene', () => {
  const provider = new SentinelStacProvider();

  it('picks the scene with lowest cloud cover among those with required bands', async () => {
    const fetchFn = mockFetch(async () =>
      new Response(
        JSON.stringify({
          type: 'FeatureCollection',
          features: [stacFeature({ id: 'high_cloud', cloudCover: 40 }), stacFeature({ id: 'low_cloud', cloudCover: 2 })]
        }),
        { status: 200 }
      )
    );
    const p = new SentinelStacProvider(fetchFn);
    const scenes = await p.search({ bbox: [0, 0, 1, 1], dateRangeStartIso: 'x', dateRangeEndIso: 'y' });
    const best = p.selectBestScene(scenes, ['RED', 'NIR']);
    expect(best.itemId).toBe('low_cloud');
  });

  it('rejects a scene missing a required band from the candidate pool', () => {
    const withRedOnly = { itemId: 'x', collection: 'sentinel-2-l2a', selfUrl: null, datetime: '2024-01-01T00:00:00Z', cloudCoverPercent: 1, epsg: 32615, processingBaseline: '05.11', bbox: [0, 0, 1, 1] as [number, number, number, number], assets: { RED: { bandId: 'B04', href: 'https://sentinel2l2a01.blob.core.windows.net/x.tif', resolutionMeters: 10 } } };
    expect(() => provider.selectBestScene([withRedOnly], ['RED', 'NIR'])).toThrow(SatelliteProviderError);
  });

  it('throws NO_SUITABLE_SCENE when nothing qualifies, never silently picking an unsuitable one', () => {
    try {
      provider.selectBestScene([], ['RED', 'NIR']);
      expect.unreachable();
    } catch (error) {
      expect((error as SatelliteProviderError).kind).toBe('NO_SUITABLE_SCENE');
    }
  });
});

describe('SentinelStacProvider.signAssetHref (mocked fetch, no live network)', () => {
  it('signs a trusted blob-storage href successfully', async () => {
    const signedHref = 'https://sentinel2l2a01.blob.core.windows.net/fake/B04.tif?st=x&se=y&sp=r';
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ href: signedHref }), { status: 200 }));
    const provider = new SentinelStacProvider(fetchFn);
    const result = await provider.signAssetHref('https://sentinel2l2a01.blob.core.windows.net/fake/B04.tif');
    expect(result).toBe(signedHref);
  });

  it('refuses to sign/fetch an untrusted host', async () => {
    const provider = new SentinelStacProvider();
    await expect(provider.signAssetHref('https://evil.example.com/malicious.tif')).rejects.toMatchObject({ kind: 'UNTRUSTED_URL' });
  });

  it('refuses a signed response that redirects to an untrusted host', async () => {
    const fetchFn = mockFetch(async () => new Response(JSON.stringify({ href: 'https://evil.example.com/hijacked.tif' }), { status: 200 }));
    const provider = new SentinelStacProvider(fetchFn);
    await expect(provider.signAssetHref('https://sentinel2l2a01.blob.core.windows.net/fake/B04.tif')).rejects.toMatchObject({ kind: 'UNTRUSTED_URL' });
  });
});
