import type { Farm } from '../domain/Farm';
import type { Field } from '../domain/Field';
import type { Zone } from '../domain/Zone';
import type { CropCycle } from '../domain/Crop';
import type { SensorRecord } from '../domain/SensorRecord';
import type { SensorDeployment } from '../domain/SensorDeployment';
import type { AgriculturalEvent } from '../domain/AgriculturalEvent';
import type { DatasetRecord } from '../data/Dataset';
import type { SoilSample } from '../soil/SoilSample';
import type { GroundSample } from '../sensors/GroundSample';
import type { CropObservation } from '../domain/CropObservation';
import type { DataSourceRecord } from '../data/DataSource';
import type { ImportReport } from '../data/ImportPipeline';
import type { DailyWeatherRecord } from '../weather/DailyWeatherRecord';
import type { AgriAetherRepositories } from '../persistence/repositories';

/**
 * The in-memory index of the Farm/Field/Zone/Sensor world, loaded once from
 * the repositories at startup. Its one job is referential integrity and
 * lookup — "does this field's farm actually exist," "what sensors are
 * deployed on this drone" — not general application state. Every mutating
 * method both validates the relationship and persists the result; nothing
 * bypasses it to write a repository directly, so this is the single place
 * an invalid Farm/Field/Zone/Sensor graph could be assembled, and the
 * single place it's prevented.
 */
export class WorldRegistry {
  private readonly farms = new Map<string, Farm>();
  private readonly fields = new Map<string, Field>();
  private readonly zones = new Map<string, Zone>();
  private readonly cropCycles = new Map<string, CropCycle>();
  private readonly sensors = new Map<string, SensorRecord>();
  private readonly sensorDeployments = new Map<string, SensorDeployment>();
  private readonly agriculturalEvents = new Map<string, AgriculturalEvent>();
  private readonly datasets = new Map<string, DatasetRecord>();
  private readonly soilSamples = new Map<string, SoilSample>();
  private readonly groundSamples = new Map<string, GroundSample>();
  private readonly cropObservations = new Map<string, CropObservation>();
  private readonly dataSources = new Map<string, DataSourceRecord>();
  private readonly importRecords = new Map<string, ImportReport>();
  private readonly dailyWeatherRecords = new Map<string, DailyWeatherRecord>();

  private constructor(private readonly repositories: AgriAetherRepositories) {}

  static async load(repositories: AgriAetherRepositories): Promise<WorldRegistry> {
    const registry = new WorldRegistry(repositories);
    const [farms, fields, zones, cropCycles, sensors, deployments, events, datasets, soilSamples, groundSamples, cropObservations, dataSources, importRecords, dailyWeatherRecords] = await Promise.all([
      repositories.farms.list(),
      repositories.fields.list(),
      repositories.zones.list(),
      repositories.cropCycles.list(),
      repositories.sensors.list(),
      repositories.sensorDeployments.list(),
      repositories.agriculturalEvents.list(),
      repositories.datasets.list(),
      repositories.soilSamples.list(),
      repositories.groundSamples.list(),
      repositories.cropObservations.list(),
      repositories.dataSources.list(),
      repositories.importRecords.list(),
      repositories.dailyWeatherRecords.list()
    ]);
    for (const farm of farms) registry.farms.set(farm.id, farm);
    for (const field of fields) registry.fields.set(field.id, field);
    for (const zone of zones) registry.zones.set(zone.id, zone);
    for (const cropCycle of cropCycles) registry.cropCycles.set(cropCycle.id, cropCycle);
    for (const sensor of sensors) registry.sensors.set(sensor.id, sensor);
    for (const deployment of deployments) registry.sensorDeployments.set(deployment.id, deployment);
    for (const event of events) registry.agriculturalEvents.set(event.id, event);
    for (const dataset of datasets) registry.datasets.set(dataset.id, dataset);
    for (const sample of soilSamples) registry.soilSamples.set(sample.id, sample);
    for (const sample of groundSamples) registry.groundSamples.set(sample.id, sample);
    for (const observation of cropObservations) registry.cropObservations.set(observation.id, observation);
    for (const source of dataSources) registry.dataSources.set(source.id, source);
    for (const record of importRecords) registry.importRecords.set(record.id, record);
    for (const record of dailyWeatherRecords) registry.dailyWeatherRecords.set(record.id, record);
    return registry;
  }

