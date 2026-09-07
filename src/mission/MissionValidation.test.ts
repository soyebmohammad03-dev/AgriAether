import { describe, expect, it } from 'vitest';
import { validateMissionPlan } from './MissionValidation';
import { planAgriculturalMission } from './AgriculturalMission';
import { buildDemoFieldBoundary } from '../geo/demoGeometry';

describe('validateMissionPlan', () => {
  it('fails when the plan has no executable mission', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference: { kind: 'simulation' } });
    const result = validateMissionPlan(plan, ['rgb-camera']);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('fails when a required sensor kind is not available, even with a valid waypoint path', () => {
    const plan = planAgriculturalMission({
      fieldId: 'f',
      objective: 'VEGETATION_SURVEY',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' }
    });
    const result = validateMissionPlan(plan, ['rgb-camera']);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/multispectral-camera/);
  });

  it('passes when the mission exists and all required sensors are available', () => {
    const plan = planAgriculturalMission({
      fieldId: 'f',
      objective: 'FIELD_SURVEY',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' }
    });
    const result = validateMissionPlan(plan, ['rgb-camera']);
    expect(result.valid).toBe(true);
  });
});
