import { describe, expect, it } from 'vitest';
import { planAgriculturalMission } from './AgriculturalMission';
import { buildDemoFieldBoundary } from '../geo/demoGeometry';

describe('planAgriculturalMission', () => {
  it('returns mission: null with an explicit limitation when no polygon geometry exists', () => {
    const plan = planAgriculturalMission({ fieldId: 'f', objective: 'FIELD_SURVEY', geoReference: { kind: 'simulation' } });
    expect(plan.mission).toBeNull();
    expect(plan.provenance).toBe('UNAVAILABLE');
    expect(plan.limitations.length).toBeGreaterThan(0);
  });

  it('returns mission: null for non-DEMO_ONLY geodetic provenance rather than fabricating a local frame', () => {
    const plan = planAgriculturalMission({
      fieldId: 'f',
      objective: 'FIELD_SURVEY',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: buildDemoFieldBoundary(), provenance: 'SURVEYED' }
    });
    expect(plan.mission).toBeNull();
    expect(plan.limitations.some((l) => l.includes('SURVEYED'))).toBe(true);
  });

  it('generates a real waypoint path clipped to the DEMO_ONLY field boundary', () => {
    const plan = planAgriculturalMission({
      fieldId: 'f',
      objective: 'VEGETATION_SURVEY',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' }
    });
    expect(plan.mission).not.toBeNull();
    expect(plan.provenance).toBe('PLANNED_FROM_DEMO_GEOMETRY');
    expect(plan.requiredSensorKinds).toContain('multispectral-camera');
    for (const wp of plan.mission!.waypoints) {
      expect(wp.geoPosition).not.toBeNull();
    }
  });

  it('rejects an unsafe altitude before generating any waypoints', () => {
    const plan = planAgriculturalMission({
      fieldId: 'f',
      objective: 'FIELD_SURVEY',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: buildDemoFieldBoundary(), provenance: 'DEMO_ONLY' },
      altitudeM: 500
    });
    expect(plan.mission).toBeNull();
    expect(plan.limitations.some((l) => l.includes('altitude'))).toBe(true);
  });
});
