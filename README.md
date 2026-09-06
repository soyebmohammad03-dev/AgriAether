# AgriAether

AgriAether is an early-stage, open-source foundation for an agricultural
intelligence, simulation, digital-twin, and autonomous field-operations
platform. This repository is not yet that platform — it is currently a
**simulation core with a Farm/Field/Zone/Sensor domain model, a demo
geospatial layer, and one real external data source (weather)**, and
nothing more.

## Project status (be skeptical of anything that sounds bigger than this)

**Implemented and real, within the simulation:**
- A modular TypeScript/Vite/Three.js application (no CDN globals, real build).
- A typed `DroneState` model with documented units, an explicit flight state
  machine (`IDLE → ARMING → TAKEOFF → MISSION → …`), and a `Mission`/
  `Waypoint` model executed by a `SimulationEngine` — the renderer only
  visualizes the mission, it never owns the drone's motion.
- A generic `Observation` model with mandatory provenance
  (`MEASURED | SIMULATED | ESTIMATED | PREDICTED | USER_REPORTED | EXTERNAL | UNKNOWN`),
  a location that is *either* simulation-local *or* geodetic (WGS84) —
  never silently one pretending to be the other — optional Farm/Field/Zone/
  Sensor/Mission/Drone linkage, and a validator that rejects a simulated
  source ever claiming `MEASURED`.
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
- A **geospatial foundation** (`src/geo/`): a `GeoReference` type that can
  express "exists only in the simulation," "genuinely unknown," or
  "geodetic, WGS84, with an honesty label" (`DEMO_ONLY | SURVEYED |
  USER_DRAWN | EXTERNAL`); a small geometry utility layer built on Turf.js
  (distance, point-in-polygon, bounding box, area, validation) rather than
  a hand-rolled GIS engine; and a `simulationLocalToDemoGeodetic` transform
  — explicitly labeled DEMO ONLY, not survey-grade — that is the only
  bridge between the 3D scene's coordinates and real-world ones.
- **One real external data source**: live weather from Open-Meteo, through
  a `WeatherProvider` abstraction (`RealWeatherProvider` = `OpenMeteoProvider`,
  plus a `MockWeatherProvider` for tests), a normalization/validation step,
  a `WeatherService` that caches results and degrades honestly (FRESH →
  CACHED → STALE → unavailable) when the network fails, and a conversion
  into the same canonical `Observation` records everything else uses —
  always `provenance: 'EXTERNAL'`, `source: 'external:open-meteo'`, never
  attributed to a sensor or the simulation.
- A `WorldRegistry` (`src/world/`) that is the single place a Farm/Field/
  Zone/Sensor graph is assembled — every registration validates the
  reference it depends on and rejects the write if it doesn't exist yet
  (a Zone cannot reference a nonexistent Field, a SensorDeployment cannot
  reference a nonexistent Sensor, etc).
- A `Repository<T>` persistence interface with an `IndexedDbRepository`
  (real browser persistence — see "Persistence," below) and an
  `InMemoryRepository` (used in tests and as a non-browser fallback). One
  small, explicitly-labeled demonstration world (`src/world/demoWorld.ts`),
  including a DEMO_ONLY field/zone boundary anchored at Null Island
  (0°N 0°E — the GIS convention for "not a real place"), is seeded once and
  reused on reload.
- Two developer-facing panels: the **Observation Inspector** (the
  "Inspector" button) listing recent Observations with every field — type,
  value, unit, source, provenance, confidence, and Farm/Field/Zone/Sensor/
  Mission/Drone linkage — and the **Geospatial View** (the "Geo View"
  button), a small canvas plot of the demo field/zone boundaries and the
  drone's demo-geodetic position, explicitly labeled DEMO_ONLY.

**Explicitly NOT implemented — do not assume otherwise:**
- No real hardware, no real sensors, no real GNSS fix. Every geodetic
  position in this codebase is either DEMO_ONLY (transformed from a
  simulated position, `provenance: 'ESTIMATED'`, confidence 0.3) or a
  weather provider's own location — never a real drone position.
- No real field boundary. The seeded "Demo Farm › Field 01 › Zone A/B" has
  DEMO_ONLY WGS84 geometry anchored at Null Island specifically so nobody
  mistakes it for a real place; a real projected/CRS pipeline for genuine
  survey data is future work.
- No agricultural intelligence: no NDVI, soil moisture, pest detection, or
  canopy temperature. The UI's "Data Layers" panel says so explicitly rather
  than showing a number — those quantities require ground probes,
  multispectral/thermal sensors, or trained CV models that do not exist in
  this codebase yet.
- No map basemap/tiles — see "Map/geospatial visualization" below for why.
- No ML, no AI-generated recommendations, no autonomous mission planning.
- No autonomy beyond a fixed, pre-authored survey-loop mission; its
  waypoints carry a `geoPosition` field for a future real/demo-anchored
  mission, left `null` today rather than guessed.
