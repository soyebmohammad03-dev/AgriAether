import * as THREE from 'three';

function mat(color: number, roughness = 0.72, metalness = 0.05): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

/**
 * The field, crop rows, irrigation, tower, and barn — carried over from the
 * original prototype as scene decoration.
 *
 * IMPORTANT: the colored "demo overlay" planes are a static, hardcoded
 * visual pattern (two fixed rectangular zones), not a rendering of any real
 * or simulated vegetation index. They must never be presented in the UI as
 * NDVI, crop health, or any other scientific quantity — see the Phase 0
 * audit and README. Toggling them only changes local opacity.
 */
export class Terrain {
  readonly group = new THREE.Group();
  private readonly demoOverlayMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const soilMat = mat(0x695437, 0.92, 0.02);
    const fieldBase = new THREE.Mesh(new THREE.BoxGeometry(92, 0.55, 72), soilMat);
    fieldBase.position.y = -0.3;
    fieldBase.receiveShadow = true;
    this.group.add(fieldBase);

    const cropHealthy = mat(0x2f8f47, 0.86, 0);
    const cropFresh = mat(0x51b957, 0.8, 0);
    const cropDry = mat(0xb99a34, 0.82, 0);
    const overlayMats = [
      mat(0xd74834, 0.82, 0),
      mat(0xe8b13a, 0.82, 0),
      mat(0x9fc83c, 0.82, 0),
      mat(0x35a94c, 0.82, 0)
    ];

    const rowGeo = new THREE.BoxGeometry(0.42, 0.42, 1.25);
    for (let x = -40; x <= 40; x += 3.2) {
      for (let z = -30; z <= 30; z += 1.55) {
        const patch = new THREE.Mesh(rowGeo, cropHealthy);
        const zoneA = x > 8 && x < 25 && z > -18 && z < -4;
        const zoneB = x < -16 && z > 5 && z < 20;
        patch.material = zoneA ? cropDry : zoneB ? cropFresh : cropHealthy;
        patch.position.set(x + Math.sin(z * 0.31) * 0.16, 0.25, z);
        patch.rotation.y = Math.sin(x * 0.08) * 0.08;
        patch.castShadow = true;
        patch.receiveShadow = true;
        this.group.add(patch);

        const overlay = new THREE.Mesh(
          new THREE.PlaneGeometry(2.6, 1.2),
          overlayMats[zoneA ? 0 : zoneB ? 3 : 2]
        );
        overlay.rotation.x = -Math.PI / 2;
        overlay.position.set(x, 0.58, z);
        overlay.material = (overlay.material as THREE.MeshStandardMaterial).clone();
        overlay.material.transparent = true;
        overlay.material.opacity = 0;
        this.demoOverlayMeshes.push(overlay);
        this.group.add(overlay);
      }
    }

    const irrigationMat = mat(0x29323a, 0.66, 0.15);
    for (let z = -24; z <= 24; z += 12) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 80, 12), irrigationMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.18, z);
      this.group.add(pipe);
    }

    const towerMat = mat(0x9aa5a8, 0.58, 0.35);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 7, 8), towerMat);
    tower.position.set(-43, 3.2, -31);
    tower.castShadow = true;
    this.group.add(tower);

    const antenna = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), mat(0x2fd5e8, 0.35, 0.15));
    antenna.position.set(-43, 7.1, -31);
    this.group.add(antenna);

    const barn = new THREE.Group();
    const barnBody = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 7), mat(0xb3523d, 0.74, 0.04));
    barnBody.position.y = 1.8;
    barnBody.castShadow = true;
    barn.add(barnBody);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.2, 4), mat(0x37414a, 0.6, 0.18));
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.82;
    roof.position.y = 5;
    roof.castShadow = true;
    barn.add(roof);
    barn.position.set(35, 0, 28);
    this.group.add(barn);

    scene.add(this.group);
  }

  setDemoOverlayVisible(visible: boolean): void {
    for (const mesh of this.demoOverlayMeshes) {
      (mesh.material as THREE.MeshStandardMaterial).opacity = visible ? 0.56 : 0;
    }
  }
}
