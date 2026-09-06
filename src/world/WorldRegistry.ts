import type { Farm } from '../domain/Farm';
import type { Field } from '../domain/Field';
import type { Zone } from '../domain/Zone';
import type { CropCycle } from '../domain/Crop';
import type { SensorRecord } from '../domain/SensorRecord';
import type { SensorDeployment } from '../domain/SensorDeployment';
import type { AgriculturalEvent } from '../domain/AgriculturalEvent';
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

  private constructor(private readonly repositories: AgriAetherRepositories) {}

  static async load(repositories: AgriAetherRepositories): Promise<WorldRegistry> {
    const registry = new WorldRegistry(repositories);
    const [farms, fields, zones, cropCycles, sensors, deployments, events] = await Promise.all([
      repositories.farms.list(),
      repositories.fields.list(),
      repositories.zones.list(),
      repositories.cropCycles.list(),
      repositories.sensors.list(),
      repositories.sensorDeployments.list(),
      repositories.agriculturalEvents.list()
    ]);
    for (const farm of farms) registry.farms.set(farm.id, farm);
    for (const field of fields) registry.fields.set(field.id, field);
    for (const zone of zones) registry.zones.set(zone.id, zone);
    for (const cropCycle of cropCycles) registry.cropCycles.set(cropCycle.id, cropCycle);
    for (const sensor of sensors) registry.sensors.set(sensor.id, sensor);
    for (const deployment of deployments) registry.sensorDeployments.set(deployment.id, deployment);
    for (const event of events) registry.agriculturalEvents.set(event.id, event);
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
}
