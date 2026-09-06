import type { Farm } from '../domain/Farm';
import type { Field } from '../domain/Field';
import type { SensorRecord } from '../domain/SensorRecord';

/**
 * Renders the static Farm › Field breadcrumb and sensor list under the
 * logo. Set once after the demo world is seeded — none of this changes
 * frame to frame, so it isn't part of the render loop.
 */
export class WorldPanel {
  private readonly breadcrumb = document.getElementById('worldBreadcrumb');
  private readonly sensorList = document.getElementById('worldSensorList');

  render(farm: Farm, field: Field, droneLabel: string, sensors: SensorRecord[]): void {
    if (this.breadcrumb) {
      this.breadcrumb.textContent = `${farm.name} › ${field.name} · ${droneLabel}`;
    }
    if (this.sensorList) {
      this.sensorList.textContent = sensors.map((s) => s.name).join(' · ');
    }
  }
}
