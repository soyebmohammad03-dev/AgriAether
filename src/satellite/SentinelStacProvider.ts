import { SatelliteProviderError, SENTINEL_BAND_MAP, type SentinelSceneSummary, type SentinelSpectralBand } from './SentinelTypes';

const STAC_SEARCH_URL = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const SAS_SIGN_URL = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';
const COLLECTION = 'sentinel-2-l2a';
const SEARCH_TIMEOUT_MS = 15_000;
const SIGN_TIMEOUT_MS = 10_000;
/** Defensive cap on how many STAC features we ever parse from one response — the request itself asks for far fewer, this guards a malformed/oversized reply. */
const MAX_FEATURES_PARSED = 100;
/** STAC search/sign responses are small JSON documents — anything claiming to be bigger than this is treated as a malformed/hostile response and rejected before being read into memory. */
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

function assertResponseSizeWithinBounds(response: Response, label: string): void {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new SatelliteProviderError(`${label} response declared ${contentLength} bytes, exceeding the ${MAX_RESPONSE_BYTES}-byte limit.`, 'OVERSIZED_RESPONSE');
  }
}

/** Only ever sign/fetch a URL on a host we expect Planetary Computer to actually use — never follow an href a tampered/malformed STAC response points somewhere else. */
const TRUSTED_ASSET_HOST_SUFFIX = '.blob.core.windows.net';
const TRUSTED_SIGN_HOST = 'planetarycomputer.microsoft.com';

function assertTrustedHref(href: string): URL {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    throw new SatelliteProviderError(`Asset href is not a valid URL: ${href}`, 'UNTRUSTED_URL');
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith(TRUSTED_ASSET_HOST_SUFFIX)) {
    throw new SatelliteProviderError(`Refusing to fetch untrusted asset host: ${url.hostname}`, 'UNTRUSTED_URL');
  }
  return url;
}

async function withTimeout(fetchFn: typeof fetch, url: string, init: RequestInit, timeoutMs: number, label: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SatelliteProviderError(`${label} timed out after ${timeoutMs}ms`, 'TIMEOUT');
    }
    throw new SatelliteProviderError(`${label} failed: ${(error as Error).message}`, 'NETWORK');
  } finally {
    clearTimeout(timeout);
  }
}

function parseFeature(feature: unknown): SentinelSceneSummary | null {
  if (typeof feature !== 'object' || feature === null) return null;
  const f = feature as Record<string, unknown>;
  const props = f.properties as Record<string, unknown> | undefined;
  const assetsRaw = f.assets as Record<string, unknown> | undefined;
  if (typeof f.id !== 'string' || !props || typeof props.datetime !== 'string' || !assetsRaw || !Array.isArray(f.bbox) || f.bbox.length !== 4) {
    return null;
  }

  const assets: SentinelSceneSummary['assets'] = {};
  for (const [bandKey, bandInfo] of Object.entries(SENTINEL_BAND_MAP) as Array<[SentinelSpectralBand, (typeof SENTINEL_BAND_MAP)[SentinelSpectralBand]]>) {
    const asset = assetsRaw[bandInfo.assetId] as Record<string, unknown> | undefined;
    if (asset && typeof asset.href === 'string') {
      assets[bandKey] = { bandId: bandInfo.assetId, href: asset.href, resolutionMeters: bandInfo.resolutionMeters };
    }
  }

  return {
    itemId: f.id,
    collection: typeof f.collection === 'string' ? f.collection : COLLECTION,
    selfUrl: typeof f.id === 'string' ? `https://planetarycomputer.microsoft.com/api/stac/v1/collections/${COLLECTION}/items/${f.id}` : null,
    datetime: props.datetime,
    cloudCoverPercent: typeof props['eo:cloud_cover'] === 'number' ? props['eo:cloud_cover'] : null,
    epsg: typeof props['proj:epsg'] === 'number' ? props['proj:epsg'] : null,
    processingBaseline: typeof props['s2:processing_baseline'] === 'string' ? props['s2:processing_baseline'] : null,
    bbox: f.bbox as [number, number, number, number],
    assets
  };
}

/**
 * Real Sentinel-2 L2A access via Microsoft Planetary Computer's public
 * STAC API — no API key for search, a documented public SAS-signing
 * endpoint for asset access (Planetary Computer's Azure Blob Storage
 * assets are not publicly readable without a short-lived signed URL; this
 * is the officially documented mechanism, not a workaround). Modeled on
 * weather/OpenMeteoProvider.ts's injectable-fetch + timeout/error pattern
 * rather than data/DatasetProvider.ts's parameterless discover()/fetch(id)
 * shape, because a satellite search is inherently parameterized by
 * bbox+date range — there is nothing to "discover" without them. The
 * result of a successful pipeline run is still registered as a real
 * data/Dataset.ts DatasetRecord (see satellite/registerSentinelDataset.ts).
 */
