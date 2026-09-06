import { createId } from './id';

export type DeploymentTarget =
  | { kind: 'drone'; id: string }
  | { kind: 'field'; id: string }
  | { kind: 'zone'; id: string }
  | { kind: 'ground-station'; id: string };

/**
 * Where and how a physical (or simulated) sensor is currently mounted.
 * Separated from SensorRecord because the same sensor can move — a soil
 * probe pulled from one field and redeployed to another shouldn't need a
 * new sensor identity, just a new deployment record.
 */
export interface SensorDeployment {
  id: string;
  sensorId: string;
  attachedTo: DeploymentTarget;
  deployedAt: number;
  undeployedAt: number | null;
  status: 'ACTIVE' | 'RETIRED';
}

/**
 * sensorId is taken as given — the referential check (does this sensor
 * exist?) belongs to WorldRegistry, the one place with a loaded sensor
 * collection to check against.
 */
export function createSensorDeployment(params: {
  sensorId: string;
  attachedTo: DeploymentTarget;
  deployedAt?: number;
}): SensorDeployment {
  if (!params.sensorId) {
    throw new Error('SensorDeployment requires a sensorId');
  }
  return {
    id: createId('deployment'),
    sensorId: params.sensorId,
    attachedTo: params.attachedTo,
    deployedAt: params.deployedAt ?? Date.now(),
    undeployedAt: null,
    status: 'ACTIVE'
  };
}
