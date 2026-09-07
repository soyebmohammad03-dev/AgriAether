import type { SensorKind } from '../domain/SensorRecord';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
export type HardwareProvenance = 'SIMULATED' | 'REAL';

export interface HardwareCapability {
  kind: SensorKind | 'flight-controller';
  observationTypes: readonly string[];
}

export interface HardwareDevice {
  id: string;
  name: string;
  provenance: HardwareProvenance;
  connectionState: ConnectionState;
  capabilities: readonly HardwareCapability[];
  lastError: string | null;
}

export interface HardwareCommand {
  type: string;
  issuedAt: number;
}

export interface CommandResult {
  accepted: boolean;
  reason: string | null;
}

/**
 * The one contract every hardware device (simulated or, eventually, real)
 * implements — flight controller, GPS, IMU, barometer, camera/payload,
 * soil/environmental sensor. `connect()`/`disconnect()` are the only way
 * `connectionState` changes: nothing here ever flips a device to CONNECTED
 * as a side effect of construction or a getter, and a failed connect always
 * leaves `lastError` set rather than silently staying DISCONNECTED.
 */
export abstract class HardwareInterfaceBase implements HardwareDevice {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly provenance: HardwareProvenance;
  abstract readonly capabilities: readonly HardwareCapability[];
  connectionState: ConnectionState = 'DISCONNECTED';
  lastError: string | null = null;

  abstract connect(): void;
  abstract disconnect(): void;

  /** Command dispatch is only ever accepted while CONNECTED — never queued against a device that isn't. */
  sendCommand(command: HardwareCommand): CommandResult {
    if (this.connectionState !== 'CONNECTED') {
      return { accepted: false, reason: `Device "${this.id}" is ${this.connectionState}, not CONNECTED — command "${command.type}" rejected.` };
    }
    return { accepted: true, reason: null };
  }
}

/**
 * A real-hardware device this repository has no transport for — no serial,
 * USB, or network integration exists. `connect()` always resolves to ERROR
 * with an explicit reason; this class can never report CONNECTED. Exists so
 * the interface a real integration would implement is documented now,
 * without pretending any hardware is actually reachable.
 */
export class UnimplementedRealHardwareDevice extends HardwareInterfaceBase {
  readonly provenance = 'REAL' as const;

  constructor(
    readonly id: string,
    readonly name: string,
    readonly capabilities: readonly HardwareCapability[]
  ) {
    super();
  }

  connect(): void {
    this.connectionState = 'ERROR';
    this.lastError = `No real hardware transport is implemented for "${this.name}" — this device can never report CONNECTED.`;
  }

  disconnect(): void {
    this.connectionState = 'DISCONNECTED';
    this.lastError = null;
  }
}

/**
 * Wraps this codebase's existing simulated drone (FlightStateMachine +
 * SimulationEngine) as a HardwareDevice — SIMULATED, connects
 * deterministically because there is no real transport latency to model.
 * Never reports provenance REAL.
 */
export class SimulatedFlightController extends HardwareInterfaceBase {
  readonly name = 'Simulated Flight Controller';
  readonly provenance = 'SIMULATED' as const;

  constructor(
    readonly id: string,
    readonly capabilities: readonly HardwareCapability[]
  ) {
    super();
  }

  connect(): void {
    this.connectionState = 'CONNECTED';
    this.lastError = null;
  }

  disconnect(): void {
    this.connectionState = 'DISCONNECTED';
  }
}
