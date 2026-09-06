import * as THREE from 'three';
import type { Mission } from '../mission/Mission';

/**
 * Renders a Mission's waypoints as a spline + markers. This module only
 * visualizes the mission — it does not execute it (see
 * simulation/SimulationEngine.ts) and does not own the drone's motion.
 */
export class FlightPathVisual {
  readonly curve: THREE.CatmullRomCurve3;

  constructor(scene: THREE.Scene, mission: Mission) {
    const points = mission.waypoints.map((wp) => new THREE.Vector3(wp.position.x, wp.position.y, wp.position.z));
    this.curve = new THREE.CatmullRomCurve3(points, mission.loop, 'catmullrom', 0.18);

    const pathGeo = new THREE.BufferGeometry().setFromPoints(this.curve.getPoints(360));
    const path = new THREE.Line(
      pathGeo,
      new THREE.LineDashedMaterial({
        color: 0x22d3ee,
        dashSize: 1.8,
        gapSize: 0.9,
        transparent: true,
        opacity: 0.65
      })
    );
    path.computeLineDistances();
    scene.add(path);

    const markerMat = new THREE.MeshStandardMaterial({ color: 0x2fd5e8, roughness: 0.35, metalness: 0.15 });
    mission.waypoints.forEach((wp) => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), markerMat);
      marker.position.set(wp.position.x, 0.08, wp.position.z);
      scene.add(marker);
    });
  }
}
