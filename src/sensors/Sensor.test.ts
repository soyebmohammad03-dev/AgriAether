import { describe, expect, it } from 'vitest';
import { assertSensorCapable } from './Sensor';

describe('assertSensorCapable', () => {
  it('allows an observation type the sensor declares', () => {
    expect(() => assertSensorCapable({ id: 's1', capabilities: ['drone.position.local'] }, 'drone.position.local')).not.toThrow();
  });

  it('rejects an observation type outside the sensor\'s declared capabilities', () => {
    expect(() => assertSensorCapable({ id: 'rgb-cam-1', capabilities: ['imagery.rgb'] }, 'soil.nitrogen')).toThrow(
      /only declares capabilities/
    );
  });
});
