import { describe, expect, it } from 'vitest';
import { WorldRegistry } from './WorldRegistry';
import { ensureDemoWorld } from './demoWorld';
import { createInMemoryRepositories } from '../persistence/repositories';
import { TelemetryGenerator } from '../telemetry/TelemetryGenerator';

describe('ensureDemoWorld', () => {
  it('creates Demo Farm -> Field 01 -> Zone A / Zone B with a simulated drone and sensors', async () => {
    const registry = await WorldRegistry.load(createInMemoryRepositories());
    const ids = await ensureDemoWorld(registry, new TelemetryGenerator());

    const farm = registry.getFarm(ids.farmId)!;
    expect(farm.name).toBe('Demo Farm');
    expect(farm.geoReference).toEqual({ kind: 'simulation' });

    const field = registry.getField(ids.fieldId)!;
    expect(field.farmId).toBe(farm.id);
    expect(field.geoReference.kind).toBe('geodetic');
    if (field.geoReference.kind === 'geodetic') {
      expect(field.geoReference.provenance).toBe('DEMO_ONLY');
      expect(field.geoReference.crs).toBe('EPSG:4326');
    }
    expect(field.areaHectares).toBeGreaterThan(0);

    const zones = registry.listZonesForField(field.id);
    expect(zones.map((z) => z.name).sort()).toEqual(['Zone A', 'Zone B']);
    expect(zones.every((z) => z.classification === 'SIMULATED_MANAGEMENT_ZONE')).toBe(true);
    expect(zones.every((z) => z.geoReference.kind === 'geodetic')).toBe(true);

    const sensors = registry.listSensors();
    expect(sensors.length).toBe(4);
    for (const sensor of sensors) {
      expect(registry.listDeploymentsFor({ kind: 'drone', id: ids.droneId })).toContainEqual(
        expect.objectContaining({ sensorId: sensor.id })
      );
    }
  });

  it('is idempotent — running twice does not duplicate the demo farm', async () => {
    const repositories = createInMemoryRepositories();
    const registry1 = await WorldRegistry.load(repositories);
    const first = await ensureDemoWorld(registry1, new TelemetryGenerator());

    const registry2 = await WorldRegistry.load(repositories); // simulate a reload
    const second = await ensureDemoWorld(registry2, new TelemetryGenerator());

    expect(second.farmId).toBe(first.farmId);
    expect(second.fieldId).toBe(first.fieldId);
    expect(registry2.listFarms()).toHaveLength(1);
  });
});