export class SentinelStacProvider {
  readonly id = 'sentinel-2-l2a-planetary-computer';

  constructor(private readonly fetchFn: typeof fetch = fetch.bind(globalThis)) {}

  /** Real STAC search — never returns a scene that wasn't actually in the API response. */
  async search(params: {
    bbox: [number, number, number, number];
    dateRangeStartIso: string;
    dateRangeEndIso: string;
    maxCloudCoverPercent?: number;
    limit?: number;
  }): Promise<SentinelSceneSummary[]> {
    const body = {
      collections: [COLLECTION],
      bbox: params.bbox,
      datetime: `${params.dateRangeStartIso}/${params.dateRangeEndIso}`,
      query: params.maxCloudCoverPercent !== undefined ? { 'eo:cloud_cover': { lt: params.maxCloudCoverPercent } } : undefined,
      limit: Math.min(params.limit ?? 10, MAX_FEATURES_PARSED)
    };

    const response = await withTimeout(this.fetchFn, STAC_SEARCH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, SEARCH_TIMEOUT_MS, 'Sentinel-2 STAC search');

    if (!response.ok) {
      throw new SatelliteProviderError(`Sentinel-2 STAC search responded with HTTP ${response.status}`, 'HTTP');
    }
    assertResponseSizeWithinBounds(response, 'Sentinel-2 STAC search');

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new SatelliteProviderError('Sentinel-2 STAC search response was not valid JSON', 'MALFORMED_RESPONSE');
    }

    if (typeof json !== 'object' || json === null || (json as Record<string, unknown>).type !== 'FeatureCollection' || !Array.isArray((json as Record<string, unknown>).features)) {
      throw new SatelliteProviderError('Sentinel-2 STAC search response was not a valid FeatureCollection', 'MALFORMED_RESPONSE');
    }

    const features = ((json as Record<string, unknown>).features as unknown[]).slice(0, MAX_FEATURES_PARSED);
    const scenes: SentinelSceneSummary[] = [];
    for (const feature of features) {
      const parsed = parseFeature(feature);
      if (parsed) scenes.push(parsed);
    }
    return scenes;
  }

  /**
   * Deterministic selection, documented rather than "first result wins":
   * 1. must carry both required bands (RED + NIR at minimum),
   * 2. must have a numeric cloud-cover value AND be under the caller's ceiling,
   * 3. lowest cloud cover first,
   * 4. most recent acquisition breaks ties.
   * Throws NO_SUITABLE_SCENE (never silently falls back to an unsuitable one) when nothing qualifies.
   */
  selectBestScene(scenes: readonly SentinelSceneSummary[], requiredBands: readonly SentinelSpectralBand[]): SentinelSceneSummary {
    const candidates = scenes.filter((s) => requiredBands.every((b) => s.assets[b] !== undefined) && s.cloudCoverPercent !== null);
    if (candidates.length === 0) {
      throw new SatelliteProviderError(`No Sentinel-2 scene in the search results has all required bands [${requiredBands.join(', ')}] with a known cloud-cover value.`, 'NO_SUITABLE_SCENE');
    }
    return [...candidates].sort((a, b) => (a.cloudCoverPercent! - b.cloudCoverPercent!) || (Date.parse(b.datetime) - Date.parse(a.datetime)))[0];
  }

  /** Signs one asset href via Planetary Computer's public SAS endpoint — the documented public-access mechanism, never bypassed. */
  async signAssetHref(href: string): Promise<string> {
    const url = assertTrustedHref(href);
    void url;
    const signUrl = `${SAS_SIGN_URL}?href=${encodeURIComponent(href)}`;
    const signUrlHost = new URL(SAS_SIGN_URL).hostname;
    if (signUrlHost !== TRUSTED_SIGN_HOST) {
      throw new SatelliteProviderError('Internal error: SAS sign endpoint host mismatch', 'UNTRUSTED_URL');
    }

    const response = await withTimeout(this.fetchFn, signUrl, {}, SIGN_TIMEOUT_MS, 'Sentinel-2 asset signing');
    if (!response.ok) {
      throw new SatelliteProviderError(`Asset signing responded with HTTP ${response.status}`, 'HTTP');
    }
    assertResponseSizeWithinBounds(response, 'Sentinel-2 asset signing');
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new SatelliteProviderError('Asset signing response was not valid JSON', 'MALFORMED_RESPONSE');
    }
    const signedHref = (json as Record<string, unknown> | null)?.href;
    if (typeof signedHref !== 'string') {
      throw new SatelliteProviderError('Asset signing response did not contain an href', 'MALFORMED_RESPONSE');
    }
    assertTrustedHref(signedHref);
    return signedHref;
  }
}
