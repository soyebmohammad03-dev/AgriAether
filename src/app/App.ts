import * as THREE from 'three';
import { createSceneBundle, resizeSceneBundle } from '../scene/Scene';
import { Terrain } from '../scene/Terrain';
import { FlightPathVisual } from '../scene/FlightPathVisual';
import { DroneModel } from '../drone/DroneModel';
import { CameraRig, type CameraMode } from '../cameras/CameraRig';
import { buildDefaultMission } from '../mission/defaultMission';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { TelemetryGenerator } from '../telemetry/TelemetryGenerator';
import { Hud, setButtonActive } from '../ui/Hud';
import { Minimap } from '../ui/Minimap';

const CAMERA_BUTTON_IDS: Record<CameraMode, string> = {
  orbit: 'btnOrbit',
  follow: 'btnFollow',
  top: 'btnTopDown',
  fpv: 'btnFPV'
};

/** Wires the scene, simulation, telemetry pipeline, and UI together; owns the render loop. */
export class App {
  private readonly bundle = createSceneBundle(document.getElementById('droneCanvas') as HTMLCanvasElement);
  private readonly terrain = new Terrain(this.bundle.scene);
  private readonly droneModel = new DroneModel(this.bundle.scene);
  private readonly cameraRig = new CameraRig(this.bundle.camera, this.bundle.renderer.domElement);
  private readonly mission = buildDefaultMission();
  private readonly flightPathVisual = new FlightPathVisual(this.bundle.scene, this.mission);
  private readonly simulation = new SimulationEngine(this.mission);
  private readonly telemetryGenerator = new TelemetryGenerator();
  private readonly hud = new Hud();
  private readonly minimap = new Minimap(
    document.getElementById('minimapCanvas') as HTMLCanvasElement,
    this.flightPathVisual.curve.getPoints(80)
  );

  private readonly clock = new THREE.Clock();
  private simSeconds = 0;
  private paused = false;

  constructor() {
    this.cameraRig.setMode('orbit');
    this.wireControls();
    this.simulation.start();
    window.addEventListener('resize', () => resizeSceneBundle(this.bundle));
  }

  private wireControls(): void {
    const setCameraMode = (mode: CameraMode) => {
      this.cameraRig.setMode(mode);
      Object.values(CAMERA_BUTTON_IDS).forEach((id) => setButtonActive(id, false));
      setButtonActive(CAMERA_BUTTON_IDS[mode], true);
    };

    document.getElementById('btnOrbit')?.addEventListener('click', () => setCameraMode('orbit'));
    document.getElementById('btnFollow')?.addEventListener('click', () => setCameraMode('follow'));
    document.getElementById('btnTopDown')?.addEventListener('click', () => setCameraMode('top'));
    document.getElementById('btnFPV')?.addEventListener('click', () => setCameraMode('fpv'));
    document.getElementById('btnReset')?.addEventListener('click', () => {
      setCameraMode('orbit');
      this.cameraRig.reset();
    });

    let demoOverlayOn = false;
    document.getElementById('btnDemoOverlay')?.addEventListener('click', () => {
      demoOverlayOn = !demoOverlayOn;
      this.terrain.setDemoOverlayVisible(demoOverlayOn);
      setButtonActive('btnDemoOverlay', demoOverlayOn);
    });

    let sprayOn = false;
    document.getElementById('btnSpray')?.addEventListener('click', () => {
      sprayOn = !sprayOn;
      this.droneModel.setSprayVisible(sprayOn);
      setButtonActive('btnSpray', sprayOn);
    });

    let scanOn = true;
    document.getElementById('btnScan')?.addEventListener('click', () => {
      scanOn = !scanOn;
      this.droneModel.setScanBeamVisible(scanOn);
      setButtonActive('btnScan', scanOn);
    });

    document.getElementById('btnPause')?.addEventListener('click', (event) => {
      this.paused = !this.paused;
      this.simulation.setPaused(this.paused);
      const target = event.currentTarget as HTMLElement;
      target.classList.toggle('active', this.paused);
      const label = target.querySelector('span');
      if (label) label.textContent = this.paused ? 'Resume' : 'Pause';
    });

    setCameraMode('orbit');
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.paused) {
      this.simSeconds += dt;
    }

    const droneState = this.simulation.tick(dt);
    const telemetry = this.telemetryGenerator.generate(droneState);

    this.droneModel.update(droneState, dt, this.simSeconds);
    this.cameraRig.update(droneState);
    this.minimap.draw(droneState);
    this.hud.update(droneState, telemetry, this.mission, this.simSeconds);

    this.bundle.renderer.render(this.bundle.scene, this.bundle.camera);
  };

  run(): void {
    this.tick();
    this.hud.hideLoadingScreen();
  }
}
