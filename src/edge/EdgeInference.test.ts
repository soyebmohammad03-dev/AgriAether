import { describe, expect, it } from 'vitest';
import { SimulatedEdgeDevice } from './EdgeInference';

describe('SimulatedEdgeDevice', () => {
  it('never fabricates an inference value — always NOT_AVAILABLE with a reason today', () => {
    const device = new SimulatedEdgeDevice('edge_1');
    const result = device.runInference({ sensorInputObservationId: 'obs_1', modelId: 'model_1', modelVersion: '1.0' });
    expect(result.status).toBe('NOT_AVAILABLE');
    expect(result.value).toBeNull();
    expect(result.reason).toMatch(/not DEPLOYED/);
    expect(result.resourceProfile.provenance).toBe('SIMULATED');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
