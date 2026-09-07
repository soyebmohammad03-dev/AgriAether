/** The Sentinel-2 band ids this pipeline knows how to request, mapped to their AgriAether SpectralBand identity and native resolution. RED/NIR are the minimum for NDVI; GREEN is optional (GNDVI, future RGB preview). */
export const SENTINEL_BAND_MAP = {
  RED: { assetId: 'B04', resolutionMeters: 10 },
  NIR: { assetId: 'B08', resolutionMeters: 10 },
  GREEN: { assetId: 'B03', resolutionMeters: 10 }
} as const;

export type SentinelSpectralBand = keyof typeof SENTINEL_BAND_MAP;

export interface SentinelAssetRef {
  bandId: string; // e.g. "B04"
  href: string; // unsigned catalog href
  resolutionMeters: number;
}

/** One STAC search result, validated and reduced to what this pipeline actually uses — never the raw, untyped STAC JSON passed downstream. */
export interface SentinelSceneSummary {
  itemId: string;
  collection: string;
  selfUrl: string | null;
  datetime: string;
  cloudCoverPercent: number | null;
  epsg: number | null;
  processingBaseline: string | null;
  /** [minLon, minLat, maxLon, maxLat], WGS84 — the STAC item's own bbox. */
  bbox: [number, number, number, number];
  assets: Partial<Record<SentinelSpectralBand, SentinelAssetRef>>;
}

export class SatelliteProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: 'TIMEOUT' | 'NETWORK' | 'HTTP' | 'MALFORMED_RESPONSE' | 'NO_SUITABLE_SCENE' | 'MISSING_BANDS' | 'UNTRUSTED_URL' | 'OVERSIZED_RESPONSE'
  ) {
    super(message);
    this.name = 'SatelliteProviderError';
  }
}
