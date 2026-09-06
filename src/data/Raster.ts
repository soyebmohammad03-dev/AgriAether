import { createId } from '../domain/id';

export interface RasterBandMetadata {
  /** Matches a sensing/SpectralBand.ts id (e.g. "RED", "NIR") when the band is a known spectral band, or a custom name otherwise — never assumed from band position/index. */
  name: string;
  index: number;
  unit: string | null;
  wavelengthNm: number | null;
}

export type RasterDataType = 'float32' | 'uint8' | 'uint16' | 'int16';

/**
 * Metadata for a raster — deliberately NOT a full GeoTIFF reader or GIS
 * engine. `resolutionMeters` is an approximation derived from extent/pixel
 * dimensions at this codebase's field scale, not a real affine/CRS
 * transform matrix; a server-side raster pipeline is the appropriate place
 * for that level of rigor (see README).
 */
export interface RasterMetadata {
  id: string;
  datasetId: string | null;
  widthPx: number;
  heightPx: number;
  /** [minLon, minLat, maxLon, maxLat]. */
  extent: [number, number, number, number];
  crs: 'EPSG:4326';
  resolutionMeters: number;
  bandCount: number;
  bands: RasterBandMetadata[];
  /** null means "no nodata value declared" — never assumed to be 0 or -9999. */
  nodataValue: number | null;
  dtype: RasterDataType;
  acquiredAt: number;
  source: string;
}

export function createRasterMetadata(params: {
  datasetId?: string | null;
  widthPx: number;
  heightPx: number;
  extent: [number, number, number, number];
  bands: RasterBandMetadata[];
  nodataValue?: number | null;
  dtype?: RasterDataType;
  acquiredAt: number;
  source: string;
}): RasterMetadata {
  if (params.widthPx <= 0 || params.heightPx <= 0) {
    throw new Error('RasterMetadata requires positive widthPx/heightPx');
  }
  if (params.bands.length === 0) {
    throw new Error('RasterMetadata requires at least one band');
  }
  const [minLon, minLat, maxLon, maxLat] = params.extent;
  const widthMeters = (maxLon - minLon) * 111_320 * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const resolutionMeters = Math.abs(widthMeters) / params.widthPx;
  return {
    id: createId('raster'),
    datasetId: params.datasetId ?? null,
    widthPx: params.widthPx,
    heightPx: params.heightPx,
    extent: params.extent,
    crs: 'EPSG:4326',
    resolutionMeters,
    bandCount: params.bands.length,
    bands: params.bands,
    nodataValue: params.nodataValue ?? null,
    dtype: params.dtype ?? 'float32',
    acquiredAt: params.acquiredAt,
    source: params.source
  };
}

/**
 * The actual pixel data, kept separate from RasterMetadata (relational-ish
 * data) per Part 13 of the Phase 5 brief — one Float64Array per band, never
 * a relational row per pixel. Small rasters only: this is an in-memory
 * grid for the demo/fixture/test scale, not a tile-backed store.
 */
export class RasterGrid {
  constructor(
    public readonly metadata: RasterMetadata,
    private readonly bandData: ReadonlyMap<string, Float64Array>
  ) {
    for (const band of metadata.bands) {
      const data = bandData.get(band.name);
      if (!data) throw new Error(`RasterGrid is missing data for declared band "${band.name}"`);
      if (data.length !== metadata.widthPx * metadata.heightPx) {
        throw new Error(`RasterGrid band "${band.name}" has ${data.length} cells, expected ${metadata.widthPx * metadata.heightPx}`);
      }
    }
  }

  isNodata(value: number): boolean {
    return this.metadata.nodataValue !== null && value === this.metadata.nodataValue;
  }

  /** Returns null for nodata or an out-of-range cell — never the raw nodata sentinel value. */
  getCell(bandName: string, row: number, col: number): number | null {
    if (row < 0 || row >= this.metadata.heightPx || col < 0 || col >= this.metadata.widthPx) return null;
    const data = this.bandData.get(bandName);
    if (!data) return null;
    const value = data[row * this.metadata.widthPx + col];
    return this.isNodata(value) ? null : value;
  }

  /** The lon/lat of a cell's center, derived from the raster's extent — not a full affine transform, just linear interpolation across a small, roughly-rectangular extent. */
  cellCenterLonLat(row: number, col: number): { lat: number; lon: number } {
    const [minLon, minLat, maxLon, maxLat] = this.metadata.extent;
    const lon = minLon + ((col + 0.5) / this.metadata.widthPx) * (maxLon - minLon);
    const lat = maxLat - ((row + 0.5) / this.metadata.heightPx) * (maxLat - minLat); // row 0 is the north edge
    return { lat, lon };
  }
}

export interface RasterWindow {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

/** Reads one band over a window — the minimum viewport/tile-style access pattern this phase needs, not a full tiling engine. */
export function readWindow(grid: RasterGrid, bandName: string, window: RasterWindow): number[] {
  const values: number[] = [];
  for (let row = window.rowStart; row < window.rowEnd; row++) {
    for (let col = window.colStart; col < window.colEnd; col++) {
      const value = grid.getCell(bandName, row, col);
      if (value !== null) values.push(value);
    }
  }
  return values;
}
