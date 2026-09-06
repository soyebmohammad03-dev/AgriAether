import { createFarm } from '../domain/Farm';
import { createField } from '../domain/Field';
import { createZone } from '../domain/Zone';
import { createCropCycle } from '../domain/Crop';
import { createSensorRecordFromSensor } from '../domain/SensorRecord';
import { createSensorDeployment } from '../domain/SensorDeployment';
import { createId } from '../domain/id';
import type { TelemetryGenerator } from '../telemetry/TelemetryGenerator';
import { WorldRegistry } from './WorldRegistry';
import { buildDemoFieldBoundary, buildDemoZoneBoundaries } from '../geo/demoGeometry';
import { areaHectares } from '../geo/geometry';

export interface DemoWorldIds {
  farmId: string;
  fieldId: string;
  zoneAId: string;
  zoneBId: string;
  droneId: string;
}

const DEMO_FARM_NAME = 'Demo Farm';
const DEMO_FIELD_NAME = 'Field 01';

/**
 * Creates the one demonstration fixture this project ships — Demo Farm ›
 * Field 01 › Zone A / Zone B, a simulated drone, and the four sensors from
 * Phase 1 — the first time the registry is empty. Idempotent: if a Demo
 * Farm already exists (e.g. from a prior IndexedDB-persisted session), it
 * is looked up and reused rather than duplicated.
 *
 * Nothing here claims a real location, real crop, or real sensor
 * calibration — see the geoReference/growthStage/source fields below,
 * every one of which is explicitly "simulation" or "unknown."
 */
export async function ensureDemoWorld(registry: WorldRegistry, telemetryGenerator: TelemetryGenerator): Promise<DemoWorldIds> {
  const existingFarm = registry.listFarms().find((f) => f.name === DEMO_FARM_NAME);
  if (existingFarm) {
    const existingField = registry.listFieldsForFarm(existingFarm.id).find((f) => f.name === DEMO_FIELD_NAME);
    if (existingField) {
      const zones = registry.listZonesForField(existingField.id);
      const zoneA = zones.find((z) => z.name === 'Zone A');
      const zoneB = zones.find((z) => z.name === 'Zone B');
      const droneDeployment = registry.listAllDeployments().find((d) => d.attachedTo.kind === 'drone');
      const droneId = droneDeployment?.attachedTo.id;
      if (zoneA && zoneB && droneId) {
        return { farmId: existingFarm.id, fieldId: existingField.id, zoneAId: zoneA.id, zoneBId: zoneB.id, droneId };
      }
    }
  }

  const farm = await registry.registerFarm(
    createFarm({
      name: DEMO_FARM_NAME,
      description: 'Demonstration/simulation farm — not a real location. Seeded by AgriAether Phase 2.',
      geoReference: { kind: 'simulation' }
    })
  );

  const fieldBoundary = buildDemoFieldBoundary();
  const field = await registry.registerField(
    createField({
      farmId: farm.id,
      name: DEMO_FIELD_NAME,
      description:
        'The field the default survey-loop mission flies over. Boundary is DEMO_ONLY geometry anchored at Null Island (0°N 0°E) — not a real survey.',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: fieldBoundary, provenance: 'DEMO_ONLY' },
      areaHectares: areaHectares(fieldBoundary),
      status: 'active'
    })
  );

  const { zoneA: zoneABoundary, zoneB: zoneBBoundary } = buildDemoZoneBoundaries();

  const zoneA = await registry.registerZone(
    createZone({
      fieldId: field.id,
      name: 'Zone A',
      classification: 'SIMULATED_MANAGEMENT_ZONE',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: zoneABoundary, provenance: 'DEMO_ONLY' }
    })
  );

  const zoneB = await registry.registerZone(
    createZone({
      fieldId: field.id,
      name: 'Zone B',
      classification: 'SIMULATED_MANAGEMENT_ZONE',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: zoneBBoundary, provenance: 'DEMO_ONLY' }
    })
  );

  await registry.registerCropCycle(
    createCropCycle({
      fieldId: field.id,
      cropTypeId: null,
      growthStage: 'UNKNOWN',
      source: 'UNKNOWN'
    })
  );

  const droneId = createId('drone');
  for (const sensor of telemetryGenerator.sensors) {
    const record = await registry.registerSensor(createSensorRecordFromSensor(sensor));
    await registry.registerSensorDeployment(
      createSensorDeployment({ sensorId: record.id, attachedTo: { kind: 'drone', id: droneId } })
    );
  }

  return { farmId: farm.id, fieldId: field.id, zoneAId: zoneA.id, zoneBId: zoneB.id, droneId };
}
