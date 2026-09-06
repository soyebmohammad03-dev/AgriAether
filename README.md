# AgriAether

AgriAether is an early-stage, open-source foundation for an agricultural
intelligence, simulation, digital-twin, and autonomous field-operations
platform. This repository is not yet that platform — it is currently a
**simulation core with a Farm/Field/Zone/Sensor domain model, a demo
geospatial layer, one real external data source (weather), an agricultural
sensing/analytics architecture that currently reports every remote-sensing
analysis as honestly unsupported** (no camera or soil sensor exists yet —
see "Remote sensing & agricultural analytics" below), **and a real
GeoJSON/raster ingestion pipeline exercised end-to-end by a deterministic
fixture** (see "Real agricultural data pipeline" below) — no live external
dataset provider is wired up, by design.

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
- Three developer-facing panels: the **Observation Inspector** (the
  "Inspector" button) listing recent Observations with every field — type,
  value, unit, source, provenance, confidence, and Farm/Field/Zone/Sensor/
  Mission/Drone linkage; the **Geospatial View** (the "Geo View" button), a
  small canvas plot of the demo field/zone boundaries and the drone's
  demo-geodetic position, explicitly labeled DEMO_ONLY; and the
  **Agricultural Analysis Registry** (the "Analyses" button), which lists
  every analysis this codebase knows how to define (five vegetation
  indices, one thermal feature, temporal change, zone aggregation) and its
  real support status against the sensors actually deployed — today that
  means every vegetation index and the thermal feature show `UNSUPPORTED`,
  truthfully, because no multispectral or thermal sensor exists yet.
- A **remote-sensing and agricultural-analytics architecture** (`src/sensing/`,
  `src/soil/`) built specifically so it cannot fabricate a result: a
  `SpectralIndex`/`IndexEngine` that computes NDVI/GNDVI/NDRE/SAVI/EVI only
  when the exact required bands are present as *calibrated reflectance* —
  RGB-only or raw-radiance input always returns `INSUFFICIENT_DATA` or
  `UNSUPPORTED`, never a number; a `SoilSample` model with the same
  measurement-method-implies-provenance enforcement soil-side; an
  `AnalysisRegistry` and `ModelRegistry` (four planned ML models, all
  `NOT_DEPLOYED` — no labeled dataset exists in this repository); a
  `TemporalChange`/`SpatialAggregation` foundation that makes no causal
  claims; a `SensorFusion` inventory that reports what's available without
  ever combining it into a health score; and a seeded, deterministic
  `SyntheticDatasetGenerator` used only by tests, never by the live app.
- A **real agricultural data pipeline** (`src/data/`): a `DatasetRecord`
  registry every derived artifact can be traced back to; `ingestFieldBoundaryGeoJson`
  validating (and, only when recoverable, repairing-with-a-record) real
  GeoJSON field/zone boundaries — the demo world's own Field 01 boundary
  now runs through this exact function rather than being used raw; a
  lightweight `RasterGrid`/`RasterMetadata` model with explicit nodata
  handling and field/zone clipping that never mutates the source raster;
  real spatial statistics that flag low-coverage results `QUESTIONABLE`
  instead of showing them with false confidence; `checkTemporalCompatibility`,
  which refuses to compare incompatible rasters; and a **Data Catalog**
  panel (the "Data Catalog" button) showing a real Field Summary, Coverage,
  Data Gaps, Mission Data Requirements, and the dataset registry — no
  fabricated health score, no invented coverage percentage.

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
  canopy temperature. The UI's "Data Layers" and "Analyses" panels say so
  explicitly rather than showing a number — those quantities require ground
  probes, multispectral/thermal sensors, or trained CV models that do not
  exist in this codebase yet.
- No camera, thermal, or soil sensor of any kind is deployed — the demo
  drone only carries GPS/IMU/barometer/battery, same as Phase 1–3. Every
  Phase 4 remote-sensing type (`RgbImageObservation`, `MultispectralReading`,
  `ThermalReading`, `SoilSample`) exists as architecture only, exercised by
  tests and the deterministic synthetic generator — never by a live sensor.
