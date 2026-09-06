import { describe, expect, it, beforeEach } from 'vitest';
import { WorldRegistry } from './WorldRegistry';
import { createInMemoryRepositories } from '../persistence/repositories';
import { createFarm } from '../domain/Farm';
import { createField } from '../domain/Field';
import { createZone } from '../domain/Zone';
import { createSensorRecord } from '../domain/SensorRecord';
import { createSensorDeployment } from '../domain/SensorDeployment';
import { createCropCycle } from '../domain/Crop';
import { createAgriculturalEvent } from '../domain/AgriculturalEvent';

async function freshRegistry(): Promise<WorldRegistry> {
  return WorldRegistry.load(createInMemoryRepositories());
}

describe('WorldRegistry relationship invariants', () => {
  let registry: WorldRegistry;
  beforeEach(async () => {
    registry = await freshRegistry();
  });

  it('a field cannot reference a nonexistent farm', async () => {
    const field = createField({ farmId: 'farm_does_not_exist', name: 'Field 01', geoReference: { kind: 'simulation' } });
    await expect(registry.registerField(field)).rejects.toThrow(/unknown farm/);
  });

  it('a zone cannot reference a nonexistent field', async () => {
    const zone = createZone({ fieldId: 'field_does_not_exist', name: 'Zone A', classification: 'SIMULATED_MANAGEMENT_ZONE', geoReference: { kind: 'simulation' } });
    await expect(registry.registerZone(zone)).rejects.toThrow(/unknown field/);
  });

  it('a sensor deployment cannot reference an unknown sensor', async () => {
    const deployment = createSensorDeployment({ sensorId: 'sensor_does_not_exist', attachedTo: { kind: 'drone', id: 'drone_1' } });
    await expect(registry.registerSensorDeployment(deployment)).rejects.toThrow(/unknown sensor/);
  });

  it('a crop cycle cannot reference a nonexistent field', async () => {
    const cropCycle = createCropCycle({ fieldId: 'field_does_not_exist' });
    await expect(registry.registerCropCycle(cropCycle)).rejects.toThrow(/unknown field/);
  });

  it('an agricultural event cannot reference a nonexistent field', async () => {
    const event = createAgriculturalEvent({ fieldId: 'field_does_not_exist', type: 'MISSION_STARTED', description: 'x', source: 'SIMULATED' });
    await expect(registry.recordEvent(event)).rejects.toThrow(/unknown field/);
  });

  it('accepts the full valid chain: farm -> field -> zone -> sensor -> deployment', async () => {
    const farm = await registry.registerFarm(createFarm({ name: 'Demo Farm', geoReference: { kind: 'simulation' } }));
    const field = await registry.registerField(createField({ farmId: farm.id, name: 'Field 01', geoReference: { kind: 'simulation' } }));
    const zone = await registry.registerZone(createZone({ fieldId: field.id, name: 'Zone A', classification: 'SIMULATED_MANAGEMENT_ZONE', geoReference: { kind: 'simulation' } }));
    const sensor = await registry.registerSensor(
      createSensorRecord({ kind: 'gps', name: 'Simulated GNSS', platform: 'drone', capabilities: ['drone.position.local'], isSimulated: true })
    );
    const deployment = await registry.registerSensorDeployment(
      createSensorDeployment({ sensorId: sensor.id, attachedTo: { kind: 'zone', id: zone.id } })
    );

    expect(registry.listFieldsForFarm(farm.id)).toHaveLength(1);
    expect(registry.listZonesForField(field.id)).toHaveLength(1);
    expect(registry.listDeploymentsFor({ kind: 'zone', id: zone.id })).toEqual([deployment]);
  });
});
