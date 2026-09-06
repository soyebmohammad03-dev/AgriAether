# AgriAether

AgriAether is an early-stage, open-source foundation for an agricultural
intelligence, simulation, digital-twin, and autonomous field-operations
platform. This repository is not yet that platform — it is currently a
**simulation core with a Farm/Field/Zone/Sensor domain model**: a 3D drone
flight simulator whose telemetry flows through a typed, provenance-tagged
Observation pipeline into a small persisted world, and nothing more.

## Project status (be skeptical of anything that sounds bigger than this)

**Implemented and real, within the simulation:**
- A modular TypeScript/Vite/Three.js application (no CDN globals, real build).
- A typed `DroneState` model with documented units, an explicit flight state
  machine (`IDLE → ARMING → TAKEOFF → MISSION → …`), and a `Mission`/
  `Waypoint` model executed by a `SimulationEngine` — the renderer only
  visualizes the mission, it never owns the drone's motion.
- A generic `Observation` model with mandatory provenance
  (`MEASURED | SIMULATED | ESTIMATED | PREDICTED | USER_REPORTED | EXTERNAL | UNKNOWN`),
  optional Farm/Field/Zone/Sensor/Mission/Drone linkage, and a validator that
  rejects a simulated source ever claiming `MEASURED`.
- A `Sensor` interface, each implementation declaring the exact Observation
  types it may produce (`capabilities`), enforced by `assertSensorCapable` —
  the mechanism that keeps a claim like "RGB camera → soil NPK" structurally
  impossible without an explicit, separately-validated estimation model.
- Four simulated sensors feeding a `TelemetryGenerator`: GPS (local-frame
  position with synthetic jitter and a simulated 5Hz update rate), IMU
  (orientation with synthetic noise), a barometer (models the real
  pressure→altitude relationship via the standard-atmosphere formula, then
  adds pressure noise, rather than reading position directly), and battery
  (documented linear draw-rate model, `src/simulation/BatteryModel.ts`).
- A **Farm → Field → Zone** domain model (`src/domain/`), a **SensorRecord /
  SensorDeployment** registry distinct from the runtime `Sensor` (data vs.
  behavior), a **CropCycle** model that defaults every agronomic fact to
  `UNKNOWN` rather than guessing, and an **AgriculturalEvent** log.
- A `WorldRegistry` (`src/world/`) that is the single place a Farm/Field/
  Zone/Sensor graph is assembled — every registration validates the
  reference it depends on and rejects the write if it doesn't exist yet
  (a Zone cannot reference a nonexistent Field, a SensorDeployment cannot
  reference a nonexistent Sensor, etc).
- A `Repository<T>` persistence interface with an `IndexedDbRepository`
  (real browser persistence — see "Persistence," below) and an
  `InMemoryRepository` (used in tests and as a non-browser fallback). One
  small, explicitly-labeled demonstration world (`src/world/demoWorld.ts`)
  is seeded once and reused on reload.
- A developer-facing Observation Inspector (the "Inspector" button) listing
  the last few generated Observations with every field — type, value, unit,
  source, provenance, confidence, and Farm/Field/Zone/Sensor/Mission/Drone
  linkage — so the pipeline can be checked directly instead of trusted.

**Explicitly NOT implemented — do not assume otherwise:**
- No real hardware, no real sensors, no real GPS. "Position" in this
  codebase means meters in the simulation's local scene frame
  (`GeoReference: { kind: 'simulation' }`), not a geodetic coordinate. A real
  CRS is later-phase work.
- No agricultural intelligence: no NDVI, soil moisture, pest detection, or
  canopy temperature. The UI's "Data Layers" panel says so explicitly rather
  than showing a number — those quantities require ground probes,
  multispectral/thermal sensors, or trained CV models that do not exist in
  this codebase yet.
- No real farm, field boundary, or crop — the seeded "Demo Farm › Field 01 ›
  Zone A/B" is a labeled fixture (`SIMULATED_MANAGEMENT_ZONE`), not GIS data.
- No autonomy beyond a fixed, pre-authored survey-loop mission.
- No server backend, no cloud sync — persistence is local-only (IndexedDB).
- No fleet management or multi-drone coordination; one demo drone exists as
  an id referenced by sensor deployments, not yet a first-class entity.

## Why "provenance" is the load-bearing idea here

An earlier prototype version of this project displayed NDVI, crop health,
soil moisture, pest risk, and canopy temperature as if they were sensor
readings. They were `Math.sin(time)`. That is the single failure mode this
codebase is now built to make structurally impossible: every value that
reaches the UI is an `Observation` with an explicit `provenance` field, tied
to a `Sensor` that can only produce Observation types it declares capability
for, tied to a `WorldRegistry` that refuses to link an Observation to a
Farm/Field/Zone that doesn't exist. If a real capability doesn't exist yet,
the correct behavior is to say so — see the "Data Layers" panel — never to
fabricate a number.

