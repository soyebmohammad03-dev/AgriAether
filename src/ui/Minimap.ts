import * as THREE from 'three';
import type { DroneState } from '../drone/DroneState';

/**
 * A top-down 2D rendering of the simulation-local flight path and drone
 * position. Unlike the original prototype, this draws no "stress zone"
 * rectangle — that was a fabricated overlay with no data behind it.
 */
export class Minimap {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly pathPoints: THREE.Vector3[]
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Minimap canvas has no 2D context');
    this.ctx = ctx;
  }

  private mapX(x: number): number {
    return 90 + x * 1.75;
  }

  private mapY(z: number): number {
    return 90 + z * 2.15;
  }

  draw(state: DroneState): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#172018';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(74,222,128,0.28)';
    ctx.lineWidth = 1;
    for (let i = 16; i < w; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(w, i);
      ctx.stroke();
    }

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    this.pathPoints.forEach((p, i) => {
      const x = this.mapX(p.x);
      const y = this.mapY(p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    const x = this.mapX(state.position.x);
    const y = this.mapY(state.position.z);
    const headingRad = THREE.MathUtils.degToRad(state.heading);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(headingRad);
    ctx.fillStyle = '#e2fff2';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 7);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