- No ML model is deployed. `ModelRegistry.PLANNED_MODELS` lists four
  (crop segmentation, crop stress, disease classification, yield
  estimation), every one `NOT_DEPLOYED` with its missing-dataset
  requirement documented — none produces a prediction.
- No live external dataset provider (satellite/imagery catalog, etc.) —
  `DatasetProvider` is an interface only; the sole implementation ingests a
  local, deterministic fixture. No random imagery was downloaded and
  relabeled as belonging to a real farm.
- No real (non-fixture) raster — `RasterGrid`/`RasterMetadata` exist and are
  exercised end-to-end by `fixtures/AgriculturalRasterFixture.ts`, never by
  live drone or satellite imagery.
- No spatial grid/tiling engine beyond the minimum row/col window addressing
  `Raster.ts` needs for its own fixture-scale tests — evaluated and
  deferred; see "What we deliberately did not build," below.
- No file upload UI — `AssetSecurity.validateUploadCandidate` exists as a
  tested contract for when one is built, not a working feature today.
- No map basemap/tiles — see "Map/geospatial visualization" below for why.
- No AI-generated recommendations, no autonomous mission planning, no
  causal claims from temporal change detection (it reports
  INCREASED/DECREASED/STABLE, never "why").
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

## Remote sensing & agricultural analytics

```
                    SENSOR LAYER (taxonomy: sensing/SensorCapabilityCatalog.ts)
                         │
          ┌──────────────┼──────────────┬─────────────────┐
          ↓              ↓              ↓                 ↓
  RgbImageObservation  MultispectralReading  ThermalReading  SoilSample
   (sensing/)             (sensing/)          (sensing/)      (soil/)
          │              │              │                 │
          └──────────────┼──────────────┴─────────────────┘
                         ↓
              Observation[] / typed reading (provenance always
              MEASURED/SIMULATED/EXTERNAL as the source dictates,
              never invented — see assertValidObservation's
              source-prefix rules)
                         │
                    FEATURE ENGINE
              ┌──────────┴──────────┐
              ↓                     ↓
   IndexEngine.calculateIndex   ThermalReading feature fns
   (band-gated: OK / UNSUPPORTED   (documented, deterministic —
   / INSUFFICIENT_DATA — never     e.g. canopy-minus-air
   a fabricated index value)       temperature difference)
              │                     │
              └──────────┬──────────┘
                         ↓
              AgriculturalAnalysis  (never provenance MEASURED —
                         │           an analysis is derived by definition)
                    DATA LINEAGE  (sensing/Lineage.ts: Analysis ->
                         │         input Observations -> source Sensors)
                    AnalysisRegistry.evaluateAnalysis()
                         │         (gates every analysis on the sensor
                         │          kinds actually deployed)
                    USER / FARMER  (the "Analyses" panel — shows
                                    UNSUPPORTED with the real reason
                                    instead of a fake number)
```

**Vegetation indices** (`src/sensing/SpectralIndex.ts`, `IndexEngine.ts`):
NDVI, GNDVI, NDRE, SAVI, EVI, each with its published formula, required
bands, numeric range, and documented assumptions/limitations as data, not
comments. `calculateIndex` is the only place one is computed, and it always
returns a `status` (`OK | UNSUPPORTED | INSUFFICIENT_DATA`) alongside any
value — an uncalibrated-radiance `MultispectralReading` is `UNSUPPORTED`;
a reading missing a required band (e.g. RGB imagery lacking NIR) is
`INSUFFICIENT_DATA`; nothing here ever substitutes a nearby band or guesses.

**Thermal** (`ThermalReading.ts`) keeps three things explicitly separate: a
`ThermalReading` is a measured temperature; a `ThermalFeature` is a named,
deterministic computation over readings (e.g. canopy − air difference);
neither is an agricultural interpretation ("water stress") — that would
require a validated model this repository does not have.

