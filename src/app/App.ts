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
import { GeoView } from '../ui/GeoView';
import { WeatherPanel } from '../ui/WeatherPanel';
import { createRepositories, type AgriAetherRepositories } from '../persistence/repositories';
import { WorldRegistry } from '../world/WorldRegistry';
import { ensureDemoWorld, type DemoWorldIds } from '../world/demoWorld';
import { createAgriculturalEvent } from '../domain/AgriculturalEvent';
import { createEstimatedObservation, type Observation, type ObservationContext } from '../observation/Observation';
import { simulationLocalToDemoGeodetic } from '../geo/georeference';
import { DEMO_FIELD_ANCHOR } from '../geo/demoGeometry';
import { OpenMeteoProvider } from '../weather/OpenMeteoProvider';
import { WeatherService } from '../weather/WeatherService';
import { weatherObservationToObservations } from '../weather/weatherObservationToObservations';
import { evaluateAllAnalyses, type AnalysisEvaluation } from '../sensing/AnalysisRegistry';
import { evaluateSensorHealth } from '../sensing/SensorHealth';
import { AnalysisRegistryPanel } from '../ui/AnalysisRegistryPanel';
import { DataCatalogPanel } from '../ui/DataCatalogPanel';
import { computeFieldCoverage } from '../data/Coverage';
import { detectDataGaps } from '../data/DataGap';
import { evaluateMissionDataRequirements } from '../data/MissionDataRequirement';
import { buildFieldSummary } from '../data/FieldSummary';
import { SENSOR_CAPABILITY_CATALOG } from '../sensing/SensorCapabilityCatalog';
import type { SensorKind } from '../domain/SensorRecord';
import { ImportPanel } from '../ui/ImportPanel';
import { builtInDataSources, type DataSourceRecord } from '../data/DataSource';
import { createField, type Field } from '../domain/Field';
import type { CsvImportResult, FieldBoundaryImportResult } from '../data/ImportPipeline';
import { OpenMeteoHistoricalProvider } from '../weather/OpenMeteoHistoricalProvider';
import { dailyWeatherRecordToObservations } from '../weather/dailyWeatherRecordToObservations';
import { summarizeWeatherWindow, growingDegreeDays as computeGrowingDegreeDays } from '../weather/WeatherIntelligence';
import type { DailyWeatherRecord } from '../weather/DailyWeatherRecord';
import { createDatasetRecord } from '../data/Dataset';
import { summarizeFieldCropStatus } from '../domain/CropStatusChange';
import { assessCropStress } from '../sensing/CropStressSignal';
import { assessDatasetReadiness } from '../sensing/ModelRegistry';
import { summarizeSoilSampleQuality } from '../soil/SoilQuality';
import { buildFieldTwin } from '../twin/FieldTwin';
import { KnowledgeGraph } from '../graph/KnowledgeGraph';
import { TwinPanel } from '../ui/TwinPanel';
import type { DroneState } from '../drone/DroneState';
import { decideNextMission } from '../drone/AutonomyEngine';
import { createFleetDrone, assignMission, type FleetDrone } from '../fleet/Fleet';
import { SimulatedFlightController } from '../hardware/HardwareInterface';
import { OperationsPanel } from '../ui/OperationsPanel';
import { FarmerPanel } from '../ui/FarmerPanel';
import { buildFarmerOverview } from '../farmer/FarmerInsights';
import { tasksFromRecommendations, transitionTask, type FarmTask, type TaskStatus } from '../farmer/Task';
import { deriveSyncStatus } from '../offline/OfflineSync';
import type { LanguageCode } from '../i18n/i18n';
import { ResearchPanel } from '../ui/ResearchPanel';
import { SatellitePanel, type SatellitePanelState } from '../ui/SatellitePanel';
import { SatelliteFieldView } from '../ui/SatelliteFieldView';
import { SentinelStacProvider } from '../satellite/SentinelStacProvider';
import { buildFieldRasterFromSentinelScene } from '../satellite/SentinelRasterBuilder';
import { analyzeFieldFromSentinelRaster } from '../satellite/SentinelFieldPipeline';
import { createSentinelDataSourceRecord, createSentinelDatasetRecord } from '../satellite/registerSentinelDataset';
import { SatelliteProviderError } from '../satellite/SentinelTypes';
import { ensureRealTestField } from '../world/realTestField';
import { boundingBox } from '../geo/geometry';
import { explainRecommendation, explainFieldOptimization } from '../explainability/Explanation';
import { buildDecisionTrace } from '../explainability/DecisionTrace';
import { runIrrigationWhatIf } from '../research/Experiment';
import { buildResearchCatalog } from '../research/ResearchCatalog';
import { PLANNED_MODELS, TRAINED_MODELS } from '../sensing/ModelRegistry';
import { generateFieldSections } from '../analysis/FieldSectioning';
import { recommendFromSectionEvidence } from '../sensing/RecommendationEngine';

/** Days of historical weather fetched once at startup — enough for a real Growing Degree Days window without an oversized request. */
const WEATHER_HISTORY_DAYS = 14;
/** Documented generic GDD base temperature (°C) — common for maize; this app has no per-crop calibration, see WeatherIntelligence.ts. */
const GDD_BASE_TEMP_C = 10;