## Persistence

`Repository<T>` (`src/persistence/Repository.ts`) is the one storage
contract the domain layer depends on — nothing in `domain/`, `world/`, or
`app/` imports IndexedDB directly. Two implementations exist:

- **IndexedDbRepository** — the real, browser-native store used by the app.
  Chosen over a single `localStorage` JSON blob (synchronous, would block
  the render loop, far smaller quota, no per-entity granularity) and over
  SQLite-via-WASM (real SQL and an easier future server migration, but a
  WASM asset and a heavier dependency for a need IndexedDB already meets).
  It's async (fine for a 60fps loop), structured, and works fully offline.
- **InMemoryRepository** — a trivial Map-backed implementation used in tests
  (no IndexedDB under Vitest's node environment) and as a fallback.

Domain entities (Farm/Field/Zone/CropCycle/Sensor/SensorDeployment/
AgriculturalEvent) are persisted on write. Observations are not persisted on
every tick — that would be 60Hz of writes for a demo with no consumer of
that history yet — a sample is persisted every 2 seconds
(`OBSERVATION_PERSIST_INTERVAL_MS` in `src/app/App.ts`) while the last 200
stay in an in-memory ring buffer for the live Inspector panel.

**Offline-first direction (not yet built):** the plan is a
`SyncingRepository<T>` that wraps a local repository with a sync queue and
conflict resolution against a future server, implementing the same
`Repository<T>` interface — so when a backend arrives, no domain code
changes, only which repository implementation `persistence/repositories.ts`
constructs.

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
  app/          App.ts — async factory loads/seeds the world, then owns the render loop
  scene/        Renderer, lights, terrain, flight-path visualization
  drone/        DroneState (typed), DroneModel (3D mesh + cosmetic animation),
                FlightStateMachine
  cameras/      Orbit / Follow / Top-down / FPV camera rig
  mission/      Mission + Waypoint model, the default survey-loop mission
  simulation/   SimulationEngine (executes missions, advances DroneState),
                BatteryModel
  observation/  The Observation type + provenance invariants — the core
                scientific-honesty boundary
  sensors/      Sensor interface + capability guard + simulated GPS/IMU/
                barometer/battery sensors
  telemetry/    TelemetryGenerator — the only place DroneState becomes
                Observations
  domain/       Farm, Field, Zone, Crop, SensorRecord, SensorDeployment,
                AgriculturalEvent, GeoReference — plain data + factories,
                no persistence or UI knowledge
  world/        WorldRegistry (referential-integrity index + lookups),
                demoWorld.ts (the one seeded fixture)
  persistence/  Repository<T> interface, InMemoryRepository,
                IndexedDbRepository, repositories.ts factory
  ui/           Hud, Minimap, WorldPanel, DataInspector — render domain
                state/Observations, compute nothing
```

Data flow, and the boundary that must never be crossed:

```
WorldRegistry (Farm/Field/Zone/Sensor, validated + persisted)
        ↓
SimulationEngine (DroneState)
        ↓
TelemetryGenerator + Sensor.capabilities  →  Observation[]  (provenance: SIMULATED, tagged with farmId/fieldId/missionId/droneId/sensorId)
        ↓
ObservationLog (recent, in-memory) ──┬──→ Hud / Minimap / DataInspector (render only)
                                     └──→ Repository<Observation> (sampled, persisted)
```

The renderer never owns agricultural state. The UI never invents a number.
A future real hardware gateway is meant to implement the same `Sensor`
interface and slot into the same pipeline without the UI changing at all.

## Roadmap (see the Phase 0 audit for full detail)

1. ~~Solid simulation core~~ — Phase 1.
2. ~~Field + sensor model~~ — this repository, Phase 2: Farm/Field/Zone
   entity graph, sensor registry + capability model, first persistence
   layer.
3. Real data pipeline + geospatial base — Postgres/PostGIS, a real CRS
   replacing the local simulation frame, first external data source.
4. Crop/soil analytics + richer digital twin — first scoped ML model,
   behind a model registry, with stated confidence.
5. Autonomous missions + AI decision engine — coverage planning, temporal
   comparison across flights, sensor fusion with preserved uncertainty.
6. Real hardware + community platform — first real flight-controller/sensor
   integration behind the `Sensor`/drone abstractions proven here; open
   datasets and plugin contributions.

Phase 3 is not started and requires separate approval before work begins.
