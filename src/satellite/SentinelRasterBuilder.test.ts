import { describe, expect, it } from 'vitest';
import { utmProj4Def } from './SentinelRasterBuilder';
import { buildFieldRasterFromSentinelScene } from './SentinelRasterBuilder';
import { SatelliteProviderError, type SentinelSceneSummary } from './SentinelTypes';

describe('utmProj4Def', () => {
  it('builds a northern-hemisphere UTM definition', () => {
    expect(utmProj4Def(32615)).toContain('+zone=15');
    expect(utmProj4Def(32615)).not.toContain('+south');
  });

  it('builds a southern-hemisphere UTM definition', () => {
    expect(utmProj4Def(32715)).toContain('+zone=15');
    expect(utmProj4Def(32715)).toContain('+south');
  });

  it('rejects an EPSG code outside the Sentinel-2 UTM ranges, never guessing a projection', () => {
    expect(() => utmProj4Def(4326)).toThrow(SatelliteProviderError);
    expect(() => utmProj4Def(3857)).toThrow(SatelliteProviderError);
  });
});

function baseScene(overrides: Partial<SentinelSceneSummary> = {}): SentinelSceneSummary {
  return {
    itemId: 'test_item',
    collection: 'sentinel-2-l2a',
    selfUrl: null,
    datetime: '2024-08-31T17:08:51.024000Z',
    cloudCoverPercent: 1,
    epsg: 32615,
    processingBaseline: '05.11',
    bbox: [-93.65, 42.02, -93.6, 42.06],
    assets: { RED: { bandId: 'B04', href: 'https://sentinel2l2a01.blob.core.windows.net/x.tif', resolutionMeters: 10 }, NIR: { bandId: 'B08', href: 'https://sentinel2l2a01.blob.core.windows.net/y.tif', resolutionMeters: 10 } },
    ...overrides
  };
}

describe('buildFieldRasterFromSentinelScene (input validation, no live network)', () => {
  it('throws MISSING_BANDS when a requested band has no asset on the scene', async () => {
    const scene = baseScene({ assets: { RED: { bandId: 'B04', href: 'https://sentinel2l2a01.blob.core.windows.net/x.tif', resolutionMeters: 10 } } });
    await expect(
      buildFieldRasterFromSentinelScene({ scene, fieldBboxWgs84: [-93.62, 42.03, -93.61, 42.04], bands: ['RED', 'NIR'], signHref: async (h) => h })
    ).rejects.toMatchObject({ kind: 'MISSING_BANDS' });
  });

  it('throws MALFORMED_RESPONSE when the scene has no proj:epsg', async () => {
    const scene = baseScene({ epsg: null });
    await expect(
      buildFieldRasterFromSentinelScene({ scene, fieldBboxWgs84: [-93.62, 42.03, -93.61, 42.04], bands: ['RED', 'NIR'], signHref: async (h) => h })
    ).rejects.toMatchObject({ kind: 'MALFORMED_RESPONSE' });
  });
});