- No server backend, no cloud sync — persistence is local-only (IndexedDB).
  Weather is fetched directly from the browser because Open-Meteo needs no
  API key; a provider that did would need a backend proxy first (see
  "Security," below).
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
Farm/Field/Zone that doesn't exist, and — as of Phase 3 — tied to an
explicit coordinate frame that can never silently pretend a simulated
position is a real one, or a demo boundary is a real survey. If a real
capability doesn't exist yet, the correct behavior is to say so — see the
"Data Layers" panel — never to fabricate a number.

## Geospatial architecture

Three coordinate concepts exist, and the type system keeps them apart:

- **Simulation-local** (`frame: 'simulation-local'`) — meters, the 3D
  scene's own axes. What the drone's `DroneState.position` and the GPS/IMU/
  barometer sensors work in. Never a real-world position.
- **Geodetic / WGS84** (`frame: 'geodetic', crs: 'EPSG:4326'`) — real
  latitude/longitude. Used for the demo field/zone boundaries, the derived
  demo drone position, and all weather data.
- **DEMO_ONLY vs SURVEYED/USER_DRAWN/EXTERNAL** (`GeodeticProvenance`, on
  `GeoReference`) — *within* geodetic data, how honestly it was obtained.
  Every piece of geodetic geometry in this repository today is `DEMO_ONLY`.

`src/geo/georeference.ts` holds the only conversion between the two frames:
a documented flat-earth (equirectangular) approximation, explicitly labeled
DEMO ONLY and not survey-grade, valid to a few meters at the ~100m scale of
the demo field. It is the one bridge the roadmap's
`real GNSS → geographic coordinate → projection → local coordinate → 3D
visualization` pipeline calls for — the renderer itself never performs a
coordinate conversion; only `App.ts` calls into `geo/`.

Geometry uses plain GeoJSON (`Polygon`/`MultiPolygon`/`Point`, typed via
`@types/geojson`) rather than a bespoke shape, and `src/geo/geometry.ts`
wraps a handful of Turf.js primitives (distance, point-in-polygon, bounding
box, area, validation) rather than reimplementing spherical geometry. No
projected/local metric CRS (e.g. a per-farm UTM zone) is implemented —
Turf's spherical math is accurate enough at field scale; add a projection
only if a genuine need (e.g. planar CAD-style tooling) appears later.

**Map/geospatial visualization:** the "Geo View" panel is a plain canvas
plot of the demo geometry, not an interactive map with basemap tiles.
Evaluated and deliberately deferred: there is no real map-tile subscription
wired up, the only geometry that exists is Null-Island demo fixture data —
plotting that against a real street/satellite basemap would visually imply
a real location that doesn't exist — and the bundle-size/complexity of a
map library (Leaflet, MapLibre GL) isn't justified until real field
boundaries exist to show on it.

## Weather / external data pipeline

```
Open-Meteo (real, keyless HTTPS API)
        ↓
OpenMeteoProvider  (WeatherProvider interface — swappable)
        ↓
normalizeOpenMeteoResponse  →  WeatherObservation  (validated: plausible
        ↓                       ranges, not "normal weather" ranges —
        ↓                       extreme-but-real values are accepted)
WeatherService  (IndexedDB-backed cache: FRESH ≤15min → served without a
        ↓        network call; on provider failure, falls back to the cached
        ↓        reading marked CACHED, or STALE past 24h; returns null,
        ↓        never a fabricated reading, if there's no cache at all)
        ↓
weatherObservationToObservations  →  Observation[]  (provenance: EXTERNAL,
        ↓                             source: "external:open-meteo",
        ↓                             observedAt ≠ retrievedAt, kept distinct)
Repository<Observation> (persisted) + ObservationLog (Inspector)
        ↓
Hud's Weather panel / GeoView's weather marker
```

Weather is fetched for the demo field's single anchor point and explicitly
labeled "single external forecast point for the whole field — not
per-zone" in the UI; it is never used to infer crop health, and it never
feeds drone physics (no wind forces, no simulated storms) — it is
environmental context only. A provider failure never crashes the
simulator: `WeatherService.getCurrentWeather` catches provider errors
internally and the app's own call is additionally wrapped, so the 3D
simulation keeps running with the panel showing `UNAVAILABLE`.

**Why Open-Meteo:** evaluated against alternatives like OpenWeatherMap
specifically for whether they could be called safely from a pure frontend.
Open-Meteo's free tier is keyless, CC-BY licensed, and returns current/
forecast/historical data over plain HTTPS JSON — the key point being no
secret to leak. `.env.example` documents the pattern for a future provider
that *does* need a key, and says explicitly why one can't be used here yet.

## Security

