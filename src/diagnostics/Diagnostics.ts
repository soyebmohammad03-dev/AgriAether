import { createId } from '../domain/id';

export type DiagnosticSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type DiagnosticCategory = 'IMPORT' | 'EXTERNAL_DATA' | 'ANALYSIS' | 'MISSION' | 'PERSISTENCE' | 'SYNC' | 'MODEL' | 'GENERAL';

export interface DiagnosticEvent {
  id: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  /** e.g. "openDatabase", "WeatherService.getCurrentWeather", "runCsvObservationImport" — the operation that produced this event. */
  operation: string;
  message: string;
  /** Groups events from one logical request/run (e.g. one import, one mission decision) — null when there is nothing to correlate. */
  correlationId: string | null;
  timestamp: number;
  /** Caller-supplied structured context — never put secrets, credentials, or raw file contents here; ids/counts/enum values only. */
  detail: Record<string, unknown> | null;
}

/**
 * A lightweight, in-memory, bounded diagnostics log — not a telemetry SaaS
 * integration, nothing leaves the browser. Exists so production debugging
 * ("why did this import/mission/sync fail") has one place to look instead
 * of scattered console.* calls, and so a failure state is distinguishable
 * from a legitimate EMPTY/UNSUPPORTED/INSUFFICIENT_DATA result — those are
 * never logged as errors here, only genuine failures are. Capped at
 * MAX_EVENTS (a ring buffer) so a long session can never leak memory.
 */
class DiagnosticsLog {
  private readonly events: DiagnosticEvent[] = [];
  private static readonly MAX_EVENTS = 500;

  log(params: { severity: DiagnosticSeverity; category: DiagnosticCategory; operation: string; message: string; correlationId?: string | null; detail?: Record<string, unknown> | null }): DiagnosticEvent {
    const event: DiagnosticEvent = {
      id: createId('diag'),
      severity: params.severity,
      category: params.category,
      operation: params.operation,
      message: params.message,
      correlationId: params.correlationId ?? null,
      timestamp: Date.now(),
      detail: params.detail ?? null
    };
    this.events.push(event);
    if (this.events.length > DiagnosticsLog.MAX_EVENTS) this.events.shift();
    return event;
  }

  recent(limit = 50): DiagnosticEvent[] {
    return this.events.slice(-limit).reverse();
  }

  byCategory(category: DiagnosticCategory, limit = 50): DiagnosticEvent[] {
    return this.events
      .filter((e) => e.category === category)
      .slice(-limit)
      .reverse();
  }

  /** Test-only: clear all buffered events so tests don't leak state into each other via the shared singleton. */
  clearForTests(): void {
    this.events.length = 0;
  }
}

export const diagnostics = new DiagnosticsLog();
