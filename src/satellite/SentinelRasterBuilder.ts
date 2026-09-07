import { fromUrl } from 'geotiff';
import proj4 from 'proj4';
import { createRasterMetadata, RasterGrid, type RasterBandMetadata } from '../data/Raster';
import { dnToReflectance } from './SentinelReflectance';
import { SatelliteProviderError, SENTINEL_BAND_MAP, type SentinelSceneSummary, type SentinelSpectralBand } from './SentinelTypes';

/** Hard cap on requested raster width/height — prevents unbounded memory allocation from an oversized field bbox or a malformed scene, per the security requirements of this milestone. 512px at 10m native resolution is >5km per side, far larger than any real field this app models. */
const MAX_RASTER_DIMENSION = 512;
/** Sentinel-2 nodata sentinel written into RasterGrid cells so the existing RasterGrid.isNodata/getCell machinery treats them exactly like the fixture pipeline's nodata handling — never a raw 0 DN, never a fabricated "valid-looking" value. */
const NODATA_SENTINEL = -9999;

/** Sentinel-2 STAC items are always projected to a UTM zone (326xx = north, 327xx = south) — derived programmatically rather than hardcoding a lookup table, and rejected outright if the EPSG code claimed by the (untrusted) STAC metadata doesn't actually fall in that range. */
export function utmProj4Def(epsg: number): string {
  if (epsg >= 32601 && epsg <= 32660) return `+proj=utm +zone=${epsg - 32600} +datum=WGS84 +units=m +no_defs`;
  if (epsg >= 32701 && epsg <= 32760) return `+proj=utm +zone=${epsg - 32700} +south +datum=WGS84 +units=m +no_defs`;
  throw new SatelliteProviderError(`Scene EPSG ${epsg} is not a recognized Sentinel-2 UTM zone (32601-32660 or 32701-32760) — refusing to reproject against an untrusted/unexpected CRS.`, 'MALFORMED_RESPONSE');
}

/**
 * Reads real Sentinel-2 pixel data for one field's bounding box out of a
 * remote Cloud-Optimized GeoTIFF (via HTTP range requests — geotiff.js
 * never downloads the full ~100MB+ band file, only the tiles the
 * requested window intersects) and returns it as the EXISTING
 * data/Raster.ts RasterGrid/RasterMetadata — no parallel pixel-raster type
 * is introduced. The WGS84 field bbox is reprojected into the scene's
 * native UTM CRS (proj4) to know which window to request; the returned
 * grid's `extent` is then the corresponding WGS84 bounding box of that
 * window — an axis-aligned approximation of a UTM rectangle, the same
 * field-scale "flat enough to treat as rectangular" approximation this
 * codebase already uses in geo/georeference.ts, accurate at the few-
 * hundred-meter scale a field actually spans.
 *
 * Resampling: geotiff.js resamples the native 10m-pixel COG onto our
 * requested target grid using nearest-neighbor (`resampleMethod:
 * 'nearest'`, explicit, never the library default silently) whenever the
 * requested pixel dimensions differ from a 1:1 read of the native
 * resolution — recorded in the returned RasterMetadata.source string.
 */
export async function buildFieldRasterFromSentinelScene(params: {
  scene: SentinelSceneSummary;
  fieldBboxWgs84: [number, number, number, number];
  bands: SentinelSpectralBand[];
  signHref: (href: string) => Promise<string>;
}): Promise<RasterGrid> {
  const { scene, fieldBboxWgs84, bands } = params;
  if (scene.epsg === null) {
    throw new SatelliteProviderError('Scene has no proj:epsg — cannot reproject the field boundary into the raster CRS.', 'MALFORMED_RESPONSE');
  }
  const missingBands = bands.filter((b) => scene.assets[b] === undefined);
  if (missingBands.length > 0) {
    throw new SatelliteProviderError(`Scene ${scene.itemId} is missing required band asset(s): ${missingBands.join(', ')}`, 'MISSING_BANDS');
  }

  const utmDef = utmProj4Def(scene.epsg);
  const project = proj4(utmDef);
  const [minLon, minLat, maxLon, maxLat] = fieldBboxWgs84;
  const [minX, minY] = project.forward([minLon, minLat]);
  const [maxX, maxY] = project.forward([maxLon, maxLat]);
  if (!(maxX > minX && maxY > minY)) {
    throw new SatelliteProviderError('Field bounding box reprojected to an invalid (zero-area) UTM window.', 'MALFORMED_RESPONSE');
  }

  const nativeResolutionMeters = SENTINEL_BAND_MAP[bands[0]].resolutionMeters;
  const targetWidth = Math.min(MAX_RASTER_DIMENSION, Math.max(1, Math.round((maxX - minX) / nativeResolutionMeters)));
  const targetHeight = Math.min(MAX_RASTER_DIMENSION, Math.max(1, Math.round((maxY - minY) / nativeResolutionMeters)));

  const bandArrays = new Map<string, Float64Array>();
  const bandMetadata: RasterBandMetadata[] = [];

  for (let i = 0; i < bands.length; i++) {
    const bandKey = bands[i];
    const asset = scene.assets[bandKey]!;
    const signedHref = await params.signHref(asset.href);
    const tiff = await fromUrl(signedHref);
    // GeoTIFF.readRasters() (the file-level object, not .getImage()'s per-image method) is what
    // actually supports a `bbox` in the raster's native CRS — it translates bbox->pixel window and
    // (per its own docs) selects the best-fitting overview internally, matching geotiff.js's own API shape.
    const rasters = await tiff.readRasters({ bbox: [minX, minY, maxX, maxY], width: targetWidth, height: targetHeight, resampleMethod: 'nearest' });
    const dnValues = rasters[0] as unknown as ArrayLike<number>;
    if (dnValues.length !== targetWidth * targetHeight) {
      throw new SatelliteProviderError(`Sentinel-2 band ${asset.bandId} returned ${dnValues.length} pixels, expected ${targetWidth * targetHeight}.`, 'MALFORMED_RESPONSE');
    }

    const reflectance = new Float64Array(dnValues.length);
    for (let px = 0; px < dnValues.length; px++) {
      const value = dnToReflectance(dnValues[px], scene.processingBaseline);
      reflectance[px] = value === null ? NODATA_SENTINEL : value;
    }
    bandArrays.set(bandKey, reflectance);
    bandMetadata.push({ name: bandKey, index: i, unit: 'reflectance', wavelengthNm: null });
  }

  // WGS84 extent of the actual UTM window read (inverse reprojection of the window corners) — see the resampling/approximation note above.
  const [wMinLon, wMinLat] = project.inverse([minX, minY]);
  const [wMaxLon, wMaxLat] = project.inverse([maxX, maxY]);

  const metadata = createRasterMetadata({
    widthPx: targetWidth,
    heightPx: targetHeight,
    extent: [Math.min(wMinLon, wMaxLon), Math.min(wMinLat, wMaxLat), Math.max(wMinLon, wMaxLon), Math.max(wMinLat, wMaxLat)],
    bands: bandMetadata,
    nodataValue: NODATA_SENTINEL,
    dtype: 'float32',
    acquiredAt: Date.parse(scene.datetime),
    source: `sentinel-2-l2a:${scene.itemId}:baseline=${scene.processingBaseline ?? 'unknown'}:resample=nearest:native=${nativeResolutionMeters}m:target=${targetWidth}x${targetHeight}`
  });

  return new RasterGrid(metadata, bandArrays);
}
