import { createId } from '../domain/id';

export type EdgeInferenceStatus = 'RESULT' | 'NOT_AVAILABLE';

export interface EdgeInferenceRequest {
  id: string;
  /** The Observation this inference would run on — never re-measured, only referenced. */
  sensorInputObservationId: string;
  modelId: string;
  modelVersion: string;
  requestedAt: number;
}

export interface EdgeInferenceResult {
  id: string;
  requestId: string;
  status: EdgeInferenceStatus;
  value: number | null;
  confidence: number | null;
  latencyMs: number;
  resourceProfile: { device: string; provenance: 'SIMULATED' | 'REAL' };
  reason: string | null;
  computedAt: number;
}

export interface EdgeDevice {
  id: string;
  provenance: 'SIMULATED' | 'REAL';
  runInference(request: Pick<EdgeInferenceRequest, 'sensorInputObservationId' | 'modelId' | 'modelVersion'>): EdgeInferenceResult;
}

/**
 * The only EdgeDevice implementation this repository has — a simulated
 * onboard device standing in for future real edge hardware. It never
 * fabricates an inference result: no model in ModelRegistry is DEPLOYED
 * (see sensing/ModelRegistry.ts), so every request returns NOT_AVAILABLE
 * with a stated reason. What it does do honestly is exercise the real
 * plumbing — a timed request/response round trip with provenance-tagged
 * resource metadata — so a genuine onboard runtime has a contract to
 * implement later instead of one invented under deadline pressure.
 */
export class SimulatedEdgeDevice implements EdgeDevice {
  readonly provenance = 'SIMULATED' as const;

  constructor(readonly id: string = createId('edge_device')) {}

  runInference(request: Pick<EdgeInferenceRequest, 'sensorInputObservationId' | 'modelId' | 'modelVersion'>): EdgeInferenceResult {
    const start = performance.now();
    const fullRequest: EdgeInferenceRequest = { ...request, id: createId('edge_request'), requestedAt: Date.now() };
    const latencyMs = performance.now() - start;
    return {
      id: createId('edge_result'),
      requestId: fullRequest.id,
      status: 'NOT_AVAILABLE',
      value: null,
      confidence: null,
      latencyMs,
      resourceProfile: { device: this.id, provenance: this.provenance },
      reason: `Model "${request.modelId}"@${request.modelVersion} is not DEPLOYED — no onboard inference implementation exists yet.`,
      computedAt: Date.now()
    };
  }
}