**Soil** (`src/soil/`): `SoilSample.method` (`FIELD_SAMPLING | ZONE_SAMPLING
| LABORATORY | GROUND_SENSOR | EXTERNAL_DATASET | SIMULATION`) determines
its `provenance` — the two can never disagree, enforced at construction.
`assertSoilSampleSensorCapable` (reusing `sensors/Sensor.ts`'s capability
guard) rejects a `GROUND_SENSOR` sample if the referenced sensor doesn't
declare every measurement present — the same mechanism that keeps
"RGB camera → soil NPK" impossible also keeps "pH probe → soil moisture"
impossible. `soilSampleToObservations.ts` explodes a sample into the same
canonical `Observation` records everything else uses, mirroring
`weatherObservationToObservations.ts`.

**Data quality vs. provenance** (`sensing/DataQuality.ts`): deliberately a
second, orthogonal axis — `VALID | QUESTIONABLE | INVALID | MISSING |
STALE | INSUFFICIENT_DATA | UNSUPPORTED | CALIBRATION_REQUIRED`. "EXTERNAL
+ STALE" and "SIMULATED + VALID" are both coherent; the two dimensions are
never merged into one flag.

**Calibration & sensor health**: `SensorRecord.calibration` now carries
source/version/validity/notes, not just a status enum
(`domain/SensorRecord.ts`). `sensing/SensorHealth.ts` derives
`ONLINE | OFFLINE | DEGRADED | CALIBRATION_REQUIRED | UNKNOWN` from real
signals already in the codebase (registry status, calibration state,
observation recency/validity) — never fabricated hardware telemetry — and
always carries `isSimulated` alongside the status so a simulated sensor's
"ONLINE" is never shown without its "(SIMULATED)" qualifier (see the
breadcrumb under the logo).

**Model registry** (`sensing/ModelRegistry.ts`): a data-only contract for
future ML models — id, task, input/output shape, training dataset
reference, evaluation metrics, deployment status, limitations.
`assertModelRecordValid` refuses to let a model claim `DEPLOYED` without
both evaluation metrics and a training dataset reference. `PLANNED_MODELS`
registers four (crop segmentation, crop stress, disease classification,
yield estimation), each `NOT_DEPLOYED` with its missing-dataset requirement
spelled out — per the Phase 4 brief's explicit instruction not to train or
fake a model with no real dataset.

**Prediction vs. measurement**: `createPredictedObservation`
(`observation/Observation.ts`) always sets `provenance: 'PREDICTED'` and
`source: 'model:<modelId>'`; `assertValidObservation`'s source-prefix rules
reject a `model:*` source ever claiming `MEASURED`, `SIMULATED`, or
`EXTERNAL` — a prediction can never be presented as a direct reading. The
same rule set also rejects an `external:*` source claiming `SIMULATED`
(weather cannot become simulated telemetry) and a `sim*`/`synthetic*`
source claiming `MEASURED`/`EXTERNAL` (simulated or synthetic data cannot
be promoted to real).

**Temporal change & spatial aggregation** (`TemporalChange.ts`,
`SpatialAggregation.ts`): `compareObservations` only compares
same-type/same-field/same-zone pairs with real values, returns
`INCREASED | DECREASED | STABLE | INSUFFICIENT_DATA` from a documented
relative threshold, and makes no claim about *why* — no weather/irrigation
causal attribution exists. `aggregateObservations` computes mean/min/max/
count over same-type observations and returns a distinctly-shaped
`AggregationResult` (never conflated with a raw `Observation`), always
naming its `sourceObservationIds`.

**Sensor fusion foundation** (`SensorFusion.ts`): `buildFusionInventory`
reports what observation types, time range, location frames, and
confidence are available to combine — it never computes an "overall crop
health" score. That conversion is exactly the job a future validated model
in the model registry would do.

**Synthetic dataset generator** (`sensing/synthetic/SyntheticDatasetGenerator.ts`):
a seeded PRNG (mulberry32) generating deterministic multispectral/thermal
readings, always `provenance: 'SIMULATED'`, for exercising the IndexEngine/
TemporalChange/SpatialAggregation pipelines in tests. It is never imported
by `app/App.ts` — the live application shows real `UNSUPPORTED` statuses,
not synthetic numbers dressed up as a demo.

