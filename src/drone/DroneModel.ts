import * as THREE from 'three';
import type { DroneState } from './DroneState';

function mat(color: number, roughness = 0.72, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function roundedBox(w: number, h: number, d: number, r: number, s: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelSegments: s,
    steps: 1,
    bevelSize: r * 0.35,
    bevelThickness: r * 0.35
  });
  geometry.center();
  return new THREE.Mesh(geometry, material);
}

/**
 * The drone's 3D mesh and its purely visual animation (rotor spin, gimbal
 * sway, spray particles, scan-beam pulse, ground shadow). None of this is
 * telemetry — it reads a DroneState each frame to position itself, but it
 * never produces or interprets scientific data. See telemetry/TelemetryGenerator.ts
 * for the actual data pipeline.
 */
export class DroneModel {
  readonly group = new THREE.Group();
  private readonly rotors: THREE.Group[] = [];
  private readonly gimbal: THREE.Group;
  private readonly scanCone: THREE.Mesh;
  private readonly sprayParticles: THREE.Points;
  private readonly shadow: THREE.Mesh;

  private scanOn = true;
  private sprayOn = false;

  constructor(scene: THREE.Scene) {
    const materials = {
      graphite: mat(0x1b2228, 0.46, 0.25),
      carbon: mat(0x0b0f12, 0.38, 0.45),
      white: mat(0xf1f5f4, 0.54, 0.08),
      green: mat(0x2ecf73, 0.55, 0.08),
      cyan: mat(0x2fd5e8, 0.35, 0.15),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0x173c48,
        roughness: 0.12,
        metalness: 0,
        transmission: 0.2,
        transparent: true,
        opacity: 0.72
      }),
      rotorBlur: new THREE.MeshBasicMaterial({
        color: 0xd7fff2,
        transparent: true,
        opacity: 0.23,
        side: THREE.DoubleSide,
        depthWrite: false
      }),
      scan: new THREE.MeshBasicMaterial({
        color: 0x2fd5e8,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    };

    const body = roundedBox(4.4, 1.05, 2.6, 0.26, 5, materials.white);
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    this.group.add(body);

    const topShell = new THREE.Mesh(new THREE.SphereGeometry(1.46, 32, 16), materials.graphite);
    topShell.scale.set(1.45, 0.32, 0.78);
    topShell.position.y = 0.55;
    topShell.castShadow = true;
    this.group.add(topShell);

    const bay = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.42, 1.4), materials.glass);
    bay.position.set(0, -0.44, 0.15);
    bay.castShadow = true;
    this.group.add(bay);

    const armGroup = new THREE.Group();
    const armGeo = new THREE.CylinderGeometry(0.11, 0.13, 5.7, 14);
    const rotorPositions: Array<[number, number, number]> = [
      [-3.9, 0.08, -2.75],
      [3.9, 0.08, -2.75],
      [-3.9, 0.08, 2.75],
      [3.9, 0.08, 2.75]
    ];

    rotorPositions.forEach(([x, y, z]) => {
      const arm = new THREE.Mesh(armGeo, materials.carbon);
      arm.position.set(x / 2, y, z / 2);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = Math.atan2(z, x);
      arm.castShadow = true;
      armGroup.add(arm);

      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 28), materials.graphite);
      motor.position.set(x, y + 0.08, z);
      motor.castShadow = true;
      armGroup.add(motor);

      const propHub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 18), materials.green);
      propHub.position.set(x, y + 0.32, z);
      armGroup.add(propHub);

      const rotor = new THREE.Group();
      const bladeGeo = new THREE.BoxGeometry(2.9, 0.035, 0.19);
      const bladeA = new THREE.Mesh(bladeGeo, materials.carbon);
      const bladeB = new THREE.Mesh(bladeGeo, materials.carbon);
      bladeB.rotation.y = Math.PI / 2;
      rotor.add(bladeA, bladeB);
      const disk = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), materials.rotorBlur);
      disk.rotation.x = -Math.PI / 2;
      rotor.add(disk);
      rotor.position.set(x, y + 0.4, z);
      armGroup.add(rotor);
      this.rotors.push(rotor);
    });
    this.group.add(armGroup);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.82, 1.7, 32), materials.green);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0, -0.9, -0.45);
    tank.castShadow = true;
    this.group.add(tank);

    const gimbal = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 10, 32), materials.graphite);
    ring.rotation.x = Math.PI / 2;
    gimbal.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.62, 32), materials.glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.28;
    lens.castShadow = true;
    gimbal.add(lens);
    gimbal.position.set(0, -0.82, 1.35);
    this.group.add(gimbal);
    this.gimbal = gimbal;

    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.55), materials.cyan);
    sensor.position.set(0, -0.68, -1.5);
    this.group.add(sensor);

    const sprayRig = new THREE.Group();
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 6.2, 10), materials.graphite);
    boom.rotation.z = Math.PI / 2;
    sprayRig.add(boom);
    [-2.6, -1.3, 0, 1.3, 2.6].forEach((x) => {
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.32, 12), materials.cyan);
      nozzle.rotation.x = Math.PI;
      nozzle.position.set(x, -0.22, 0);
      sprayRig.add(nozzle);
    });
    sprayRig.position.set(0, -1.05, -1.2);
    this.group.add(sprayRig);

    const scanCone = new THREE.Mesh(new THREE.ConeGeometry(4.1, 10, 48, 1, true), materials.scan);
    scanCone.rotation.x = Math.PI;
    scanCone.position.set(0, -5.55, 1.55);
    this.group.add(scanCone);
    this.scanCone = scanCone;

    scene.add(this.group);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 48),
      new THREE.MeshBasicMaterial({ color: 0x111813, transparent: true, opacity: 0.18, depthWrite: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.03;
    scene.add(this.shadow);

    this.sprayParticles = createSprayParticles();
    this.sprayParticles.visible = false;
    scene.add(this.sprayParticles);
  }

  setScanBeamVisible(visible: boolean): void {
    this.scanOn = visible;
    this.scanCone.visible = visible;
  }

  setSprayVisible(visible: boolean): void {
    this.sprayOn = visible;
    this.sprayParticles.visible = visible;
  }

  /** Position/orient the model and advance its cosmetic animation for one frame. */
  update(state: DroneState, dt: number, simTime: number): void {
    this.group.position.set(state.position.x, state.position.y, state.position.z);
    this.group.rotation.set(
      THREE.MathUtils.degToRad(state.orientation.pitch),
      THREE.MathUtils.degToRad(state.orientation.yaw),
      THREE.MathUtils.degToRad(state.orientation.roll)
    );

    for (const rotor of this.rotors) {
      rotor.rotation.y += dt * 58;
    }
    this.gimbal.rotation.x = Math.sin(simTime * 0.9) * 0.1;
    if (this.scanOn) {
      const mat = this.scanCone.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.13 + Math.sin(simTime * 4) * 0.045;
      this.scanCone.rotation.z = Math.sin(simTime * 1.8) * 0.12;
    }

    this.shadow.position.x = state.position.x;
    this.shadow.position.z = state.position.z;
    this.shadow.scale.setScalar(1.25 + state.position.y * 0.06);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(0.06, 0.27 - state.position.y * 0.015);

    this.sprayParticles.position.copy(this.group.position);
    this.sprayParticles.rotation.copy(this.group.rotation);
    if (this.sprayOn) {
      advanceSprayParticles(this.sprayParticles, dt);
    }
  }
}

function createSprayParticles(): THREE.Points {
  const count = 650;
  const positions = new Float32Array(count * 3);
  const velocities: number[] = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 5.2;
    positions[i * 3 + 1] = -1.3 - Math.random() * 4.5;
    positions[i * 3 + 2] = -1.25 + (Math.random() - 0.5) * 0.6;
    velocities.push(0.018 + Math.random() * 0.042);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.MeshBasicMaterial({ color: 0x75d9ff, transparent: true, opacity: 0.54, depthWrite: false });
  const points = new THREE.Points(geometry, material);
  points.userData.velocities = velocities;
  return points;
}

function advanceSprayParticles(points: THREE.Points, dt: number): void {
  const attr = points.geometry.attributes.position as THREE.BufferAttribute;
  const velocities = points.userData.velocities as number[];
  for (let i = 0; i < attr.count; i++) {
    let y = attr.getY(i) - velocities[i] * dt * 60;
    if (y < -7.2) {
      y = -1.3;
      attr.setX(i, (Math.random() - 0.5) * 5.2);
      attr.setZ(i, -1.25 + (Math.random() - 0.5) * 0.8);
    }
    attr.setY(i, y);
  }
  attr.needsUpdate = true;
}