  async registerFarm(farm: Farm): Promise<Farm> {
    this.farms.set(farm.id, farm);
    await this.repositories.farms.save(farm);
    return farm;
  }

  async registerField(field: Field): Promise<Field> {
    if (!this.farms.has(field.farmId)) {
      throw new Error(`Field "${field.name}" references unknown farm "${field.farmId}"`);
    }
    this.fields.set(field.id, field);
    await this.repositories.fields.save(field);
    return field;
  }

  async registerZone(zone: Zone): Promise<Zone> {
    if (!this.fields.has(zone.fieldId)) {
      throw new Error(`Zone "${zone.name}" references unknown field "${zone.fieldId}"`);
    }
    this.zones.set(zone.id, zone);
    await this.repositories.zones.save(zone);
    return zone;
  }

  async registerCropCycle(cropCycle: CropCycle): Promise<CropCycle> {
    if (!this.fields.has(cropCycle.fieldId)) {
      throw new Error(`CropCycle references unknown field "${cropCycle.fieldId}"`);
    }
    if (cropCycle.zoneId && !this.zones.has(cropCycle.zoneId)) {
      throw new Error(`CropCycle references unknown zone "${cropCycle.zoneId}"`);
    }
    this.cropCycles.set(cropCycle.id, cropCycle);
    await this.repositories.cropCycles.save(cropCycle);
    return cropCycle;
  }

  async registerSensor(sensor: SensorRecord): Promise<SensorRecord> {
    this.sensors.set(sensor.id, sensor);
    await this.repositories.sensors.save(sensor);
    return sensor;
  }

  async registerSensorDeployment(deployment: SensorDeployment): Promise<SensorDeployment> {
    if (!this.sensors.has(deployment.sensorId)) {
      throw new Error(`SensorDeployment references unknown sensor "${deployment.sensorId}"`);
    }
    const target = deployment.attachedTo;
    if (target.kind === 'field' && !this.fields.has(target.id)) {
      throw new Error(`SensorDeployment references unknown field "${target.id}"`);
    }
    if (target.kind === 'zone' && !this.zones.has(target.id)) {
      throw new Error(`SensorDeployment references unknown zone "${target.id}"`);
    }
    this.sensorDeployments.set(deployment.id, deployment);
    await this.repositories.sensorDeployments.save(deployment);
    return deployment;
  }

  async recordEvent(event: AgriculturalEvent): Promise<AgriculturalEvent> {
    if (!this.fields.has(event.fieldId)) {
      throw new Error(`AgriculturalEvent references unknown field "${event.fieldId}"`);
    }
    this.agriculturalEvents.set(event.id, event);
    await this.repositories.agriculturalEvents.save(event);
    return event;
  }

  listEventsForField(fieldId: string): AgriculturalEvent[] {
    return Array.from(this.agriculturalEvents.values()).filter((e) => e.fieldId === fieldId);
  }

  async registerDataset(dataset: DatasetRecord): Promise<DatasetRecord> {
    if (dataset.fieldId && !this.fields.has(dataset.fieldId)) {
      throw new Error(`Dataset "${dataset.name}" references unknown field "${dataset.fieldId}"`);
    }
    this.datasets.set(dataset.id, dataset);
    await this.repositories.datasets.save(dataset);
    return dataset;
  }

  listDatasets(): DatasetRecord[] {
    return Array.from(this.datasets.values());
  }

  listDatasetsForField(fieldId: string): DatasetRecord[] {
    return Array.from(this.datasets.values()).filter((d) => d.fieldId === fieldId);
  }

  /** Requires an existing field so a sample can never reference a field that isn't part of the world — the same referential-integrity discipline as every other register* method here. If zoneId is set, it must both exist and actually belong to sample.fieldId — a sample can't claim a zone from a different field. */
  async registerSoilSample(sample: SoilSample): Promise<SoilSample> {
    if (!this.fields.has(sample.fieldId)) {
      throw new Error(`SoilSample references unknown field "${sample.fieldId}"`);
    }
    if (sample.zoneId) {
      const zone = this.zones.get(sample.zoneId);
      if (!zone) {
        throw new Error(`SoilSample references unknown zone "${sample.zoneId}"`);
      }
      if (zone.fieldId !== sample.fieldId) {
        throw new Error(`SoilSample's zone "${sample.zoneId}" belongs to field "${zone.fieldId}", not "${sample.fieldId}"`);
      }
    }
    this.soilSamples.set(sample.id, sample);
    await this.repositories.soilSamples.save(sample);
    return sample;
  }

