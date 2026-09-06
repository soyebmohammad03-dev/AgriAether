import { describe, expect, it } from 'vitest';
import { BatteryModel, BATTERY_CRITICAL_THRESHOLD_PERCENT } from './BatteryModel';

describe('BatteryModel', () => {
  it('drains faster in MISSION than in IDLE over the same duration', () => {
    const inMission = new BatteryModel(100);
    const idle = new BatteryModel(100);
    inMission.tick(100, 'MISSION');
    idle.tick(100, 'IDLE');
    expect(inMission.percent).toBeLessThan(idle.percent);
  });

  it('never drains below 0', () => {
    const battery = new BatteryModel(1);
    battery.tick(10_000, 'MISSION');
    expect(battery.percent).toBe(0);
  });

  it('never exceeds 100 from the initial clamp', () => {
    const battery = new BatteryModel(150);
    expect(battery.percent).toBe(100);
  });

  it('reports critical at/below the documented threshold', () => {
    const battery = new BatteryModel(BATTERY_CRITICAL_THRESHOLD_PERCENT);
    expect(battery.critical).toBe(true);
    const healthy = new BatteryModel(BATTERY_CRITICAL_THRESHOLD_PERCENT + 1);
    expect(healthy.critical).toBe(false);
  });

  it('does not drain while LANDED', () => {
    const battery = new BatteryModel(50);
    battery.tick(500, 'LANDED');
    expect(battery.percent).toBe(50);
  });
});
