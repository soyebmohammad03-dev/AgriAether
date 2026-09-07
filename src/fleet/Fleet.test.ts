import { describe, expect, it } from 'vitest';
import { createFleetDrone, assignMission } from './Fleet';
import { planAgriculturalMission } from '../mission/AgriculturalMission';
import { buildDemoFieldBoundary } from '../geo/demoGeometry';

const demoGeoReference = { kind: 'geodetic' as const, crs: 'EPSG:4326' as const, geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' as const };

describe('assignMission', () => {
  it('never assigns a mission with no executable waypoint path', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference: { kind: 'simulation' } });
    const drone = createFleetDrone({ name: 'D1', capabilities: ['rgb-camera'], provenance: 'SIMULATED' });
    const result = assignMission({ drones: [drone], plan });
    expect(result.assignedDroneId).toBeNull();
    expect(result.reason).toBe('MISSION_NOT_EXECUTABLE');
  });

  it('never assigns a drone lacking a required capability', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'VEGETATION_SURVEY', geoReference: demoGeoReference });
    const drone = createFleetDrone({ name: 'D1', capabilities: ['rgb-camera'], provenance: 'SIMULATED' });
    const result = assignMission({ drones: [drone], plan });
    expect(result.assignedDroneId).toBeNull();
    expect(result.reason).toBe('NO_CAPABLE_DRONE');
  });

  it('assigns the capable AVAILABLE drone deterministically', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference: demoGeoReference });
    const drone = createFleetDrone({ name: 'D1', capabilities: ['rgb-camera'], provenance: 'SIMULATED' });
    const result = assignMission({ drones: [drone], plan });
    expect(result.assignedDroneId).toBe(drone.id);
  });

  it('never assigns a drone already ON_MISSION — the conflict check', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference: demoGeoReference });
    const busy = createFleetDrone({ name: 'D1', capabilities: ['rgb-camera'], provenance: 'SIMULATED', status: 'ON_MISSION' });
    const result = assignMission({ drones: [busy], plan });
    expect(result.assignedDroneId).toBeNull();
    expect(result.reason).toBe('NO_AVAILABLE_DRONE');
  });

  it('never assigns a drone below the battery floor', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference: demoGeoReference });
    const lowBattery = createFleetDrone({ name: 'D1', capabilities: ['rgb-camera'], provenance: 'SIMULATED', batteryStateOfCharge: 5 });
    const result = assignMission({ drones: [lowBattery], plan });
    expect(result.assignedDroneId).toBeNull();
  });
});