  listSoilSamplesForField(fieldId: string): SoilSample[] {
    return Array.from(this.soilSamples.values()).filter((s) => s.fieldId === fieldId);
  }

  async registerGroundSample(sample: GroundSample): Promise<GroundSample> {
    if (!this.fields.has(sample.fieldId)) {
      throw new Error(`GroundSample references unknown field "${sample.fieldId}"`);
    }
    this.groundSamples.set(sample.id, sample);
    await this.repositories.groundSamples.save(sample);
    return sample;
  }

  listGroundSamplesForField(fieldId: string): GroundSample[] {
    return Array.from(this.groundSamples.values()).filter((s) => s.fieldId === fieldId);
  }

  async registerCropObservation(observation: CropObservation): Promise<CropObservation> {
    if (!this.fields.has(observation.fieldId)) {
      throw new Error(`CropObservation references unknown field "${observation.fieldId}"`);
    }
    this.cropObservations.set(observation.id, observation);
    await this.repositories.cropObservations.save(observation);
    return observation;
  }

  listCropObservationsForField(fieldId: string): CropObservation[] {
    return Array.from(this.cropObservations.values()).filter((o) => o.fieldId === fieldId);
  }

  getFarm(id: string): Farm | null {
    return this.farms.get(id) ?? null;
  }

  getField(id: string): Field | null {
    return this.fields.get(id) ?? null;
  }

  getZone(id: string): Zone | null {
    return this.zones.get(id) ?? null;
  }

  listFarms(): Farm[] {
    return Array.from(this.farms.values());
  }

  listFieldsForFarm(farmId: string): Field[] {
    return Array.from(this.fields.values()).filter((f) => f.farmId === farmId);
  }

  listZonesForField(fieldId: string): Zone[] {
    return Array.from(this.zones.values()).filter((z) => z.fieldId === fieldId);
  }

  listCropCyclesForField(fieldId: string): CropCycle[] {
    return Array.from(this.cropCycles.values()).filter((c) => c.fieldId === fieldId);
  }

  listSensors(): SensorRecord[] {
    return Array.from(this.sensors.values());
  }

  listDeploymentsFor(target: { kind: string; id: string }): SensorDeployment[] {
    return Array.from(this.sensorDeployments.values()).filter(
      (d) => d.attachedTo.kind === target.kind && d.attachedTo.id === target.id && d.status === 'ACTIVE'
    );
  }

  listAllDeployments(): SensorDeployment[] {
    return Array.from(this.sensorDeployments.values());
  }

  isEmpty(): boolean {
    return this.farms.size === 0;
  }

  /** Registered once per known source (built-in or discovered) — re-registering the same id overwrites, so calling this idempotently at startup is safe. */
  async registerDataSource(source: DataSourceRecord): Promise<DataSourceRecord> {
    this.dataSources.set(source.id, source);
    await this.repositories.dataSources.save(source);
    return source;
  }

  listDataSources(): DataSourceRecord[] {
    return Array.from(this.dataSources.values());
  }

  getDataSource(id: string): DataSourceRecord | null {
    return this.dataSources.get(id) ?? null;
  }

  /** Persists one import's audit report (Part 2/Part 8) — never mutated after the fact, so the Data Catalog's import history is a true record of what each import actually did. */
  async recordImport(report: ImportReport): Promise<ImportReport> {
    this.importRecords.set(report.id, report);
    await this.repositories.importRecords.save(report);
    return report;
  }

  listImportRecords(): ImportReport[] {
    return Array.from(this.importRecords.values()).sort((a, b) => b.startedAt - a.startedAt);
  }

  /** Idempotent by id — re-fetching an unchanged historical day overwrites with identical content rather than duplicating. */
  async recordDailyWeather(record: DailyWeatherRecord): Promise<DailyWeatherRecord> {
    this.dailyWeatherRecords.set(record.id, record);
    await this.repositories.dailyWeatherRecords.save(record);
    return record;
  }

  listDailyWeatherRecords(): DailyWeatherRecord[] {
    return Array.from(this.dailyWeatherRecords.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}
