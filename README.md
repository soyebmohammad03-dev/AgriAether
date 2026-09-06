# AgriAether

AgriAether is an early-stage, open-source foundation for an agricultural
intelligence, simulation, digital-twin, and autonomous field-operations
platform. This repository is not yet that platform — it is currently a
**simulation core**: a 3D drone flight simulator with a typed state model and
an explicit provenance system, and nothing more.

## Project status (be skeptical of anything that sounds bigger than this)

**Implemented and real, within the simulation:**
- A modular TypeScript/Vite/Three.js application (no CDN globals, real build).
- A typed `DroneState` model with documented units (`src/drone/DroneState.ts`).
- An explicit flight state machine (`IDLE → ARMING → TAKEOFF → MISSION → …`).
- A `Mission`/`Waypoint` model, executed by a `SimulationEngine` — the
  renderer only visualizes the mission, it does not own the drone's motion.
- A generic `Observation` model with mandatory provenance
  (`MEASURED | SIMULATED | ESTIMATED | PREDICTED | USER_REPORTED | EXTERNAL | UNKNOWN`)
  and a validator that rejects, for example, a simulated source claiming to
  be `MEASURED`.
- A `Sensor` interface with four **simulated** sensors (GPS-in-local-frame,
  IMU, barometer, battery) feeding a `TelemetryGenerator` — the one place
  simulation state becomes Observations.
- A documented, clearly-simulated battery model (linear draw rate per flight
  state — not a physical discharge curve; see `src/simulation/BatteryModel.ts`).

**Explicitly NOT implemented — do not assume otherwise:**
- No real hardware, no real sensors, no real GPS. "Position" in this
  codebase means meters in the simulation's local scene frame, not a
  geodetic coordinate.
- No agricultural intelligence: no NDVI, soil moisture, pest detection, or
  canopy temperature. The UI's "Data Layers" panel says so explicitly rather
  than showing a number — those quantities require ground probes,
  multispectral/thermal sensors, or trained CV models that do not exist in
  this codebase yet.
- No autonomy beyond a fixed, pre-authored survey-loop mission.
- No backend, no database, no persistence — state resets on page reload.
- No fleet management, multi-drone coordination, or real-time coverage
  planning.

## Why "provenance" is the load-bearing idea here

An earlier prototype version of this project displayed NDVI, crop health,
soil moisture, pest risk, and canopy temperature as if they were sensor
readings. They were `Math.sin(time)`. That is the single failure mode this
codebase is now built to make structurally impossible: every value that
reaches the UI is an `Observation` with an explicit `provenance` field, and
`assertValidObservation` throws if a simulation-sourced value ever claims to
be `MEASURED`. If a real capability doesn't exist yet, the correct behavior
is to say so — see the "Data Layers" panel — never to fabricate a number.

## Local development

```bash
npm install
npm run dev        # start the Vite dev server
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run build      # typecheck + production build
```

## Architecture

```
src/
  app/          App.ts — wires everything together, owns the render loop
  scene/        Renderer, lights, terrain, flight-path visualization
  drone/        DroneState (typed), DroneModel (3D mesh + cosmetic animation),
                FlightStateMachine
  cameras/      Orbit / Follow / Top-down / FPV camera rig
  mission/      Mission + Waypoint model, the default survey-loop mission
  simulation/   SimulationEngine (executes missions, advances DroneState),
                BatteryModel
  observation/  The Observation type + provenance invariants — the core
                scientific-honesty boundary
  sensors/      Sensor interface + simulated GPS/IMU/barometer/battery sensors
  telemetry/    TelemetryGenerator — the only place DroneState becomes
                Observations
  ui/           Hud, Minimap — render Observations/DroneState, compute nothing
```

Data flow, and the boundary that must never be crossed:

```
SimulationEngine (DroneState)
        ↓
TelemetryGenerator  →  Observation[]  (provenance: SIMULATED)
        ↓
Hud / Minimap  (render only — never compute a scientific value)
```

The renderer never owns agricultural state. The UI never invents a number.
A future real hardware gateway is meant to implement the same `Sensor`
interface and slot in without the UI changing at all.

## Roadmap (see the Phase 0 audit for full detail)

1. ~~Solid simulation core~~ — this repository, Phase 1.
2. Field + sensor model — Farm/Field/Zone entity graph, pluggable ground
   sensors.
3. Real data pipeline + geospatial base — Postgres/PostGIS, a real CRS
   replacing the local simulation frame, first external data source.
4. Crop/soil analytics + persistent digital twin — first scoped ML model,
   behind a model registry, with stated confidence.
5. Autonomous missions + AI decision engine — coverage planning, temporal
   comparison across flights, sensor fusion with preserved uncertainty.
6. Real hardware + community platform — first real flight-controller/sensor
   integration behind the `Sensor`/drone abstractions proven here; open
   datasets and plugin contributions.

Phase 2 is not started and requires separate approval before work begins.
