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
import { WorldPanel } from '../ui/WorldPanel';
import { DataInspector, ObservationLog } from '../ui/DataInspector';
import { createRepositories, type AgriAetherRepositories } from '../persistence/repositories';
import { WorldRegistry } from '../world/WorldRegistry';
import { ensureDemoWorld, type DemoWorldIds } from '../world/demoWorld';
import { createAgriculturalEvent } from '../domain/AgriculturalEvent';
import type { Observation, ObservationContext } from '../observation/Observation';

const CAMERA_BUTTON_IDS: Record<CameraMode, string> = {
  orbit: 'btnOrbit',
  follow: 'btnFollow',
  top: 'btnTopDown',
  fpv: 'btnFPV'
};

/** How often a sampled Observation is persisted to IndexedDB — every tick would be 60Hz of writes for no benefit at this stage. */
const OBSERVATION_PERSIST_INTERVAL_MS = 2000;

/** Wires the scene, simulation, domain/persistence, and UI together; owns the render loop. */
export class App {
  private readonly bundle = createSceneBundle(document.getElementById('droneCanvas') as HTMLCanvasElement);
  private readonly terrain = new Terrain(this.bundle.scene);
  private readonly droneModel = new DroneModel(this.bundle.scene);
  private readonly cameraRig = new CameraRig(this.bundle.camera, this.bundle.renderer.domElement);
  private readonly mission = buildDefaultMission();
  private readonly flightPathVisual = new FlightPathVisual(this.bundle.scene, this.mission);
  private readonly simulation = new SimulationEngine(this.mission);
  private readonly hud = new Hud();
  private readonly worldPanel = new WorldPanel();
  private readonly dataInspector = new DataInspector();
  private readonly observationLog = new ObservationLog();
  private readonly minimap = new Minimap(
    document.getElementById('minimapCanvas') as HTMLCanvasElement,
    this.flightPathVisual.curve.getPoints(80)
  );

  private readonly clock = new THREE.Clock();
  private simSeconds = 0;
  private paused = false;
  private lastPersistedAt = 0;
  private missionStartedEventRecorded = false;

  private constructor(
    private readonly repositories: AgriAetherRepositories,
    private readonly world: WorldRegistry,
    private readonly worldIds: DemoWorldIds,
    private readonly telemetryGenerator: TelemetryGenerator
  ) {
    this.cameraRig.setMode('orbit');
    this.wireControls();
    this.simulation.start();
    window.addEventListener('resize', () => resizeSceneBundle(this.bundle));

    const farm = this.world.getFarm(this.worldIds.farmId);
    const field = this.world.getField(this.worldIds.fieldId);
    if (farm && field) {
      this.worldPanel.render(farm, field, 'Simulation UAV-01', this.world.listSensors());
    }
  }

  /** Loads/seeds the domain world before the render loop starts — the one async step in an otherwise synchronous app. */
  static async create(): Promise<App> {
    const repositories = createRepositories();
    const world = await WorldRegistry.load(repositories);
    const generator = new TelemetryGenerator();
    const worldIds = await ensureDemoWorld(world, generator);
    return new App(repositories, world, worldIds, generator);
  }

  private get observationContext(): ObservationContext {
    return {
      farmId: this.worldIds.farmId,
      fieldId: this.worldIds.fieldId,
      missionId: this.mission.id,
      droneId: this.worldIds.droneId
    };
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

    document.getElementById('btnInspector')?.addEventListener('click', () => {
      const open = this.dataInspector.toggle();
      setButtonActive('btnInspector', open);
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

  private recordMissionStartedIfNeeded(flightState: string): void {
    if (this.missionStartedEventRecorded || flightState !== 'MISSION') return;
    this.missionStartedEventRecorded = true;
    void this.world.recordEvent(
      createAgriculturalEvent({
        fieldId: this.worldIds.fieldId,
        type: 'MISSION_STARTED',
        description: `Mission "${this.mission.name}" started`,
        source: 'SIMULATED'
      })
    );
  }

  private persistObservationSampleIfDue(observations: ReadonlyArray<Observation<unknown>>): void {
    const now = performance.now();
    if (now - this.lastPersistedAt < OBSERVATION_PERSIST_INTERVAL_MS) return;
    this.lastPersistedAt = now;
    for (const obs of observations) {
      void this.repositories.observations.save(obs);
    }
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.paused) {
      this.simSeconds += dt;
    }

    const droneState = this.simulation.tick(dt);
    const telemetry = this.telemetryGenerator.generate(droneState, this.observationContext);
    const observations: Observation<unknown>[] = [
      telemetry.position,
      telemetry.orientation,
      telemetry.altitude,
      telemetry.battery,
      telemetry.groundSpeed,
      telemetry.heading,
      ...(telemetry.missionProgress ? [telemetry.missionProgress] : [])
    ];
    for (const obs of observations) this.observationLog.push(obs);
    this.persistObservationSampleIfDue(observations);
    this.recordMissionStartedIfNeeded(droneState.flightState);

    this.droneModel.update(droneState, dt, this.simSeconds);
    this.cameraRig.update(droneState);
    this.minimap.draw(droneState);
    this.hud.update(droneState, telemetry, this.mission, this.simSeconds);
    this.dataInspector.render(this.observationLog);

    this.bundle.renderer.render(this.bundle.scene, this.bundle.camera);
  };

  run(): void {
    this.tick();
    this.hud.hideLoadingScreen();
  }
}