**What we deliberately did not build**: a spatial grid/raster abstraction
(Part 22 of the brief) — evaluated and skipped because nothing in this
repository produces raster/pixel data yet; a full image-processing/upload
pipeline — no real camera source exists to ingest from, so `ImageAsset` is
a reference type only (`storage: 'local' | 'object-store'`), never
wired to actual bytes; and a "crop condition" or "disease" status any
analysis can return — `AgriculturalAnalysisType` deliberately excludes
both.

## Real agricultural data pipeline

```
                 DATA SOURCES
                      │
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
    IMAGERY        SENSORS        WEATHER
   (fixture)   (sim GPS/IMU/     (Open-Meteo,
                baro/battery)     Phase 3)
       │              │              │
       └──────────────┼──────────────┘
                      ↓
                  INGESTION           DatasetProvider.fetch() → ImportJob
                      ↓               (PENDING→VALIDATING→INGESTING→
              VALIDATION + QC          PROCESSING→COMPLETED/FAILED,
                      ↓                 never fake progress)
             GEO / CRS NORMALIZE      ingestFieldBoundaryGeoJson()
                      ↓               (repairs recorded, never silent;
          ┌───────────┴───────────┐    invalid geometry ⇒ geometry: null)
          ↓                       ↓
       VECTOR                   RASTER
     FIELD/ZONES              IMAGERY/GRID        RasterGrid + nodata +
          │                       │                clipRasterToGeometry
          └───────────┬───────────┘                (never mutates source)
                      ↓
              FIELD DATA MODEL                     FieldSummary,
                      ↓                             computeFieldCoverage
              FEATURE / ANALYSIS                   computeSpatialStatistics
                      ↓                             (QUESTIONABLE below
             TEMPORAL INTELLIGENCE                  30% coverage),
                      ↓                             checkTemporalCompatibility
                DATA GAPS                          detectDataGaps()
                      ↓
             FUTURE MISSION PLAN                   evaluateMissionDataRequirements()
                      ↓                             (MISSION_REQUIRED, not
               FUTURE ML / AI                        an actual flight)
```

**Dataset registry** (`data/Dataset.ts`): every dataset — vector, raster,
tabular, imagery, sensor series, weather — gets one `DatasetRecord`:
provider, source, type, acquisition range, spatial extent, CRS, resolution,
bands, license/attribution, provenance, quality. A `RASTER`/`IMAGERY`
dataset is required to declare a CRS at construction — `createDatasetRecord`
throws otherwise, rather than letting a later step silently assume WGS84.
The demo world registers exactly one dataset today: Field 01's own
boundary, ingested through the real pipeline below (see `world/demoWorld.ts`).

