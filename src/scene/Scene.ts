import * as THREE from 'three';

export interface SceneBundle {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
}

/** Renderer/scene/lighting setup — carried over from the original prototype largely unchanged. */
export function createSceneBundle(canvas: HTMLCanvasElement): SceneBundle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb6c4);
  scene.fog = new THREE.Fog(0x8fb6c4, 55, 190);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(20, 15, 24);

  addLights(scene);

  return { scene, renderer, camera };
}

function addLights(scene: THREE.Scene): void {
  const hemi = new THREE.HemisphereLight(0xdcefff, 0x526832, 1.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff3d6, 3.2);
  sun.position.set(-35, 55, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -75;
  sun.shadow.camera.right = 75;
  sun.shadow.camera.top = 75;
  sun.shadow.camera.bottom = -75;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x80f7ff, 0.75);
  rim.position.set(24, 20, -35);
  scene.add(rim);
}

export function resizeSceneBundle(bundle: SceneBundle): void {
  bundle.camera.aspect = window.innerWidth / window.innerHeight;
  bundle.camera.updateProjectionMatrix();
  bundle.renderer.setSize(window.innerWidth, window.innerHeight);
}