const CAMERA_BUTTON_IDS: Record<CameraMode, string> = {
  orbit: 'btnOrbit',
  follow: 'btnFollow',
  top: 'btnTopDown',
  fpv: 'btnFPV'
};

/** How often a sampled Observation is persisted to IndexedDB — every tick would be 60Hz of writes for no benefit at this stage. */
const OBSERVATION_PERSIST_INTERVAL_MS = 2000;
/** How often the real weather provider is polled — Open-Meteo's own data doesn't change faster than this and the WeatherService caches beneath it anyway. */
const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** How often sensor health is recomputed from recent observations — health doesn't need per-frame granularity. */
const SENSOR_HEALTH_REFRESH_INTERVAL_MS = 5000;

/** Wires the scene, simulation, domain/persistence, geospatial, and weather layers together; owns the render loop. */
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
  private readonly weatherPanel = new WeatherPanel();
  private readonly analysisRegistryPanel = new AnalysisRegistryPanel();
  private readonly dataCatalogPanel = new DataCatalogPanel();
  private readonly twinPanel = new TwinPanel();
  private readonly operationsPanel = new OperationsPanel();
  private readonly farmerPanel = new FarmerPanel();
  private readonly researchPanel = new ResearchPanel();
  private readonly satellitePanel = new SatellitePanel();
  private satelliteFieldView: SatelliteFieldView | null = null;
  private readonly sentinelProvider = new SentinelStacProvider();
  private satelliteState: SatellitePanelState = { status: 'IDLE' };
  private satelliteFetchInFlight = false;
  private registeredSentinelSource = false;
  private tasks: FarmTask[] = [];
  private readonly knownTaskProvenance = new Set<string>();
  private language: LanguageCode = 'en';
  private readonly simulatedFlightController = new SimulatedFlightController('flight_controller_1', [{ kind: 'flight-controller', observationTypes: ['drone.position', 'drone.orientation'] }]);
  private readonly importPanel: ImportPanel;
  private readonly importedObservationIds = new Set<string>();
  private readonly observationLog = new ObservationLog();
  private readonly minimap = new Minimap(
    document.getElementById('minimapCanvas') as HTMLCanvasElement,
    this.flightPathVisual.curve.getPoints(80)
  );
  private readonly weatherService: WeatherService;
  private readonly weatherHistoryProvider = new OpenMeteoHistoricalProvider();
  private dailyWeatherRecords: DailyWeatherRecord[] = [];
  private geoView: GeoView | null = null;
  private geoViewOpen = false;
  private latestWeather: Awaited<ReturnType<WeatherService['getCurrentWeather']>> = null;
  private latestDroneState: DroneState | null = null;
  private readonly analysisEvaluations: AnalysisEvaluation[];

  private readonly clock = new THREE.Clock();
  private simSeconds = 0;
  private paused = false;
  private lastPersistedAt = 0;
  private missionStartedEventRecorded = false;

  private constructor(
    private readonly repositories: AgriAetherRepositories,
    private readonly world: WorldRegistry,
    private readonly worldIds: DemoWorldIds,
    private readonly telemetryGenerator: TelemetryGenerator,
    csvSource: DataSourceRecord,
    geojsonSource: DataSourceRecord,
    importedObservationIds: string[],
    persistedTasks: FarmTask[],
    private readonly realField: Field
  ) {
    this.weatherService = new WeatherService(new OpenMeteoProvider(), repositories.weatherCache);
    for (const id of importedObservationIds) this.importedObservationIds.add(id);
    this.tasks = persistedTasks;
    for (const task of persistedTasks) this.knownTaskProvenance.add(task.provenance);
    this.farmerPanel.onLanguageChange = (lang) => {
      this.language = lang;
      this.renderFarmer();
    };
    this.farmerPanel.onTaskAction = (taskId, action) => this.handleTaskAction(taskId, action);
    this.importPanel = new ImportPanel({
      farmId: this.worldIds.farmId,
      csvSource,
      geojsonSource,
      knownFieldIds: () => new Set(this.world.listFieldsForFarm(this.worldIds.farmId).map((f) => f.id)),
      knownZoneIds: () => new Set(this.world.listFieldsForFarm(this.worldIds.farmId).flatMap((f) => this.world.listZonesForField(f.id).map((z) => z.id))),
      knownSensorCapabilities: (sensorId) => this.world.listSensors().find((s) => s.id === sensorId)?.capabilities ?? null,
      existingObservationIds: () => this.importedObservationIds,
      onCsvImportComplete: (result) => this.handleCsvImportComplete(result),
      onFieldBoundaryImportComplete: (result) => this.handleFieldBoundaryImportComplete(result)
    });
    this.cameraRig.setMode('orbit');
    this.wireControls();
    this.simulation.start();
    this.simulatedFlightController.connect();
    window.addEventListener('resize', () => resizeSceneBundle(this.bundle));

    const farm = this.world.getFarm(this.worldIds.farmId);
    const field = this.world.getField(this.worldIds.fieldId);
    if (farm && field) {
      this.worldPanel.renderBreadcrumb(farm, field, 'Simulation UAV-01');
    }
    this.geoView = this.buildGeoView();

    this.analysisEvaluations = evaluateAllAnalyses(this.world.listSensors().map((s) => s.kind));

    this.refreshSensorHealth();
    setInterval(() => this.refreshSensorHealth(), SENSOR_HEALTH_REFRESH_INTERVAL_MS);

    void this.refreshWeather();
    setInterval(() => void this.refreshWeather(), WEATHER_REFRESH_INTERVAL_MS);

    void this.refreshWeatherHistory();
  }

  /**
   * Registers the built-in DataSource catalog (Phase 7) exactly once — by
   * name, not by re-creating a fresh random id every boot, so reloading the
   * app doesn't pile up duplicate DataSourceRecords in IndexedDB.
   */
  private static async ensureBuiltInDataSources(world: WorldRegistry): Promise<Record<string, DataSourceRecord>> {
    const existingByName = new Map(world.listDataSources().map((s) => [s.name, s]));
    const result: Record<string, DataSourceRecord> = {};
    for (const candidate of builtInDataSources()) {
      result[candidate.name] = existingByName.get(candidate.name) ?? (await world.registerDataSource(candidate));
    }
    return result;
  }

  /** Loads/seeds the domain world before the render loop starts — the one async step in an otherwise synchronous app. */
  static async create(): Promise<App> {
    const repositories = createRepositories();
    const world = await WorldRegistry.load(repositories);
    const generator = new TelemetryGenerator();
    const worldIds = await ensureDemoWorld(world, generator);
    const sourcesByName = await App.ensureBuiltInDataSources(world);
    const allObservations = await repositories.observations.list();
    const importedObservationIds = allObservations.filter((o) => o.id.startsWith('obs_import_')).map((o) => o.id);
    const persistedTasks = await repositories.tasks.list();
    const { field: realField } = await ensureRealTestField(world);
    return new App(
      repositories,
      world,
      worldIds,
      generator,
      sourcesByName['CSV Agricultural Data Import'],
      sourcesByName['GeoJSON Field Boundary Import'],
      importedObservationIds,
      persistedTasks,
      realField
    );
  }

  private handleCsvImportComplete(result: CsvImportResult): void {
    for (const obs of result.accepted) {
      this.observationLog.push(obs);
      this.importedObservationIds.add(obs.id);
      void this.repositories.observations.save(obs);
    }
    void this.world.recordImport(result.report);
    if (this.dataCatalogPanel) this.renderDataCatalog();
  }

  private handleFieldBoundaryImportComplete(result: FieldBoundaryImportResult): void {
    void this.world.recordImport(result.report);
    if (!result.geoReference) return;
    const field = createField({
      farmId: this.worldIds.farmId,
      name: `Imported Field (${new Date(result.report.startedAt).toLocaleString()})`,
      geoReference: result.geoReference,
      areaHectares: result.areaHectares
    });
    void this.world.registerField(field).then(() => this.renderDataCatalog());
  }

  private buildGeoView(): GeoView | null {
    const field = this.world.getField(this.worldIds.fieldId);
    const zoneA = this.world.getZone(this.worldIds.zoneAId);
    const zoneB = this.world.getZone(this.worldIds.zoneBId);
    const canvas = document.getElementById('geoViewCanvas') as HTMLCanvasElement | null;
    if (!canvas || !field || !zoneA || !zoneB) return null;
    if (field.geoReference.kind !== 'geodetic' || zoneA.geoReference.kind !== 'geodetic' || zoneB.geoReference.kind !== 'geodetic') {
      return null; // demo world wasn't seeded with geometry (e.g. an older persisted world) — nothing to plot, not an error
    }
    if (field.geoReference.geometry.type !== 'Polygon' || zoneA.geoReference.geometry.type !== 'Polygon' || zoneB.geoReference.geometry.type !== 'Polygon') {
      return null;
    }
    return new GeoView(canvas, field.geoReference.geometry, zoneA.geoReference.geometry, zoneB.geoReference.geometry);
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

    document.getElementById('btnAnalyses')?.addEventListener('click', () => {
      const open = this.analysisRegistryPanel.toggle();
      if (open) this.analysisRegistryPanel.render(this.analysisEvaluations);
      setButtonActive('btnAnalyses', open);
    });

    document.getElementById('btnDataCatalog')?.addEventListener('click', () => {
      const open = this.dataCatalogPanel.toggle();
      if (open) this.renderDataCatalog();
      setButtonActive('btnDataCatalog', open);
    });

    document.getElementById('btnImport')?.addEventListener('click', () => {
      const open = this.importPanel.toggle();
      setButtonActive('btnImport', open);
    });

    document.getElementById('btnTwin')?.addEventListener('click', () => {
      const open = this.twinPanel.toggle();
      if (open) this.renderTwin();
      setButtonActive('btnTwin', open);
    });

    document.getElementById('btnOps')?.addEventListener('click', () => {
      const open = this.operationsPanel.toggle();
      if (open) this.renderOperations();
      setButtonActive('btnOps', open);
    });

    document.getElementById('btnFarmer')?.addEventListener('click', () => {
      const open = this.farmerPanel.toggle();
      if (open) this.renderFarmer();
      setButtonActive('btnFarmer', open);
    });

    document.getElementById('btnResearch')?.addEventListener('click', () => {
      const open = this.researchPanel.toggle();
      if (open) this.renderResearch();
      setButtonActive('btnResearch', open);
    });

    this.satellitePanel.onFetchRequested = () => void this.fetchRealSentinelData();
    this.satellitePanel.onGenerateZonesRequested = () => void this.generateManagementZones();
    document.getElementById('btnSatellite')?.addEventListener('click', () => {
      const open = this.satellitePanel.toggle();
      setButtonActive('btnSatellite', open);
      if (open) this.renderSatellite();
    });

    document.getElementById('btnGeoView')?.addEventListener('click', () => {
      this.geoViewOpen = !this.geoViewOpen;
      document.getElementById('geoView')?.classList.toggle('hidden', !this.geoViewOpen);
      setButtonActive('btnGeoView', this.geoViewOpen);
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

  /**
   * A DEMO_ONLY geodetic estimate of the drone's position, derived from its
   * simulated local position via georeference.ts's flat-earth
   * approximation. Provenance is ESTIMATED (a transform applied to a
   * simulated value), never SIMULATED-as-if-precise and never MEASURED —
   * this is not a real GNSS fix.
   */
  private deriveDroneGeodeticObservation(
    droneState: { position: { x: number; z: number }; timestamp: number }
  ): Observation<{ crs: 'EPSG:4326'; lat: number; lon: number }> {
    const geo = simulationLocalToDemoGeodetic(DEMO_FIELD_ANCHOR, droneState.position);
    return createEstimatedObservation({
      type: 'drone.position.geodetic_demo',
      value: { crs: 'EPSG:4326', ...geo },
      unit: null,
      timestamp: droneState.timestamp,
      location: { frame: 'geodetic', crs: 'EPSG:4326', lat: geo.lat, lon: geo.lon },
      source: 'demo-georeference-transform',
      confidence: 0.3,
      metadata: { note: 'DEMO_ONLY flat-earth approximation, not survey-grade' },
      ...this.observationContext
    });
  }

  /**
   * Assembles the Data Catalog view from data already collected elsewhere
   * in the app — real sensor kinds, real recent observations, real
   * registered datasets. `spatialCoverageFraction` is left undefined
   * (never a fabricated percentage): no raster has been ingested for the
   * live field, only the field boundary vector dataset from demoWorld.ts.
   */
  private renderDataCatalog(): void {
    const field = this.world.getField(this.worldIds.fieldId);
    if (!field) return;

    const availableSensorKinds = this.world.listSensors().map((s) => s.kind);
    const recentObservations = this.observationLog.recent(200);
    const datasets = this.world.listDatasets();

    const coverage = computeFieldCoverage({
      fieldId: field.id,
      availableSensorKinds,
      observations: recentObservations,
      weatherAvailable: this.latestWeather !== null
    });
    const gaps = detectDataGaps(coverage);
    const missionRequirements = evaluateMissionDataRequirements(this.analysisEvaluations, availableSensorKinds);
    const summary = buildFieldSummary({
      fieldId: field.id,
      fieldName: field.name,
      areaHectares: field.areaHectares,
      datasetCount: datasets.length,
      sensorObservationCount: recentObservations.length,
      latestAcquisition: coverage.temporalCoverage.latestObservation,
      coverage,
      gaps,
      analysisEvaluations: this.analysisEvaluations
    });

    const deployedSensors = this.world.listSensors();
    const sensorRegistry = (Object.keys(SENSOR_CAPABILITY_CATALOG) as SensorKind[]).map((kind) => ({
      kind,
      deployedCount: deployedSensors.filter((s) => s.kind === kind).length
    }));

    const soilSamples = this.world.listSoilSamplesForField(field.id);
    const cropObservations = this.world.listCropObservationsForField(field.id);
    const latestSoilSample = soilSamples.length > 0 ? soilSamples.reduce((a, b) => (b.timestamp > a.timestamp ? b : a)) : null;
    const latestSoilQuality = latestSoilSample ? summarizeSoilSampleQuality(latestSoilSample) : null;
    const latestDailyWeather = this.dailyWeatherRecords.length > 0 ? this.dailyWeatherRecords[this.dailyWeatherRecords.length - 1] : null;
    const cropStatus = summarizeFieldCropStatus(field.id, cropObservations);

    const cropStress = assessCropStress({
      fieldId: field.id,
      vegetationIndex: null, // no multispectral sensor deployed in this world — never fabricated
      soilMoistureStatus: latestSoilQuality?.moistureStatus ?? null,
      soilEcStatus: latestSoilQuality?.ecStatus ?? null,
      soilSampleId: latestSoilSample?.id ?? null,
      recentTMaxC: latestDailyWeather?.tMaxC ?? null,
      weatherObservationId: latestDailyWeather?.id ?? null,
      hasCropObservation: cropObservations.length > 0
    });

    this.dataCatalogPanel.render({
      summary,
      gaps,
      missionRequirements,
      datasets,
      soilSamples,
      groundSamples: this.world.listGroundSamplesForField(field.id),
      cropObservations,
      sensorRegistry,
      dataSources: this.world.listDataSources(),
      importRecords: this.world.listImportRecords(),
      weatherWindow: this.dailyWeatherRecords.length > 0 ? summarizeWeatherWindow(this.dailyWeatherRecords) : null,
      growingDegreeDays: this.dailyWeatherRecords.length > 0 ? computeGrowingDegreeDays(this.dailyWeatherRecords, GDD_BASE_TEMP_C) : null,
      cropStatus,
      cropStress,
      modelReadiness: assessDatasetReadiness('CROP_STRESS_CLASSIFICATION', 0)
    });
  }

  /** Shared by renderTwin and renderOperations — one Digital Twin construction, not two divergent copies. */
  private computeTwinForField(field: Field) {
    const recentObservations = this.observationLog.recent(200);
    const coverage = computeFieldCoverage({
      fieldId: field.id,
      availableSensorKinds: this.world.listSensors().map((s) => s.kind),
      observations: recentObservations,
      weatherAvailable: this.latestWeather !== null
    });

    const twin = buildFieldTwin({
      field,
      zones: this.world.listZonesForField(field.id),
      activeSensors: this.world.listSensors(),
      recentObservations,
      soilSamples: this.world.listSoilSamplesForField(field.id),
      cropObservations: this.world.listCropObservationsForField(field.id),
      dailyWeatherRecords: this.dailyWeatherRecords,
      coverage,
      dataGaps: detectDataGaps(coverage),
      recentEvents: this.world.listEventsForField(field.id)
    });

    return { twin, recentObservations };
  }

  /** Assembles the Digital Twin + knowledge-graph evidence view from the same real data renderDataCatalog uses — no separate data source, no fabricated score. */
  private renderTwin(): void {
    const field = this.world.getField(this.worldIds.fieldId);
    if (!field) return;

    const { twin, recentObservations } = this.computeTwinForField(field);

    const graph = KnowledgeGraph.build(this.world, recentObservations, [
      {
        id: twin.diseasePestRisk.id,
        type: 'disease_pest_risk',
        fieldId: twin.diseasePestRisk.fieldId,
        zoneId: twin.diseasePestRisk.zoneId,
        computedAt: twin.diseasePestRisk.computedAt,
        supportingObservationIds: twin.diseasePestRisk.riskFactors.flatMap((f) => f.supportingObservationIds)
      },
      ...twin.recommendations.map((r) => ({
        id: r.id,
        type: `recommendation.${r.category.toLowerCase()}`,
        fieldId: r.fieldId,
        zoneId: r.zoneId,
        computedAt: r.timestamp,
        supportingObservationIds: r.evidenceObservationIds
      }))
    ]);
    const evidenceNodes = graph.evidenceFor(`Field:${field.id}`);

    const modelReadiness = [
      assessDatasetReadiness('CROP_STRESS_CLASSIFICATION', 0),
      assessDatasetReadiness('DISEASE_CLASSIFICATION', 0),
      assessDatasetReadiness('YIELD_ESTIMATION', 0),
      assessDatasetReadiness('IRRIGATION_DEMAND', 0),
      assessDatasetReadiness('NUTRIENT_STATUS', 0)
    ];

    this.twinPanel.render(twin, evidenceNodes, modelReadiness);
  }

  /** Maps the drone's real FlightState to fleet availability — never invents a status the flight state machine didn't actually report. */
  private droneAvailabilityStatus(): FleetDrone['status'] {
    const flightState = this.latestDroneState?.flightState;
    if (!flightState) return 'OFFLINE';
    if (flightState === 'EMERGENCY') return 'OFFLINE';
    if (flightState === 'IDLE' || flightState === 'LANDED') return 'AVAILABLE';
    return 'ON_MISSION';
  }

  /**
   * Assembles the autonomous-operations view: the same Digital Twin this app
   * already computes, run through AutonomyEngine to pick a mission
   * objective, AgriculturalMission to plan real waypoints (or an explicit
   * limitation), MissionValidation as the safety gate, and Fleet to attempt
   * a capability-matched assignment against the one simulated drone this app
   * actually runs. Nothing here claims real flight — see SimulatedFlightController.
   */
  private renderOperations(): void {
    const field = this.world.getField(this.worldIds.fieldId);
    if (!field) return;

    const { twin } = this.computeTwinForField(field);
    const availableSensorKinds = this.world.listSensors().map((s) => s.kind);

    const decision = decideNextMission({ twin, geoReference: field.geoReference, availableSensorKinds });

    const droneCapabilities = this.world
      .listSensors()
      .filter((s) => s.platform === 'drone')
      .map((s) => s.kind);
    const fleetDrone: FleetDrone = createFleetDrone({
      name: 'Simulated Survey Drone',
      capabilities: droneCapabilities,
      provenance: 'SIMULATED',
      status: this.droneAvailabilityStatus(),
      batteryStateOfCharge: this.latestDroneState?.battery.stateOfCharge ?? null
    });
    const assignment = assignMission({ drones: [fleetDrone], plan: decision.plan });

    this.operationsPanel.render({
      decision,
      fleetDrone,
      assignment,
      flightController: {
        id: this.simulatedFlightController.id,
        connectionState: this.simulatedFlightController.connectionState,
        provenance: this.simulatedFlightController.provenance
      }
    });
  }

  /**
   * The farmer-facing view: same Digital Twin + AutonomyEngine decision as
   * the operator Ops panel, rephrased into plain language (see
   * farmer/FarmerInsights.ts) with lightweight tasks derived from
   * recommendations. New tasks are created once per recommendation
   * (deduped by provenance) and persisted — re-opening this panel never
   * duplicates an existing task or silently drops a farmer's status change.
   */
  private renderFarmer(): void {
    const field = this.world.getField(this.worldIds.fieldId);
    if (!field) return;

    const { twin } = this.computeTwinForField(field);
    const availableSensorKinds = this.world.listSensors().map((s) => s.kind);
    const missionDecision = decideNextMission({ twin, geoReference: field.geoReference, availableSensorKinds });

    const newTasks = tasksFromRecommendations(twin.recommendations).filter((t) => !this.knownTaskProvenance.has(t.provenance));
    for (const task of newTasks) {
      this.knownTaskProvenance.add(task.provenance);
      this.tasks.push(task);
      void this.repositories.tasks.save(task);
    }

    const overview = buildFarmerOverview({ twin, missionDecision });
    const syncStatus = deriveSyncStatus({ hasRemoteEndpoint: false, error: null });

    this.farmerPanel.render({
      overview,
      tasks: this.tasks.filter((t) => t.fieldId === field.id && t.status !== 'COMPLETED' && t.status !== 'DISMISSED'),
      syncStatus,
      language: this.language
    });
  }

  private handleTaskAction(taskId: string, action: TaskStatus): void {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return;
    try {
      const updated = transitionTask(this.tasks[index], action);
      this.tasks[index] = updated;
      void this.repositories.tasks.save(updated);
    } catch {
      // Stale button click against a task whose status already moved on — ignore rather than crash the panel.
    }
    this.renderFarmer();
  }

  /**
   * The research/explainability view: picks the field's top actionable
   * recommendation (falling back to the field-optimization result) and
   * explains it, traces it through the same KnowledgeGraph the Twin panel
   * uses, runs one demonstration irrigation what-if against the field's
   * real current evidence, and indexes everything into a research catalog
   * alongside registered datasets/models. Nothing here recomputes evidence
   * — it only explains/traces/catalogs what other panels already show.
   */
  private renderResearch(): void {
    const field = this.world.getField(this.worldIds.fieldId);
    if (!field) return;

    const { twin, recentObservations } = this.computeTwinForField(field);
    const topRecommendation = twin.recommendations.find((r) => r.status === 'ACTIONABLE') ?? null;
    const explanation = topRecommendation ? explainRecommendation(topRecommendation) : explainFieldOptimization(twin.fieldOptimization);

    const graph = KnowledgeGraph.build(this.world, recentObservations, [
      {
        id: explanation.subjectId,
        type: explanation.subjectType,
        fieldId: field.id,
        zoneId: null,
        computedAt: explanation.generatedAt,
        supportingObservationIds: explanation.evidenceObservationIds
      }
    ]);
    const decisionTrace = buildDecisionTrace({ explanation, graph, subjectGraphNodeId: `Field:${field.id}` });

    const scenarioMoisture = twin.irrigation.moistureStatus === 'DRY' ? 'ADEQUATE' : 'DRY';
    const experiment = runIrrigationWhatIf({
      name: 'What if soil moisture were different right now?',
      baseline: {
        fieldId: field.id,
        moistureStatus: twin.irrigation.moistureStatus,
        moistureSampleId: twin.irrigation.moistureSampleId,
        observations: recentObservations as Observation<number>[],
        recentRainfallMm: twin.irrigation.recentRainfallMm,
        recentEvents: this.world.listEventsForField(field.id)
      },
      scenarioOverrides: { moistureStatus: scenarioMoisture }
    });

    const catalog = buildResearchCatalog({
      datasets: this.world.listDatasetsForField(field.id),
      models: PLANNED_MODELS,
      experiments: [experiment],
      decisionTraces: [decisionTrace]
    });

    this.researchPanel.render({ explanation, decisionTrace, experiment, catalog });
  }

  /** Renders the satellite panel from whatever satelliteState currently is — never triggers a fetch itself (see fetchRealSentinelData). */
  private renderSatellite(): void {
    const trainedModel = TRAINED_MODELS.find((m) => m.task === 'CROP_VS_NONCROP_CLASSIFICATION') ?? null;
    this.satellitePanel.render(this.satelliteState, trainedModel);
    const canvas = document.getElementById('satelliteFieldCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    this.satelliteFieldView = new SatelliteFieldView(canvas);

    const geoRef = this.realField.geoReference;
    const fieldBoundary = geoRef.kind === 'geodetic' && geoRef.geometry.type === 'Polygon' ? geoRef.geometry : null;
    if (!fieldBoundary) return;

    if (this.satelliteState.status === 'READY') {
      this.satelliteFieldView.draw({
        status: 'READY',
        fieldBoundary,
        grid: this.satelliteState.analysis.grid,
        ndviCells: this.satelliteState.analysis.ndviCells,
        zones: this.satelliteState.sectioning?.zones
      });
    } else if (this.satelliteState.status === 'IDLE') {
      this.satelliteFieldView.draw({ status: 'IDLE', message: 'Real field boundary shown — press Fetch for real NDVI.', fieldBoundary });
    } else {
      this.satelliteFieldView.draw({ status: this.satelliteState.status, message: this.satelliteState.message, fieldBoundary });
    }
  }

  /**
   * The one real, on-demand network operation this milestone adds: a live
   * Sentinel-2 STAC search -> scene selection -> SAS-signed COG windowed
   * read -> field clip -> real NDVI, run against `this.realField` (a real
   * WGS84 location — see world/realTestField.ts — never the Null Island
   * demo field). Every failure path sets an honest ERROR state with the
   * real reason; nothing here ever fabricates a READY result.
   */
  private async fetchRealSentinelData(): Promise<void> {
    if (this.satelliteFetchInFlight) return;
    this.satelliteFetchInFlight = true;
    this.satelliteState = { status: 'LOADING', message: 'Searching the real Sentinel-2 STAC catalog...' };
    this.renderSatellite();

    try {
      const geoRef = this.realField.geoReference;
      if (geoRef.kind !== 'geodetic' || geoRef.geometry.type !== 'Polygon') {
        throw new Error('Real test field has no polygon geometry — cannot search by bounding box.');
      }
      const fieldBoundary = geoRef.geometry;
      const bbox = boundingBox(fieldBoundary);

      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - 180);

      const scenes = await this.sentinelProvider.search({
        bbox,
        dateRangeStartIso: start.toISOString(),
        dateRangeEndIso: now.toISOString(),
        maxCloudCoverPercent: 40,
        limit: 20
      });
      const scene = this.sentinelProvider.selectBestScene(scenes, ['RED', 'NIR']);

      this.satelliteState = { status: 'LOADING', message: `Reading real pixels from scene ${scene.itemId}...` };
      this.renderSatellite();

      const grid = await buildFieldRasterFromSentinelScene({
        scene,
        fieldBboxWgs84: bbox,
        bands: ['RED', 'NIR'],
        signHref: (href) => this.sentinelProvider.signAssetHref(href)
      });

      const analysis = analyzeFieldFromSentinelRaster({ grid, scene, fieldGeometry: fieldBoundary, fieldId: this.realField.id });
      const dataset = createSentinelDatasetRecord({ analysis, fieldId: this.realField.id });
      await this.world.registerDataset(dataset);

      if (!this.registeredSentinelSource) {
        await this.world.registerDataSource(createSentinelDataSourceRecord());
        this.registeredSentinelSource = true;
      }

      const newObservations = analysis.ndviObservation ? [...analysis.rawBandObservations, analysis.ndviObservation] : analysis.rawBandObservations;
      for (const obs of newObservations) {
        this.observationLog.push(obs);
        void this.repositories.observations.save(obs);
      }

      this.satelliteState = { status: 'READY', analysis, dataset, sectioning: null, sectionRecommendations: [], knowledgeGraphEvidenceCount: null };
    } catch (error) {
      const message = error instanceof SatelliteProviderError ? `${error.message} (${error.kind})` : (error as Error).message;
      this.satelliteState = { status: 'ERROR', message };
    } finally {
      this.satelliteFetchInFlight = false;
      this.renderSatellite();
    }
  }

  /**
   * Generates real evidence-based (GIS_DERIVED) management zones from the
   * real per-pixel NDVI the last successful Sentinel-2 fetch produced (see
   * analysis/FieldSectioning.ts) and registers each as a real Zone via
   * WorldRegistry — the first real producer of Zone.classification =
   * 'GIS_DERIVED'. Also attaches a conservative recommendation per zone
   * (never a confident diagnosis/treatment) and, when the trained
   * crop-classification model exists, an explicitly UNVERIFIED-for-this-
   * field prediction reference — no live prediction is fabricated here
   * because the live pipeline does not yet fetch the 6-band/3-timestep
   * input that model requires (see ml/README.md).
   */
  private async generateManagementZones(): Promise<void> {
    if (this.satelliteState.status !== 'READY') return;
    const { analysis } = this.satelliteState;

    const sectioning = generateFieldSections({
      fieldId: this.realField.id,
      grid: analysis.grid,
      ndviCells: analysis.ndviCells,
      sourceObservationIds: analysis.ndviObservation ? [analysis.ndviObservation.id] : [],
      sourceDatasetIds: [this.satelliteState.dataset.id]
    });

    for (const zone of sectioning.zones) {
      await this.world.registerZone(zone);
    }

    const sectionRecommendations = sectioning.generationRecords.flatMap((record) =>
      recommendFromSectionEvidence({ fieldId: this.realField.id, zoneId: record.zoneId, zoneGeneration: record, prediction: null })
    );

    // Real Knowledge Graph traversal for the real field: each zone's generation record becomes an Analysis
    // node (reusing the same mechanism Push 1's disease-risk/recommendation Analysis nodes already use — no
    // new relationship types), and Zone nodes appear automatically via KnowledgeGraph.build's existing
    // Field->Zone iteration, so a real GIS_DERIVED zone is graph-traversable with zero KnowledgeGraph.ts changes.
    const realFieldObservations = this.observationLog.recent(200).filter((o) => o.fieldId === this.realField.id);
    const graph = KnowledgeGraph.build(
      this.world,
      realFieldObservations,
      sectioning.generationRecords.map((record) => ({
        id: record.zoneId,
        type: 'gis_derived_zone',
        fieldId: this.realField.id,
        zoneId: record.zoneId,
        computedAt: record.generatedAt,
        supportingObservationIds: record.sourceObservationIds
      }))
    );
    const evidenceCount = graph.evidenceFor(`Field:${this.realField.id}`).length;

    this.satelliteState = { ...this.satelliteState, sectioning, sectionRecommendations, knowledgeGraphEvidenceCount: evidenceCount };
    this.renderSatellite();
  }

  private refreshSensorHealth(): void {
    const farm = this.world.getFarm(this.worldIds.farmId);
    const field = this.world.getField(this.worldIds.fieldId);
    if (!farm || !field) return;
    const sensors = this.world.listSensors();
    const health = sensors.map((sensor) => evaluateSensorHealth(sensor, this.observationLog.recent(200)));
    this.worldPanel.renderSensorHealth(sensors, health);
  }

  private async refreshWeather(): Promise<void> {
    try {
      const result = await this.weatherService.getCurrentWeather(DEMO_FIELD_ANCHOR);
      this.latestWeather = result;
      this.weatherPanel.update(result);
      if (result) {
        const observations = weatherObservationToObservations(result.observation, {
          farmId: this.worldIds.farmId,
          fieldId: this.worldIds.fieldId
        });
        for (const obs of observations) {
          this.observationLog.push(obs);
          void this.repositories.observations.save(obs);
        }
      }
    } catch (error) {
      // WeatherService already falls back to cache internally; a rejection here means something
      // unexpected (e.g. the cache repository itself failing). The simulator must keep running either way.
      console.warn('[AgriAether] weather refresh failed unexpectedly:', error);
      this.weatherPanel.update(null);
    }
  }

  /**
   * Fetches real daily historical weather once at startup (Milestone: Real
   * Dataset Foundation) — a live network call, not a fixture. On failure
   * (offline, provider unreachable), this.dailyWeatherRecords simply stays
   * whatever was already persisted from a previous successful fetch (or
   * empty) — the Data Catalog's Weather Intelligence section renders that
   * honestly rather than inventing values.
   */
  private async refreshWeatherHistory(): Promise<void> {
    try {
      const records = await this.weatherHistoryProvider.fetchDailyHistory(DEMO_FIELD_ANCHOR, WEATHER_HISTORY_DAYS);
      for (const record of records) {
        await this.world.recordDailyWeather(record);
        const observations = dailyWeatherRecordToObservations(record, { farmId: this.worldIds.farmId, fieldId: this.worldIds.fieldId });
        for (const obs of observations) {
          this.observationLog.push(obs);
          void this.repositories.observations.save(obs);
        }
      }
      this.dailyWeatherRecords = this.world.listDailyWeatherRecords();

      if (records.length > 0 && !this.world.listDatasets().some((d) => d.name === 'Open-Meteo Historical Daily Weather')) {
        await this.world.registerDataset(
          createDatasetRecord({
            name: 'Open-Meteo Historical Daily Weather',
            provider: 'Open-Meteo',
            source: 'https://api.open-meteo.com/v1/forecast (daily, past_days)',
            type: 'WEATHER',
            acquiredAtStart: Date.parse(`${records[0].date}T00:00:00Z`),
            acquiredAtEnd: Date.parse(`${records[records.length - 1].date}T00:00:00Z`),
            spatialExtent: [DEMO_FIELD_ANCHOR.lon, DEMO_FIELD_ANCHOR.lat, DEMO_FIELD_ANCHOR.lon, DEMO_FIELD_ANCHOR.lat],
            crs: 'EPSG:4326',
            license: 'CC BY 4.0',
            attribution: 'Weather data by Open-Meteo.com',
            provenance: 'EXTERNAL',
            quality: 'VALID',
            fieldId: this.worldIds.fieldId
          })
        );
      }
      if (this.dataCatalogPanel) this.renderDataCatalog();
    } catch (error) {
      console.warn('[AgriAether] weather history fetch failed unexpectedly:', error);
    }
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (!this.paused) {
      this.simSeconds += dt;
    }

    const droneState = this.simulation.tick(dt);
    this.latestDroneState = droneState;
    const telemetry = this.telemetryGenerator.generate(droneState, this.observationContext);
    const geodeticEstimate = this.deriveDroneGeodeticObservation(droneState);
    const observations: Observation<unknown>[] = [
      telemetry.position,
      telemetry.orientation,
      telemetry.altitude,
      telemetry.battery,
      telemetry.groundSpeed,
      telemetry.heading,
      geodeticEstimate,
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
    if (this.geoViewOpen && this.geoView) {
      this.geoView.draw(geodeticEstimate.value, this.latestWeather?.observation.location ?? null);
    }

    this.bundle.renderer.render(this.bundle.scene, this.bundle.camera);
  };

  run(): void {
    this.tick();
    this.hud.hideLoadingScreen();
  }
}