**GeoJSON field boundaries** (`data/GeoJsonIngestion.ts`): validates ring
closure, coordinate bounds, minimum point count, and self-intersection
(via `@turf/kinks`) before accepting a Polygon/MultiPolygon. An unclosed
ring that's otherwise valid is repaired by closing it — and the result
comes back `status: 'REPAIRED'` with `repairMethod: 'CLOSED_RING'` and the
original geometry preserved alongside the repaired one; nothing is fixed
silently. Anything unrecoverable (self-intersecting, out-of-range
coordinates, too few points) comes back `status: 'INVALID'` with
`geometry: null` — never used downstream. The demo Field 01/Zone A/Zone B
boundaries are still `DEMO_ONLY` Null Island fixtures (see "Geospatial
architecture" above) — Phase 5 changed *how* they're validated, not *what*
they claim to be.

**CRS**: `data/CrsTransform.ts` names three roles a CRS can play — SOURCE,
DISPLAY, ANALYSIS — that this codebase currently collapses onto one value,
`EPSG:4326`, with area/distance computed spherically via Turf rather than
through a projection (documented in "Geospatial architecture," above). The
seam exists so adding a projected ANALYSIS CRS later touches one place.

**Raster model** (`data/Raster.ts`): `RasterMetadata` (dimensions, extent,
CRS, per-band metadata, an explicit `nodataValue` that is never assumed to
be `0` or `-9999`, dtype, acquisition time, source) is kept separate from
`RasterGrid`, which holds the actual per-band `Float64Array` pixel data —
Part 13 of the brief's "don't create a relational row per pixel," honored
by never putting pixel arrays anywhere near the entity/repository layer.
`RasterGrid.getCell` returns `null` for nodata or out-of-range — never the
raw sentinel value. `readWindow` is the minimum row/col addressing this
phase needs; there is no tiling/paging engine, because nothing in this
codebase yet needs one (see "What we deliberately did not build").

**Field/zone clipping** (`data/FieldClip.ts`): `clipRasterToGeometry`
point-tests every cell's center against a field or zone polygon (reusing
`geo/geometry.ts`'s point-in-polygon) and returns a `FieldRasterSubset` —
cell indices plus a `ProcessingStep` recording the operation and algorithm
version — without ever copying or mutating the source `RasterGrid`.
`readClippedBandValues` then reads the untouched source on demand.

**Spatial statistics** (`data/SpatialStatistics.ts`): mean/median/min/max/
stddev over valid (non-nodata) cells only, always returning `sampleCount`,
`totalCellCount`, and `coverageFraction` alongside the value — a statistic
computed over less than 30% of candidate cells comes back `quality:
'QUESTIONABLE'`, not presented with the same confidence as a fully-covered
one (the brief's own example: a mean over 3 of 300,000 pixels).

**Temporal compatibility** (`data/TemporalAlignment.ts`): before any
raster-level comparison, `checkTemporalCompatibility` checks CRS match,
shared band, extent overlap, and distinct timestamps — a mismatch returns
`INCOMPATIBLE_DATA` (a real structural conflict) or `INSUFFICIENT_DATA`
(missing information), and the caller must not proceed to compute a
comparison. This sits alongside, not instead of, Phase 4's
`sensing/TemporalChange.ts`, which compares individual `Observation`s;
raster-level temporal work builds on both.

**Coverage & data gaps** (`data/Coverage.ts`, `data/DataGap.ts`):
`computeFieldCoverage` reports real sensor-category availability (rgb/
multispectral/thermal/soil/weather), real observed time range, and real
freshness — `spatialCoveragePercent` is `null`, not a fabricated number,
whenever no raster has actually been clipped for that field (true for the
live app today: the only registered dataset is a vector boundary, not
imagery). `detectDataGaps` turns that into an explicit list (missing
sensor, missing timestamps, stale observations, insufficient spatial
coverage) — verified live: with only GPS/IMU/barometer/battery deployed,
the Data Catalog panel correctly lists four `MISSING_SENSOR` gaps.

**Mission data requirements** (`data/MissionDataRequirement.ts`): reframes
every `UNSUPPORTED` entry from Phase 4's `AnalysisRegistry` as a
`MISSION_REQUIRED` statement — "NDVI requires multispectral-camera, not
currently deployed" — without planning or flying anything. Autonomous
mission planning remains future work.

**Field Summary** (`data/FieldSummary.ts`): assembles area, dataset count,
recent observation count, latest acquisition, coverage, gaps, and which
analyses are actually `SUPPORTED` — with an explicit `"No agricultural
analysis available yet."` note when none are, never a generic health score.

**Import jobs** (`data/ImportJob.ts`): `runImportJob` walks a dataset
through `PENDING → VALIDATING → INGESTING → PROCESSING → COMPLETED/FAILED`
synchronously — every transition reflects a real step that happened, not a
fake progress bar. A provider failure ends the job `FAILED` with the real
error and `recordsProcessed: 0`, never a partial/fake result.

**Asset upload security** (`data/AssetSecurity.ts`): `validateUploadCandidate`
sanitizes filenames (rejects `..`/path separators/null bytes), enforces a
size ceiling, and checks the declared MIME type against an allowlist —
never trusting a filename's extension alone. Written now, tested, and
ready for the first real upload feature; no upload UI exists in this
codebase yet.

**Deterministic raster fixture** (`data/fixtures/AgriculturalRasterFixture.ts`):
a 4×4, two-band (RED/NIR) grid with one known nodata cell and mathematically
predictable values — never used by the live app, only by tests, which
verify clipping/statistics/nodata handling/index calculation against known-
correct answers (see `data/RasterIndexIntegration.test.ts` for the full
raster → clip → statistics → `IndexEngine.calculateIndex` path).

**What we deliberately did not build (Phase 5 additions)**: a live external
dataset provider — network-based ingestion (satellite catalogs, public
imagery APIs) is real future work, deferred rather than faked with a
provider that silently falls back to fixture data; a tiling/paging raster
engine — nothing in this codebase handles a raster larger than the small
fixture scale yet; and a real (non-Null-Island) field boundary — obtaining
one is a data-acquisition problem, not an architecture problem, and
inventing a plausible-looking one would violate the project's own
scientific-honesty rules.

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
  A `weatherCache` object store was added in Phase 3 (schema version 2) and
  a `datasets` store in Phase 5 (schema version 3) — each migration only
  adds missing stores, verified live to never touch existing data.
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
  soil/         SoilSample (method-implies-provenance), 
                soilSampleToObservations (+ sensor-capability guard)
  sensing/      Remote-sensing taxonomy, SpectralIndex/IndexEngine,
                ThermalReading/features, AgriculturalAnalysis,
                AnalysisRegistry, ModelRegistry, TemporalChange,
                SpatialAggregation, SensorFusion, SensorHealth, Lineage,
                DataQuality, ImageAsset — the Phase 4 sensing/analytics
                architecture; synthetic/ holds the seeded test-only
                dataset generator
  data/         Phase 5: DatasetRecord registry, GeoJsonIngestion,
                CrsTransform, Raster/RasterGrid, FieldClip,
                SpatialStatistics, TemporalAlignment, Coverage, DataGap,
                MissionDataRequirement, FieldSummary, ImportJob,
                AssetSecurity, ProcessingStep (lineage); fixtures/ holds
                the deterministic test-only raster fixture
  world/        WorldRegistry (referential-integrity index + lookups),
                demoWorld.ts (the one seeded fixture)
  persistence/  Repository<T> interface, InMemoryRepository,
                IndexedDbRepository, repositories.ts factory
  ui/           Hud, Minimap, WorldPanel, DataInspector, GeoView,
                WeatherPanel, AnalysisRegistryPanel, DataCatalogPanel —
                render domain state/Observations, compute nothing
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
3. ~~Real data pipeline + geospatial base~~ — Phase 3: coordinate/CRS model,
   DEMO_ONLY field/zone geometry, a real external weather source with
   caching and honest degradation.
4. ~~Remote sensing + agricultural analytics foundation~~ — this repository,
   Phase 4: spectral-index engine gated on real band availability, soil
   sampling with method-implies-provenance, analysis/model registries (no
   model deployed — no labeled dataset exists), temporal change/spatial
   aggregation foundations, sensor fusion inventory, data lineage tracing.
5. ~~Real agricultural data pipeline + raster intelligence~~ — this
   repository, Phase 5: dataset registry, validated (and honestly-repaired)
   GeoJSON ingestion, a lightweight raster/nodata/clipping model exercised
   end-to-end by a deterministic fixture, spatial statistics with coverage-
   aware quality, temporal-compatibility gating, coverage/data-gap/mission-
   requirement reporting, and the Data Catalog panel — still no live
   external dataset provider and no real (non-fixture) raster.
6. First real ML model + first real external dataset — once a genuine
   labeled dataset exists (real or high-fidelity simulated imagery with
   verified labels) and/or a live `DatasetProvider` implementation is
   added, train and register a model against `ModelRegistry`'s contract; a
   real (non-Null-Island) field boundary and CRS pipeline if real field
   data becomes available.
7. Autonomous missions + AI decision engine — coverage planning, temporal
   comparison across flights, sensor fusion converted into a validated
   prediction with preserved uncertainty.
8. Real hardware + community platform — first real flight-controller/sensor
   (including camera/multispectral/thermal/soil) integration behind the
   `Sensor`/drone abstractions proven here; open datasets and plugin
   contributions.

Phase 6 is not started and requires separate approval before work begins.
