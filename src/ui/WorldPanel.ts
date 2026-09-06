import type { Farm } from '../domain/Farm';
import type { Field } from '../domain/Field';
import type { SensorRecord } from '../domain/SensorRecord';
import type { SensorHealthReport } from '../sensing/SensorHealth';

/**
 * Renders the static Farm › Field breadcrumb and sensor list under the
 * logo. The breadcrumb is set once after the demo world is seeded; sensor
 * health is refreshed periodically (see App.ts) since it depends on recent
 * observations, not just static registry data.
 */
export class WorldPanel {
  private readonly breadcrumb = document.getElementById('worldBreadcrumb');
  private readonly sensorList = document.getElementById('worldSensorList');

  renderBreadcrumb(farm: Farm, field: Field, droneLabel: string): void {
    if (this.breadcrumb) {
      this.breadcrumb.textContent = `${farm.name} › ${field.name} · ${droneLabel}`;
    }
  }

  renderSensorHealth(sensors: SensorRecord[], health: SensorHealthReport[]): void {
    if (!this.sensorList) return;
    const healthBySensorId = new Map(health.map((h) => [h.sensorId, h]));
    this.sensorList.textContent = sensors
      .map((s) => {
        const report = healthBySensorId.get(s.id);
        const suffix = report ? ` (${report.isSimulated ? 'SIMULATED · ' : ''}${report.status})` : '';
        return `${s.name}${suffix}`;
      })
      .join(' · ');
  }
}
