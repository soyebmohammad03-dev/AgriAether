import type { Polygon } from 'geojson';
import { boundingBox } from '../geo/geometry';

/**
 * A small canvas plot of the demo field's real-world (WGS84) geometry —
 * deliberately NOT an interactive map with basemap tiles. Two reasons:
 * there is no real map-tile subscription wired up, and the only geometry
 * that exists is Null-Island demo fixture data (see geo/demoGeometry.ts) —
 * placing it on a real street/satellite basemap would visually imply a
 * real location that does not exist. This view exists purely to prove the
 * 3D-simulation -> geodetic bridge (georeference.ts) actually works; a real
 * map library (Leaflet/MapLibre) is worth adding once a real field
 * boundary exists to show it against.
 */
export class GeoView {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly bbox: [number, number, number, number];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly fieldBoundary: Polygon,
    private readonly zoneA: Polygon,
    private readonly zoneB: Polygon
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('GeoView canvas has no 2D context');
    this.ctx = ctx;
    const [minLon, minLat, maxLon, maxLat] = boundingBox(fieldBoundary);
    const marginLon = (maxLon - minLon) * 0.25;
    const marginLat = (maxLat - minLat) * 0.25;
    this.bbox = [minLon - marginLon, minLat - marginLat, maxLon + marginLon, maxLat + marginLat];
  }

  private toCanvas(lon: number, lat: number): [number, number] {
    const [minLon, minLat, maxLon, maxLat] = this.bbox;
    const x = ((lon - minLon) / (maxLon - minLon)) * this.canvas.width;
    const y = (1 - (lat - minLat) / (maxLat - minLat)) * this.canvas.height; // lat increases upward; canvas y increases downward
    return [x, y];
  }

  private drawPolygon(polygon: Polygon, style: { stroke: string; fill: string }): void {
    const ctx = this.ctx;
    for (const ring of polygon.coordinates) {
      ctx.beginPath();
      ring.forEach(([lon, lat], i) => {
        const [x, y] = this.toCanvas(lon, lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = style.fill;
      ctx.fill();
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  draw(dronePosition: { lat: number; lon: number } | null, weatherPosition: { lat: number; lon: number } | null): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#0f1a12';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawPolygon(this.fieldBoundary, { stroke: 'rgba(74,222,128,0.5)', fill: 'rgba(74,222,128,0.04)' });
    this.drawPolygon(this.zoneA, { stroke: 'rgba(47,213,232,0.55)', fill: 'rgba(47,213,232,0.08)' });
    this.drawPolygon(this.zoneB, { stroke: 'rgba(251,191,36,0.55)', fill: 'rgba(251,191,36,0.08)' });

    if (dronePosition) {
      const [x, y] = this.toCanvas(dronePosition.lon, dronePosition.lat);
      ctx.fillStyle = '#e2fff2';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (weatherPosition) {
      const [x, y] = this.toCanvas(weatherPosition.lon, weatherPosition.lat);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
    }
  }
}
