import { describe, expect, it } from 'vitest';
import { SimulatedFlightController, UnimplementedRealHardwareDevice } from './HardwareInterface';

describe('SimulatedFlightController', () => {
  it('starts DISCONNECTED and only becomes CONNECTED via connect()', () => {
    const device = new SimulatedFlightController('fc_1', [{ kind: 'flight-controller', observationTypes: [] }]);
    expect(device.connectionState).toBe('DISCONNECTED');
    device.connect();
    expect(device.connectionState).toBe('CONNECTED');
    expect(device.provenance).toBe('SIMULATED');
  });

  it('rejects a command while disconnected', () => {
    const device = new SimulatedFlightController('fc_1', []);
    const result = device.sendCommand({ type: 'ARM', issuedAt: Date.now() });
    expect(result.accepted).toBe(false);
  });

  it('accepts a command once connected', () => {
    const device = new SimulatedFlightController('fc_1', []);
    device.connect();
    const result = device.sendCommand({ type: 'ARM', issuedAt: Date.now() });
    expect(result.accepted).toBe(true);
  });
});

describe('UnimplementedRealHardwareDevice', () => {
  it('never reaches CONNECTED — connect() always resolves to ERROR with a reason', () => {
    const device = new UnimplementedRealHardwareDevice('rgb_1', 'Real RGB Camera', [{ kind: 'rgb-camera', observationTypes: ['imagery.rgb'] }]);
    device.connect();
    expect(device.connectionState).toBe('ERROR');
    expect(device.lastError).toMatch(/No real hardware transport/);
    expect(device.provenance).toBe('REAL');
  });
});
