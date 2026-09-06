import { createMission, createWaypoint, type Mission } from './Mission';

/**
 * The one mission Phase 1 ships: the same 8-point survey loop the original
 * demo hardcoded directly into the drone's motion. Here it is data the
 * simulation engine executes, not the thing that owns the drone's motion.
 */
export function buildDefaultMission(): Mission {
  const raw: Array<[number, number, number]> = [
    [-34, 8, -22],
    [30, 9, -22],
    [30, 7, -8],
    [-34, 8, -8],
    [-34, 10, 8],
    [30, 8, 8],
    [30, 9, 22],
    [-34, 8, 22]
  ];

  const waypoints = raw.map(([x, y, z], index) =>
    createWaypoint({
      id: `wp_${index}`,
      position: { x, y, z },
      altitude: y,
      speedTarget: 8.3,
      action: 'scan'
    })
  );

  return createMission({
    id: 'mission_default_survey_loop',
    name: 'Default Survey Loop',
    waypoints,
    loop: true
  });
}
