import { describe, expect, it } from 'vitest';
import { SentinelStacProvider } from './SentinelStacProvider';
import { buildFieldRasterFromSentinelScene } from './SentinelRasterBuilder';
import { analyzeFieldFromSentinelRaster } from './SentinelFieldPipeline';
import { buildRealTestFieldBoundary } from '../world/realTestField';
import { boundingBox } from '../geo/geometry';

/**
 * The ONE real, network-gated, end-to-end proof of this milestone: a real
 * public STAC search against Microsoft Planetary Computer, a real scene, a
 * real windowed COG read (HTTP range requests, no full-file download), a
 * real field clip, and real NDVI — no fixture, no mock, anywhere in this
 * file. Skipped by default (never run as part of normal/offline CI) —
 * enable explicitly with AGRIAETHER_LIVE_SATELLITE_TESTS=1. This test
 * never fabricates success: every assertion is against a value that only
 * exists if the live network chain actually worked end to end.
 */
const LIVE = process.env.AGRIAETHER_LIVE_SATELLITE_TESTS === '1';

describe.skipIf(!LIVE)('Sentinel-2 live integration (real network, gated)', () => {
  it('performs a real STAC search -> real scene -> real raster -> real field clip -> real NDVI', async () => {
    const provider = new SentinelStacProvider();
    const fieldBoundary = buildRealTestFieldBoundary();
    const bbox = boundingBox(fieldBoundary);

    const scenes = await provider.search({
      bbox,
      dateRangeStartIso: '2024-05-01T00:00:00Z',
      dateRangeEndIso: '2024-09-30T23:59:59Z',
      maxCloudCoverPercent: 30,
      limit: 10
    });
    expect(scenes.length).toBeGreaterThan(0);

    const scene = provider.selectBestScene(scenes, ['RED', 'NIR']);
    expect(scene.assets.RED).toBeDefined();
    expect(scene.assets.NIR).toBeDefined();

    const grid = await buildFieldRasterFromSentinelScene({
      scene,
      fieldBboxWgs84: bbox,
      bands: ['RED', 'NIR'],
      signHref: (href) => provider.signAssetHref(href)
    });
    expect(grid.metadata.widthPx).toBeGreaterThan(0);
    expect(grid.metadata.heightPx).toBeGreaterThan(0);

    const result = analyzeFieldFromSentinelRaster({
      grid,
      scene,
      fieldGeometry: fieldBoundary,
      fieldId: 'live_test_field'
    });

    expect(result.validPixelCount).toBeGreaterThan(0);
    expect(result.ndviStats.mean.value).not.toBeNull();
    expect(result.ndviStats.mean.value).toBeGreaterThan(-1);
    expect(result.ndviStats.mean.value).toBeLessThan(1);
    expect(result.ndviObservation).not.toBeNull();
    expect(result.ndviObservation!.provenance).toBe('ESTIMATED');
    expect(result.rawBandObservations.every((o) => o.provenance === 'EXTERNAL')).toBe(true);

    // eslint-disable-next-line no-console
    console.log(
      `LIVE Sentinel-2 result: scene=${scene.itemId} datetime=${scene.datetime} cloudCover=${scene.cloudCoverPercent} ` +
        `NDVI mean=${result.ndviStats.mean.value?.toFixed(4)} min=${result.ndviStats.min.value?.toFixed(4)} max=${result.ndviStats.max.value?.toFixed(4)} ` +
        `validPixels=${result.validPixelCount}/${result.totalPixelCount} quality=${result.quality}`
    );
  }, 60_000);
});

describe('Sentinel-2 live integration gating', () => {
  it('reports why the live test is skipped when the env flag is not set', () => {
    if (!LIVE) {
      console.log('AGRIAETHER_LIVE_SATELLITE_TESTS is not set to "1" — live Sentinel-2 integration test skipped (this is expected in normal/offline CI).');
    }
    expect(true).toBe(true);
  });
});
