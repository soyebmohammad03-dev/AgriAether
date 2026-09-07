import { describe, expect, it } from 'vitest';
import { KnowledgeGraph } from './KnowledgeGraph';
import { WorldRegistry } from '../world/WorldRegistry';
import { createInMemoryRepositories } from '../persistence/repositories';
import { createFarm } from '../domain/Farm';
import { createField } from '../domain/Field';
import { createZone } from '../domain/Zone';
import { createSensorRecord } from '../domain/SensorRecord';
import { createSensorDeployment } from '../domain/SensorDeployment';
import type { Observation } from '../observation/Observation';

async function seededWorld() {
  const registry = await WorldRegistry.load(createInMemoryRepositories());
  const farm = await registry.registerFarm(createFarm({ name: 'Farm 01', geoReference: { kind: 'simulation' } }));
  const field = await registry.registerField(createField({ farmId: farm.id, name: 'Field 01', geoReference: { kind: 'simulation' } }));
  const zone = await registry.registerZone(createZone({ fieldId: field.id, name: 'Zone A', classification: 'SIMULATED_MANAGEMENT_ZONE', geoReference: { kind: 'simulation' } }));
  const sensor = await registry.registerSensor(
    createSensorRecord({ kind: 'soil-moisture', name: 'Soil Probe', platform: 'ground', capabilities: ['soil.moisture'], isSimulated: true })
  );
  await registry.registerSensorDeployment(createSensorDeployment({ sensorId: sensor.id, attachedTo: { kind: 'zone', id: zone.id } }));
  return { registry, farm, field, zone, sensor };
}

describe('KnowledgeGraph.build', () => {
  it('links Farm -> Field -> Zone -> Sensor exactly as registered, with stable ids', async () => {
    const { registry, farm, field, zone, sensor } = await seededWorld();
    const graph = KnowledgeGraph.build(registry, []);

    expect(graph.getNode(`Field:${field.id}`)?.type).toBe('Field');
    const farmNeighbors = graph.neighbors(`Farm:${farm.id}`);
    expect(farmNeighbors.some((e) => e.to === `Field:${field.id}` && e.type === 'HAS_FIELD')).toBe(true);

    const zoneNeighbors = graph.neighbors(`Zone:${zone.id}`);
    expect(zoneNeighbors.some((e) => e.from === `Sensor:${sensor.id}` && e.type === 'DEPLOYED_ON')).toBe(true);
  });

  it('reaches an Observation attached to a zone via evidenceFor traversal from the field', async () => {
    const { registry, field, zone } = await seededWorld();
    const observation: Observation<number> = {
      id: 'obs_1',
      type: 'soil.moisture',
      value: 20,
      unit: 'percent',
      timestamp: 1000,
      location: null,
      source: 'sim-sensor:soil',
      provenance: 'SIMULATED',
      confidence: 0.9,
      status: 'OK',
      fieldId: field.id,
      zoneId: zone.id
    };
    const graph = KnowledgeGraph.build(registry, [observation]);
    const evidence = graph.evidenceFor(`Field:${field.id}`);
    expect(evidence.some((n) => n.id === 'Observation:obs_1')).toBe(true);
  });
});
