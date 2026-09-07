import type { Observation } from '../observation/Observation';

/** Keeps the last `capacity` Observations in memory for live inspection — not persisted, just a rolling debug buffer. */
export class ObservationLog {
  private readonly buffer: Observation<unknown>[] = [];

  constructor(private readonly capacity = 200) {}

  push(observation: Observation<unknown>): void {
    this.buffer.push(observation);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  recent(count: number): Observation<unknown>[] {
    return this.buffer.slice(-count).reverse();
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number') return value.toFixed(3);
  return String(value);
}

/**
 * A developer-facing panel listing recent Observations with every field —
 * the mechanism for verifying the data pipeline actually works, instead of
 * a decorative dashboard. Closed by default; only re-renders while open.
 */
export class DataInspector {
  private readonly panel = document.getElementById('dataInspector');
  private readonly list = document.getElementById('dataInspectorList');
  private open = false;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(log: ObservationLog): void {
    if (!this.open || !this.list) return;
    const rows = log.recent(8);
    this.list.innerHTML = rows
      .map((obs) => {
        const context = [
          obs.farmId ? `farm:${obs.farmId}` : null,
          obs.fieldId ? `field:${obs.fieldId}` : null,
          obs.zoneId ? `zone:${obs.zoneId}` : null,
          obs.sensorId ? `sensor:${obs.sensorId}` : null,
          obs.missionId ? `mission:${obs.missionId}` : null,
          obs.droneId ? `drone:${obs.droneId}` : null
        ]
          .filter(Boolean)
          .join(' ') || 'none';
        const location =
          obs.location === null
            ? 'unlocated'
            : obs.location.frame === 'geodetic'
              ? `${obs.location.lat.toFixed(5)},${obs.location.lon.toFixed(5)} (WGS84)`
              : `${obs.location.x.toFixed(1)},${obs.location.y.toFixed(1)},${obs.location.z.toFixed(1)} (sim-local)`;
        const quality = typeof obs.metadata?.dataQuality === 'string' ? obs.metadata.dataQuality : 'n/a';
        return [
          `<div class="inspector-row">`,
          `<span class="inspector-type">${obs.type}</span>`,
          `<span class="inspector-provenance">${obs.provenance}</span>`,
          `<span>value=${formatValue(obs.value)}${obs.unit ? ' ' + obs.unit : ''}</span>`,
          `<span>when=${new Date(obs.timestamp).toLocaleTimeString()}</span>`,
          `<span>where=${location}</span>`,
          `<span>source=${obs.source}</span>`,
          `<span>confidence=${obs.confidence ?? 'n/a'}</span>`,
          `<span>quality=${quality}</span>`,
          `<span>status=${obs.status}</span>`,
          `<span class="inspector-context">${context}</span>`,
          `</div>`
        ].join('');
      })
      .join('');
  }
}