Vite bundles any `VITE_`-prefixed environment variable straight into the
client-side build — visible to anyone who opens the app, not a real secret.
`OpenMeteoProvider` needs no credential, which is exactly why it was chosen
over a keyed alternative for Phase 3. A future provider that requires a
genuinely private API key **cannot** be called directly from this frontend
as it stands; it would need a small backend/proxy holding the key
server-side first. Don't add a keyed provider by pasting a key into a
`VITE_*` variable and calling it a day — that key would ship to every
visitor's browser.

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
  A `weatherCache` object store was added in Phase 3 (schema version 2) —
  the migration only adds missing stores, never touches existing data.
- **InMemoryRepository** — a trivial Map-backed implementation used in tests
  (no IndexedDB under Vitest's node environment) and as a fallback.

Domain entities (Farm/Field/Zone/CropCycle/Sensor/SensorDeployment/
AgriculturalEvent) are persisted on write. Observations are not persisted on
every tick — that would be 60Hz of writes for a demo with no consumer of
that history yet — a sample is persisted every 2 seconds
(`OBSERVATION_PERSIST_INTERVAL_MS` in `src/app/App.ts`) while the last 200
stay in an in-memory ring buffer for the live Inspector panel. Weather
readings are infrequent enough (one poll per `WEATHER_REFRESH_INTERVAL_MS`,
5 minutes) to persist every time.

**Offline-first direction (not yet built):** the plan is a
`SyncingRepository<T>` that wraps a local repository with a sync queue and
conflict resolution against a future server, implementing the same
`Repository<T>` interface — so when a backend arrives, no domain code
changes, only which repository implementation `persistence/repositories.ts`
constructs. This repository is not yet PostGIS/Postgres-backed anywhere;
that remains appropriate future server-side storage once one exists,
compatible with the same `Repository<T>` seam.

## Local development

```bash
npm install
npm run dev        # start the Vite dev server
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run build      # typecheck + production build
```

No `.env` file is required to run the app — see "Security," above.

## Architecture

```
src/
  app/          App.ts — async factory loads/seeds the world, then owns the render loop
  scene/        Renderer, lights, terrain, flight-path visualization
  drone/        DroneState (typed), DroneModel (3D mesh + cosmetic animation),
                FlightStateMachine
  cameras/      Orbit / Follow / Top-down / FPV camera rig
  mission/      Mission + Waypoint model (optional geoPosition), the default
                survey-loop mission
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
  geo/          Coordinate/CRS types, Turf-based geometry utilities, the
                DEMO_ONLY georeference transform, demo geometry fixtures
  weather/      WeatherObservation, WeatherProvider (+ OpenMeteoProvider,
                MockWeatherProvider), normalization/validation,
                WeatherService (cache + staleness)
  world/        WorldRegistry (referential-integrity index + lookups),
                demoWorld.ts (the one seeded fixture)
  persistence/  Repository<T> interface, InMemoryRepository,
                IndexedDbRepository, repositories.ts factory
  ui/           Hud, Minimap, WorldPanel, DataInspector, GeoView,
                WeatherPanel — render domain state/Observations, compute
                nothing
```

Data flow, and the boundary that must never be crossed:

```
WorldRegistry (Farm/Field/Zone/Sensor, validated + persisted)
        ↓
SimulationEngine (DroneState)  ──────────────┐
        ↓                                    │
TelemetryGenerator + Sensor.capabilities      │  geo/georeference.ts
        ↓                                     ▼  (DEMO_ONLY transform)
   Observation[]  (SIMULATED, tagged farm/field/mission/drone) + one
   ESTIMATED demo-geodetic position Observation
        ↓
        │        Open-Meteo → OpenMeteoProvider → WeatherService (cached)
        │              → weatherObservationToObservations (EXTERNAL)
        ▼                        ↓
ObservationLog (recent, in-memory) ──┬──→ Hud / Minimap / DataInspector / GeoView / WeatherPanel (render only)
                                     └──→ Repository<Observation> (sampled, persisted)
```

The renderer never owns agricultural state or performs a coordinate
conversion. The UI never invents a number. A future real hardware gateway
is meant to implement the same `Sensor` interface and slot into the same
pipeline without the UI changing at all.

## Roadmap (see the Phase 0 audit for full detail)

1. ~~Solid simulation core~~ — Phase 1.
2. ~~Field + sensor model~~ — Phase 2: Farm/Field/Zone entity graph, sensor
   registry + capability model, first persistence layer.
3. ~~Real data pipeline + geospatial base~~ — this repository, Phase 3:
   coordinate/CRS model, DEMO_ONLY field/zone geometry, a real external
   weather source with caching and honest degradation.
4. Crop/soil analytics + richer digital twin — first scoped ML model,
   behind a model registry, with stated confidence; a real (non-Null-Island)
   field boundary and CRS pipeline if real field data becomes available.
5. Autonomous missions + AI decision engine — coverage planning, temporal
   comparison across flights, sensor fusion with preserved uncertainty.
6. Real hardware + community platform — first real flight-controller/sensor
   integration behind the `Sensor`/drone abstractions proven here; open
   datasets and plugin contributions.

Phase 4 is not started and requires separate approval before work begins.
