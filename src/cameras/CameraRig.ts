import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { DroneState } from '../drone/DroneState';

export type CameraMode = 'orbit' | 'follow' | 'top' | 'fpv';

/** The four camera modes from the original prototype, unchanged in behavior. */
export class CameraRig {
  readonly controls: OrbitControls;
  mode: CameraMode = 'orbit';

  constructor(private readonly camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 4, 0);
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 9;
    this.controls.maxDistance = 90;
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
  }

  reset(): void {
    this.setMode('orbit');
    this.camera.position.set(20, 15, 24);
    this.controls.target.set(0, 4, 0);
  }

  update(state: DroneState): void {
    if (this.mode === 'orbit') {
      this.controls.update();
      return;
    }

    const headingRad = THREE.MathUtils.degToRad(state.heading);
    const forward = new THREE.Vector3(Math.sin(headingRad), 0, Math.cos(headingRad));
    const side = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    const dronePos = new THREE.Vector3(state.position.x, state.position.y, state.position.z);

    let desired: THREE.Vector3;
    let target: THREE.Vector3;

    if (this.mode === 'follow') {
      desired = dronePos.clone()
        .add(forward.clone().multiplyScalar(-13))
        .add(side.clone().multiplyScalar(4))
        .add(new THREE.Vector3(0, 7, 0));
      target = dronePos.clone().add(forward.clone().multiplyScalar(7));
    } else if (this.mode === 'top') {
      desired = dronePos.clone().add(new THREE.Vector3(0, 54, 0.1));
      target = dronePos.clone();
    } else {
      desired = dronePos.clone().add(forward.clone().multiplyScalar(2.8)).add(new THREE.Vector3(0, -0.12, 0));
      target = dronePos.clone().add(forward.clone().multiplyScalar(20)).add(new THREE.Vector3(0, -1.6, 0));
    }

    this.camera.position.lerp(desired, 0.075);
    this.camera.lookAt(target);
  }
}
