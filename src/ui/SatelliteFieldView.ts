import type { Polygon } from 'geojson';
import { boundingBox } from '../geo/geometry';
import type { RasterGrid } from '../data/Raster';

export type SatelliteViewStatus = 'IDLE' | 'LOADING' | 'ERROR' | 'READY';

/**
 * A small canvas plot of a REAL field boundary plus the real per-pixel NDVI
 * cells retrieved for it — same projection approach as ui/GeoView.ts
 * (lon/lat -> canvas via a linear bbox mapping, deliberately no basemap
 * tiles, see GeoView's own reasoning), extended rather than duplicated
 * outright because GeoView's constructor is hard-wired to the Null Island
 * demo world's three fixed polygons and rendered every simulation tick;
 * this view is a second, independent instance for whatever real field is
 * currently loaded, drawn on demand (not every frame). Never draws a
 * placeholder/fake image — LOADING/ERROR states are drawn as text, never
 * as a plausible-looking raster.
 */
export class SatelliteFieldView {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('SatelliteFieldView canvas has no 2D context');
    this.ctx = ctx;
  }

  private toCanvas(bbox: [number, number, number, number], lon: number, lat: number): [number, number] {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const x = ((lon - minLon) / (maxLon - minLon)) * this.canvas.width;
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * this.canvas.height;
    return [x, y];
  }

  /** NDVI in [-1,1] mapped to a green-intensity color — a visualization convention (low=brown/tan, high=green), never a claim of a fourth "true color" band. */
  private ndviColor(value: number): string {
    const clamped = Math.max(-1, Math.min(1, value));
    const t = (clamped + 1) / 2; // 0..1
    const r = Math.round(160 - 120 * t);
    const g = Math.round(120 + 100 * t);
    const b = Math.round(80 - 40 * t);
    return `rgb(${r},${g},${b})`;
  }

  private drawStatusText(text: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#0f1a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = 'rgba(226,255,242,0.8)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
  }

  draw(params: {
    status: SatelliteViewStatus;
    message?: string;
    fieldBoundary?: Polygon;
    grid?: RasterGrid;
    ndviCells?: Array<{ row: number; col: number; value: number }>;
  }): void {
    const ctx = this.ctx;

    if (params.status !== 'READY' || !params.fieldBoundary) {
      this.drawStatusText(params.message ?? params.status);
      return;
    }

    const bbox = boundingBox(params.fieldBoundary);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#0f1a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (params.grid && params.ndviCells) {
      const cellWidthPx = this.canvas.width / params.grid.metadata.widthPx;
      const cellHeightPx = this.canvas.height / params.grid.metadata.heightPx;
      for (const cell of params.ndviCells) {
        const { lat, lon } = params.grid.cellCenterLonLat(cell.row, cell.col);
        const [x, y] = this.toCanvas(bbox, lon, lat);
        ctx.fillStyle = this.ndviColor(cell.value);
        ctx.fillRect(x - cellWidthPx / 2, y - cellHeightPx / 2, Math.max(1, cellWidthPx + 1), Math.max(1, cellHeightPx + 1));
      }
    }

    ctx.beginPath();
    for (const ring of params.fieldBoundary.coordinates) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = this.toCanvas(bbox, lon, lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(74,222,128,0.85)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
