# AgriAether

**AI-powered agricultural intelligence platform** — Sentinel-2 satellite
imagery, geospatial field analysis, a real trained crop-classification
model, evidence-based management zones, agricultural recommendations, a
Digital Twin / Knowledge Graph, and a simulation-first autonomous
field-operations architecture.

[![CI](https://github.com/soyebmohammad03-dev/AgriAether/actions/workflows/ci.yml/badge.svg)](https://github.com/soyebmohammad03-dev/AgriAether/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-469%20passing-brightgreen)](#testing)
[![ML: Crop vs Non-Crop](https://img.shields.io/badge/ML%20benchmark-93.15%25%20val.%20accuracy-blue)](#machine-learning)

## What AgriAether does

AgriAether combines **satellite remote sensing** (real Sentinel-2 L2A
imagery + NDVI), **geospatial field analysis** (evidence-based management
zones derived from real per-pixel vegetation index clustering),
**agricultural machine learning** (a real trained Prithvi-EO-2.0
crop-classification benchmark), a **Digital Twin and Knowledge Graph** of
farm state, an **agricultural recommendation engine**, and a
**simulation-first autonomous field-operations** core (drone mission
planning, fleet management, edge inference) into one coherent platform —
built specifically to never let a simulated, estimated, or benchmark
result quietly pass itself off as a live, measured one. Every
`Observation`, `PredictionRecord`, and `ModelRecord` carries an explicit
provenance/status field enforcing that distinction structurally, not just
in prose.

**This is a research/demo-stage platform, not a production SaaS.** It is
currently a **simulation core with a Farm/Field/Zone/Sensor domain model,
a demo geospatial layer, real external data sources (weather + Sentinel-2
satellite imagery), an agricultural sensing/analytics architecture that
reports unsupported analyses honestly rather than guessing** (see "Remote
sensing & agricultural analytics" below), **a real GeoJSON/raster
ingestion pipeline, a real CSV/GeoJSON import UI, and a real trained ML
benchmark** (see "Machine Learning" below) — layered under a Digital
Twin, Knowledge Graph, recommendation/irrigation/nutrient intelligence,
simulation-only autonomous mission planning, and farmer/community/offline
layers. **No real hardware and no real cloud sync exist anywhere in this
repository**; every place that would need one says so explicitly instead
of faking it. See "Real / staged / simulated" below for the exact
breakdown, and "Project status" for the full detail.

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
- File upload UI now exists (Phase 7, `ui/ImportPanel.ts`) for CSV
  observation and GeoJSON field-boundary import, using
  `AssetSecurity.validateUploadCandidate` for real — see "Real agricultural
  data ingestion + field data platform" below. Still no upload path for
  imagery/raster files.
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

## Ground sensing, measurement contracts, and crop observations (Phase 6)

Phase 6 extends the sensor/observation architecture to the quantities a real
farm actually needs beyond drone telemetry and weather — without installing
any hardware or fabricating a reading for a sensor that doesn't exist. Every
addition here is a **capability declaration or an ingestion pathway**, ready
for a real reading the moment one arrives; none of it produces a live number
today unless a real `GROUND_SENSOR` sample is registered.

**New sensor kinds** (`domain/SensorRecord.ts`'s `SensorKind`, cataloged in
`sensing/SensorCapabilityCatalog.ts`): `leaf-wetness`, `solar-radiation`,
`irrigation-flow`, `water-quality`, joining the soil/weather kinds already
declared in Phase 2–4. None are deployed by the demo world — the Data
Catalog's new **Sensor Capability Registry** section lists all of them
against what `WorldRegistry.listSensors()` actually returns, so "declared in
the taxonomy" and "physically deployed" are never confused.

**`sensors/GroundSample.ts`** is the non-soil counterpart to
`soil/SoilSample.ts`: the same `method` → `provenance` mapping
(`GROUND_SENSOR` → `MEASURED`, `EXTERNAL_DATASET` → `EXTERNAL`, `SIMULATION`
→ `SIMULATED`, enforced by `createGroundSample`), covering air temperature,
relative humidity, leaf wetness, rainfall, wind speed/direction, solar
radiation, irrigation flow rate, and irrigation/source water EC and pH.
`sensors/groundSampleToObservations.ts` explodes a sample into canonical
`Observation` records exactly like `soilSampleToObservations.ts` does,
including a sensor-capability guard (`assertGroundSampleSensorCapable`) that
makes "a leaf-wetness sensor reporting wind speed" a thrown error, not a
silently accepted value.

**`sensing/Units.ts`** holds the explicit, tested unit conversions the app
actually needs (°C↔°F, mm↔in, m/s↔km/h, hPa↔kPa) plus `isWithinRange`, a
small range-membership check. **`sensing/DataQuality.ts`** gained an
`OUT_OF_RANGE` state: `deriveDataQuality` now also takes a value and a
`PlausibleRange` and flags a reading that falls outside a documented,
generous real-world bound — the same "generous extreme, not normal-operating
window" philosophy `weather/WeatherObservation.ts`'s `PLAUSIBLE_RANGES`
already established — without dropping or clamping the value.
`GroundSample`'s per-quantity plausible ranges live in
`sensors/GroundSample.ts`'s `MEASUREMENT_PLAUSIBLE_RANGES`.

**`domain/CropObservation.ts`** is a point-in-time crop observation —
growth stage, cultivar, and a free-text `observedCondition` string, each
tagged with its own `Provenance`, timestamp, and confidence — distinct from
`domain/Crop.ts`'s `CropCycle`, which is slow-changing planting
configuration, not a stream of readings. There is no health/stress/disease
score anywhere in this type: turning an observation into a diagnosis needs a
validated model this codebase does not have (see `ModelRegistry.ts`'s
deployment gate).

**`soil/SoilDataProvider.ts`** defines the interface a real soil data source
would implement, mirroring `weather/WeatherProvider.ts`. It ships with
exactly one implementation, `UnconfiguredSoilProvider`, which always rejects
rather than returning a value. This is a deliberate decision, not a gap: the
free, no-credential soil datasets surveyed for this phase are gridded
weather-model estimates (e.g. reanalysis-derived soil moisture), not
ground-truth sensor readings, and treating a modeled quantity as a physical
soil measurement would break the same rule that already governs
weather-vs-soil elsewhere in this README. `soil/SoilSample.ts`'s
`GROUND_SENSOR`/`LABORATORY`/`FIELD_SAMPLING`/`ZONE_SAMPLING`/
`EXTERNAL_DATASET` pathways are what a real soil sensor or lab result would
flow through instead.

**`sensing/SensorFusion.ts`** gained `categorizeSource`/
`countBySourceCategory`, grouping a `FusionInventory`'s observations into
`drone` / `ground-sensor` / `soil` / `weather` / `historical` / `other` by
structural `type`/`source` prefix — still never combined into a score;
Part 6 of the brief ("preserve provenance, timestamp, quality, and
uncertainty" per source) is the same constraint `buildFusionInventory` has
enforced since Phase 4, now with source-stream visibility added.

**`sensing/ObservationQuery.ts`** answers the temporal questions the brief
asks for from data that's actually there: `observationsSince` (a field's
observations at or after a cutoff), `findMissingObservationTypes` (which
expected quantities have zero observations for a zone), and
`latestObservationOfType` (the most recent reading of a quantity, or `null`
— never a synthesized last-known-value). These sit alongside, not instead
of, `TemporalChange.ts`'s pairwise comparison.

**Persistence**: `WorldRegistry` gained `registerSoilSample`/
`registerGroundSample`/`registerCropObservation` (each validated against a
real, already-registered field, same as every other `register*` method) and
matching `list*ForField` queries; three new IndexedDB stores —
`soilSamples`, `groundSamples`, `cropObservations` — were added in schema
version 4. The demo world registers none of them: the Data Catalog's new
**Ground Observations** section renders an honest "no soil/ground/crop data
recorded — no hardware connected" state rather than a fabricated fixture.

**What Phase 6 deliberately does not include**: any real ground-sensor
hardware or a soil data provider implementation (see above), a crop-health
score of any kind, a trained model over any of these new observation types,
and a `DataQuality` value on every existing measurement path back-filled
with a plausible range — that's a per-quantity exercise left for whichever
quantity gets a real deployment first, not something to bulk-retrofit
speculatively.

## Real agricultural data ingestion + field data platform (Phase 7)

Phase 6 added domain models for ground/crop observations with no way to get
real-world data into them except hand-written fixtures. Phase 7 is the
ingestion layer: a generic, auditable pipeline that takes an untrusted CSV
or GeoJSON file and turns it into `Observation`s (or a field boundary)
without losing where the data came from, what unit it's in, or how
trustworthy it is.

**`DataSource` registry** (`src/data/DataSource.ts`). A `DataSourceRecord`
describes a *provider* — type (`CSV_UPLOAD`, `GEOJSON_UPLOAD`, `DRONE`,
`GROUND_SENSOR`, `WEATHER_API`, `SATELLITE`, `FARMER_ENTRY`,
`RESEARCH_DATASET`, `IOT_GATEWAY`, `MANUAL_OBSERVATION`, `SIMULATION`,
`DERIVED`), coverage, reliability, license/attribution, and an
`ingestionStatus` of `CONNECTED` / `MANUAL_UPLOAD` / `UNCONFIGURED`. This is
distinct from `DatasetRecord` (`src/data/Dataset.ts`), which describes one
*product* a source produced. `builtInDataSources()` lists exactly three
sources this app actually has: the simulation engine (`CONNECTED`), and CSV/
GeoJSON manual-upload pathways (`MANUAL_UPLOAD`) — nothing claims
`CONNECTED` without a real implementation behind it; `createDataSourceRecord`
throws if a `RESEARCH_DATASET` tries to claim otherwise. `App.ts` registers
these once by name at startup (`ensureBuiltInDataSources`), so reloading the
app doesn't pile up duplicate records.

**CSV import** (`src/data/CsvImport.ts`, `ImportValidation.ts`,
`ImportPipeline.ts`). A dependency-free RFC-4180-ish parser (quoting, escaped
quotes, row/field-length caps) feeds a column-mapping layer: a researcher
maps their file's actual column names (e.g. `date_time`, `soil_moisture`)
onto the canonical fields (`timestamp`, `observation_type`, `value`, `unit`,
`latitude`/`longitude`, `field_id`/`zone_id`, `sensor_id`) rather than the
importer guessing. `validateObservationDraft` then runs the reusable rule
set: required fields, timestamp parseability/future-dating, coordinate
validity (via `geo/geometry.ts`), a canonical-unit table with a few
explicit conversions (°F→°C, in→mm — see `ImportValidation.ts`'s
`CANONICAL_UNITS`), field/zone ownership against the known world, and
sensor-capability compatibility (`assertSensorCapable`'s check, applied
per row against `SensorRecord.capabilities`). A row with a hard error is
`REJECTED` and excluded; a row with only warnings (missing unit, no
location) is `QUESTIONABLE` and still imported, tagged
`metadata.dataQuality: 'QUESTIONABLE'`. `runCsvObservationImport` builds
the accepted rows into `Observation`s via the new
`createImportedObservation` factory (`observation/Observation.ts`) — which
requires the caller to state `provenance` explicitly (`MEASURED` /
`EXTERNAL` / `USER_REPORTED` / `UNKNOWN`, never defaulted) and requires
`source` to be `import:<dataSourceId>`, a pattern `assertValidObservation`'s
rule set then forbids from ever claiming `SIMULATED`.

**GeoJSON field-boundary import** (`ImportPipeline.ts`'s
`runFieldBoundaryImport`, reusing the Phase 5 `ingestFieldBoundaryGeoJson`).
GeoJSON without a `crs` member is WGS84 per RFC 7946 and proceeds normally;
a legacy `crs` member naming anything other than CRS84/EPSG:4326 is
**rejected outright** — never reprojected or guessed at. An accepted,
non-self-intersecting Polygon/MultiPolygon becomes a `GeoReference` with
the importer's declared `GeodeticProvenance` (`SURVEYED` / `USER_DRAWN` /
`EXTERNAL` — never `DEMO_ONLY`, which stays reserved for the seeded demo
field) and is registered as a new `Field` on the current farm.

**Idempotency** (`src/data/ImportIdentity.ts`). Imported `Observation`s get
a *deterministic* id (an FNV-1a hash of source + type + timestamp + value +
unit + location + field/zone/sensor context) instead of the random
`createId()` every other factory uses. Re-importing the same file produces
the same ids, so a second run reports them as `duplicatesSkipped` rather
than creating duplicate rows or silently overwriting anything — see
`ImportPipeline.test.ts`'s idempotency test.

**Auditable `ImportReport`** (`ImportPipeline.ts`). Every import — CSV or
GeoJSON — produces one: records received/accepted/questionable/rejected,
duplicates skipped, missing-timestamp/coordinate counts, unit issues, and
the actual validation error/warning text. Nothing in this report is a
fabricated summary; it's exactly what the pipeline did to the actual input.
`WorldRegistry.recordImport` persists it (new `importRecords` store,
IndexedDB schema v5) and the Data Catalog's **Import History** section lists
recent runs.

**UI** (`src/ui/ImportPanel.ts`, wired into `App.ts` behind the new "Import
Data" button). Two tabs — CSV Observations / GeoJSON Field Boundary — each:
pick a file (validated by the Phase 5 `AssetSecurity.validateUploadCandidate`
— MIME allowlist, size cap, filename sanitization, before any parsing
happens), map columns or preview geometry, declare provenance explicitly,
run the import synchronously (no fake progress bar — there's no async work
to show progress for), and see the `ImportReport` inline. The Data Catalog
gained **Data Sources** and **Import History** sections; the Observation
Inspector now also shows each observation's timestamp, location, and
`metadata.dataQuality` alongside the existing provenance/confidence/status
fields.

**Public dataset evaluation, deliberately not integrated**
(`src/data/PublicDatasetEvaluation.ts`). Five real candidates were
evaluated for accessibility, licensing, spatial/temporal meaning, and
whether their values are measured, modeled, or estimated: Open-Meteo
(already integrated, Phase 3), ISRIC SoilGrids (a *modeled* 250m soil
surface — a strong future `ESTIMATED`-provenance layer, not appropriate to
present as ground truth for the current DEMO_ONLY field), USDA NASS Quick
Stats (county-level only, wrong resolution, needs an API key), NASA POWER
(coarser than the already-integrated weather pipeline), and USDA SSURGO
(genuinely field-scale and measured, but its web service needs a
server-side proxy this phase's architecture rule — no new backend —
deliberately doesn't add). None were wired up live; each is recorded with
its `verdict` so a future phase with a small proxy or an API-key input knows
which `INTEGRATE_LATER` candidate to start with.

**Provenance vocabulary mapping.** Phase 7's brief describes data as
measured/external/derived/simulated/synthetic. This codebase's existing
`Provenance` enum (`MEASURED` / `EXTERNAL` / `ESTIMATED` / `PREDICTED` /
`SIMULATED` / `USER_REPORTED` / `UNKNOWN`, established in Phase 1) already
covers this without a rename that would touch every existing call site:
"derived" maps to `ESTIMATED`/`PREDICTED`, and `SIMULATED` covers both
"no physical referent" simulation output and synthetic test fixtures
(`sensing/synthetic/SyntheticDatasetGenerator.ts` already documents this).
Reusing the existing taxonomy rather than introducing a parallel one was a
deliberate call — see the module docs above for where each maps.

**What Phase 7 deliberately does not include**: no live network-based
dataset provider (the `RESEARCH_DATASET` type and `UNCONFIGURED` status
exist for when one is added); no backend/proxy service (Part 18's
architectural rule); no plugin marketplace, only the `DataSource`/
`ImportPipeline` extension seam a future provider (a real soil sensor API,
a university dataset) would implement against; no bulk/streaming import
(CSV is capped at 50,000 rows — `CsvImport.ts`'s `MAX_CSV_ROWS` — a
deliberate ceiling, not a silent truncation, since a rejected/truncated
import is reported, not hidden).

## Soil intelligence (Phase 8)

Phase 6 established `SoilSample`/`soilSampleToObservations`; Phase 8 rounds
out the soil model with spatial context, a texture taxonomy, and a
deterministic quality layer — no new architecture, all built on the
existing `Observation`/provenance/`WorldRegistry` foundation.

- **`SoilSample` (`soil/SoilSample.ts`)** gained `location` (an optional
  WGS84 point, distinct from and finer-grained than `fieldId`/`zoneId` —
  validated via `geo/geometry.ts`, never guessed), `textureClass` (the
  standard 12-class USDA textural triangle, `SOIL_TEXTURE_CLASSES` — only
  ever set from an actual lab/field determination, never inferred from
  imagery or moisture), `confidence` (0-1, validated), and
  `MEASUREMENT_PLAUSIBLE_RANGES` (the same generous-bounds pattern
  `sensors/GroundSample.ts` already uses). A sample may now be
  texture-only (no numeric measurement) rather than requiring one.
- **`soil/SoilQuality.ts` (new)** — deterministic, documented interpretation
  bands: `moistureStatus`/`ecStatus`/`phStatus` (standard soil-science
  ranges, explicitly *not* crop-specific and never a recommendation),
  `measurementDataQuality` (reuses `sensing/DataQuality.ts`'s
  `deriveDataQuality` for an OUT_OF_RANGE flag per measurement — a flag,
  never a rejection), and `soilSampleCompleteness` (which of the seven
  known quantities are present, never assuming a missing one is zero). No
  soil-health score, no fertilizer recommendation — explicitly out of
  scope for this phase.
- **`soilSampleToObservations.ts`** now carries `location` and `confidence`
  through to each `Observation`, and a new `soilTextureToObservation`
  produces a `soil.texture` `Observation<string>` (categorical, kept
  separate from the numeric-measurement conversion) — `null` when the
  sample has no texture, never a fabricated default.
- **`WorldRegistry.registerSoilSample`** now validates `zoneId` the same
  way `registerSensorDeployment` already validates its target: the zone
  must exist *and* belong to the sample's own field, not just any zone in
  the world.
- **UI**: the Data Catalog's soil rows now show depth, location (point,
  zone, or field-level), measurement completeness, texture, the
  moisture/EC/pH status bands, and an out-of-range flag — computed from
  `summarizeSoilSampleQuality`, never invented. The honest "no soil sensor
  or laboratory sample registered" empty state (Phase 6) is unchanged for
  when none exist.

**What Phase 8 deliberately does not include**: any soil-health score,
fertilizer/amendment recommendation, spatial interpolation between samples
(the new `location` field only *prepares* for that — no interpolation
algorithm is implemented), a live soil data provider (`SoilDataProvider`
remains intentionally `UnconfiguredSoilProvider` — see Phase 6's reasoning
above, unchanged), and no ML/ disease detection/crop-health scoring
(explicitly out of scope, per the roadmap).

## Consolidated agricultural intelligence milestone (Phase 9)

Merges several roadmap phases into one pass, all built on the existing
Observation/provenance/Dataset/DataSource/WorldRegistry architecture — no
competing abstractions, no backend, no new dependencies.

- **A second real external dataset** (`weather/OpenMeteoHistoricalProvider.ts`):
  daily historical weather (max/min temperature, precipitation) from
  Open-Meteo's `past_days` parameter — the same keyless, CORS-safe provider
  already vetted for current conditions, now exercised against a genuinely
  different endpoint/shape. Normalized via `normalizeOpenMeteoDaily.ts` into
  `DailyWeatherRecord`s (deterministic id, so a re-fetch overwrites rather
  than duplicates), registered as a `DataSourceRecord`
  (`ingestionStatus: CONNECTED`) and a `DatasetRecord` (type `WEATHER`,
  license CC BY 4.0, attributed), and exploded into canonical `Observation`s
  via `dailyWeatherRecordToObservations.ts` — the same conversion pattern
  every other real data path in this codebase uses. Fetched once at app
  startup; a failed fetch degrades to an honest empty state, never a
  fabricated value (see `App.refreshWeatherHistory`).
- **Weather intelligence** (`weather/WeatherIntelligence.ts`): window
  summaries (temperature averages, precipitation total) and Growing Degree
  Days — a standard, documented agronomic formula, computed only from days
  with complete real data; a day missing a field is excluded and counted in
  `missingTempDays`/`daysSkippedMissingData`, never assumed zero or
  interpolated.
- **Crop intelligence** (`domain/CropStatusChange.ts`): deterministic
  growth-stage progression (`ADVANCED`/`UNCHANGED`/`REGRESSED`/`UNKNOWN`,
  ordered by `GrowthStage`'s existing sequence) between consecutive
  `CropObservation`s for a field, and a per-field status summary — no score,
  no health index, only what was actually recorded.
- **Vegetation-index Observations** (`sensing/indexResultToObservation.ts`):
  converts a successful `IndexEngine.calculateIndex` result into the
  canonical `Observation` shape, so `TemporalChange.ts` and
  `SpatialAggregation.ts` (both already generic over any
  `Observation<number>`) work on vegetation indices for free. Returns
  `null` — never a placeholder — for anything other than `status: 'OK'`.
- **Crop stress foundation** (`sensing/CropStressSignal.ts`):
  `assessCropStress` combines whatever real evidence currently exists
  (vegetation index, soil moisture/EC status, recent max temperature, crop
  observation presence) into named correlation flags
  (`low_vegetation_index`, `soil_moisture_deficit`,
  `elevated_soil_salinity`, `heat_stress_conditions`) with a status of
  `NORMAL` / `ATTENTION` / `INSUFFICIENT_DATA` and an explicit
  `missingEvidence` list. Deliberately not a diagnosis: no disease claim, no
  causal claim, no treatment recommendation — see the module's own doc
  comment.
- **ML dataset readiness** (`sensing/ModelRegistry.ts`'s new
  `assessDatasetReadiness`): rather than fabricate a model or its metrics,
  this milestone adds a readiness check against `PLANNED_MODELS`'
  `CROP_STRESS_CLASSIFICATION` entry. Called with the real labeled-sample
  count (always 0 in this repository — `CropObservation.observedCondition`
  is free text, not a validated label taxonomy), it returns
  `INSUFFICIENT_DATA` with the specific reason and the documented minimum
  (50 samples) required before training would be defensible. The model
  stays `NOT_DEPLOYED`, exactly as `ModelRegistry.ts` already required.
- **UI**: three new Data Catalog sections (Weather Intelligence, Crop
  Status, Crop Stress Signals) and three new `AnalysisRegistry` entries
  (`weather:agricultural_indicators`, `crop_status:growth_stage_progression`,
  `crop_stress:evidence_aggregation`), following the exact rendering pattern
  every prior section already uses — real data or an honest empty state,
  never a decorative number.

**What this milestone deliberately does not include**: no trained ML model
(no defensible labeled dataset exists — see dataset readiness above); no
disease detection, no crop-health score, no fertilizer/pesticide
recommendation; no new raster/imagery capability beyond wiring vegetation
indices into the existing generic Observation-based change/aggregation
tools (no camera sensor is deployed in this world, so no vegetation-index
Observation is ever actually produced by the live app — the conversion
path is real and tested, but has nothing to convert without real
multispectral data); no spatial interpolation between soil samples or
between the historical weather point and the field boundary.

## Security

Vite bundles any `VITE_`-prefixed environment variable straight into the
client-side build — visible to anyone who opens the app, not a real secret.
`OpenMeteoProvider` needs no credential, which is exactly why it was chosen
over a keyed alternative for Phase 3. A future provider that requires a
genuinely private API key **cannot** be called directly from this frontend
as it stands; it would need a small backend/proxy holding the key
server-side first. Don't add a keyed provider by pasting a key into a
`VITE_*` variable and calling it a day — that key would ship to every
visitor's browser. No `VITE_`/`process.env` variable is read anywhere in
`src/` today — there is nothing to leak.

**XSS / untrusted content (Phase 15):** every UI panel renders via
`innerHTML` template strings rather than DOM APIs (a deliberate, lightweight
choice — see `src/ui/`). Any string that ultimately originates from a file
upload, imported CSV/GeoJSON, or free-text field (`CropObservation.observedCondition`,
dataset/source name, drone/fleet name) is passed through
`src/ui/escapeHtml.ts` before interpolation. System-generated text (enum
values, computed numbers, hardcoded template strings) is not — only
strings whose origin traces back to a file or user input are in-scope.
`src/data/AssetSecurity.ts` caps upload size (50MB), enforces a MIME
allowlist, and strips path-traversal/null-byte filenames.
`src/data/CsvImport.ts` caps row count (50,000) and per-field length
(10,000 chars); `src/data/GeoJsonIngestion.ts` caps total polygon vertices
(50,000) before running the (otherwise O(n²)-ish) self-intersection check —
all three exist specifically so a malicious or oversized import file fails
fast with an explicit error rather than hanging the tab.

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
  A `weatherCache` object store was added in Phase 3 (schema version 2), a
  `datasets` store in Phase 5 (schema version 3), `soilSamples`/
  `groundSamples`/`cropObservations` stores in Phase 6 (schema version 4),
  `dataSources`/`importRecords` stores in Phase 7 (schema version 5), a
  `dailyWeatherRecords` store in the Phase 9 consolidated milestone (schema
  version 6), and `tasks`/`communityContributions` stores in Phase 13
  (schema version 7) —
  each migration only adds missing stores (`openDatabase`'s `onupgradeneeded`
  checks `db.objectStoreNames.contains(name)` before creating one), verified
  live to never touch existing data. `openDatabase` also handles the
  `onblocked` case (a stale tab holding an older schema version open) by
  logging a diagnostic instead of hanging silently forever — see
  "Diagnostics" below.
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

**Offline-first (Phase 13, `src/offline/OfflineSync.ts`):** there is still
no real remote sync endpoint anywhere in this repository. `deriveSyncStatus`
tells the truth about that — with `hasRemoteEndpoint: false` (the only value
ever passed in this codebase today), a record can only ever be `LOCAL` or
`ERROR`, never `SYNCED`/`PENDING`, which would imply a round trip that isn't
happening. `detectConflict` is a documented foundation only (`LOCAL_ONLY`
today, `CONFLICT`/`NONE` once a remote timestamp actually exists to compare
against). When a backend arrives, the plan is still a `SyncingRepository<T>`
wrapping a local repository behind the same `Repository<T>` interface — no
domain code would need to change, only which repository implementation
`persistence/repositories.ts` constructs, and `deriveSyncStatus` would start
being called with `hasRemoteEndpoint: true`.

## Phases 10–15: intelligence, autonomy, farmer/community, and hardening

Everything below composes the domain data already described above — none of
it is a second parallel system.

- **Sensor fusion / Digital Twin / temporal / Knowledge Graph** (Phase 10,
  `src/sensing/SensorFusion.ts`, `src/twin/FieldTwin.ts`,
  `src/temporal/TemporalIntelligence.ts`, `src/graph/KnowledgeGraph.ts`): a
  deterministic evidence-alignment layer over Observations, a per-field
  snapshot composing soil/crop/weather/vegetation/irrigation/nutrient state
  with `INSUFFICIENT_DATA` fallbacks (never a fabricated value), reusable
  freshness/window/trend/gap utilities, and an in-memory typed graph
  (`Farm → Field → Zone → Sensor/CropCycle/Dataset/Observation/Analysis`)
  rebuilt on demand — no new storage, no Neo4j.
- **Decision intelligence** (Phase 11, `src/sensing/RecommendationEngine.ts`,
  `src/irrigation/IrrigationIntelligence.ts`, `src/soil/NutrientIntelligence.ts`,
  `src/sensing/FieldOptimization.ts`): evidence-linked recommendations
  (`ACTIONABLE`/`NEEDS_MORE_DATA`, never a pesticide/fertilizer dose),
  irrigation-need and nutrient-band screens (never a water volume or a
  fertility score), and a field/zone status
  (`OPTIMAL`/`ATTENTION`/`CONSTRAINED`/`INSUFFICIENT_DATA`) aggregating them.
- **Autonomous drone operations** (Phase 12, `src/mission/AgriculturalMission.ts`,
  `src/drone/AutonomyEngine.ts`, `src/edge/EdgeInference.ts`,
  `src/hardware/HardwareInterface.ts`, `src/fleet/Fleet.ts`): mission
  planning generates real lawnmower waypoints only for this repo's
  `DEMO_ONLY` field boundary (a documented local↔geodetic transform — see
  `src/geo/georeference.ts`); any other geometry provenance returns
  `mission: null` with an explicit limitation rather than fabricated GPS
  coordinates. `AutonomyEngine` picks a mission objective from the highest-
  urgency `ACTIONABLE` recommendation (deterministic, no learned policy).
  `SimulatedEdgeDevice` always returns `NOT_AVAILABLE` (no model is
  deployed). `SimulatedFlightController` is the only connectable hardware
  device; `UnimplementedRealHardwareDevice` always fails `connect()` into
  `ERROR` — no real hardware is ever claimed connected. `Fleet.assignMission`
  never assigns a drone lacking a required sensor capability, never assigns
  a non-executable mission, and never double-assigns a busy drone.
- **Farmer / community / offline / localization** (Phase 13,
  `src/farmer/`, `src/community/`, `src/offline/`, `src/i18n/`): plain-
  language farmer insights rephrase the Twin's evidence (no NDVI/CRS/sensor
  ids, no raw scores); tasks (`OPEN`/`IN_PROGRESS`/`COMPLETED`/`DISMISSED`)
  are generated from recommendations and are inspection/sampling actions
  only. Community contributions reuse `Observation`'s `Provenance`
  vocabulary and start `UNVERIFIED` — nothing auto-promotes one into a
  Recommendation or Twin state. English and Hindi cover static UI-chrome
  labels only (`src/i18n/i18n.ts`); dynamic agricultural text is never
  machine-translated.
- **Explainability / research** (Phase 14, `src/explainability/`,
  `src/research/`): `Explanation` adapters rephrase existing evidence
  outputs (Recommendation, CropStress, DiseasePestRisk, Irrigation,
  Nutrient, FieldOptimization, MissionDecision, Prediction) into a farmer
  + technical explanation, copying `confidence` through verbatim rather
  than inventing one. `DecisionTrace` reuses `KnowledgeGraph.evidenceFor`
  for its observation-discovery step — not a second provenance system.
  `Experiment` (what-if) re-runs the exact same production rule functions
  against hypothetical inputs, tagging every value
  `OBSERVED_REAL_DATA`/`SIMULATED_INPUT`/`DERIVED_OUTPUT`/`HYPOTHETICAL_RESULT`;
  a hypothetical result is never written back as an Observation.
- **Production hardening** (Phase 15, `src/diagnostics/Diagnostics.ts`,
  `src/ui/escapeHtml.ts`): a bounded (500-event ring buffer), in-memory
  structured diagnostics log — severity/category/operation/correlation id,
  never secrets — wired into IndexedDB open/blocked, weather-provider
  fallback, import-pipeline summaries, and mission-safety-validation
  failures. Every UI panel escapes untrusted (file-derived or free-text)
  strings before `innerHTML` interpolation; CSV/GeoJSON imports are capped
  (rows, field length, polygon vertices) against oversized/malicious input.
  No telemetry leaves the browser.

## Real Earth observation: Sentinel-2 ("Push 1")

The remote-sensing gap called out through every earlier phase — real
vegetation-index math with no real imagery ever feeding it — is closed for
the first time here, live-verified rather than assumed. Nothing in this
section is a fixture.

- **`src/satellite/SentinelStacProvider.ts`**: real Sentinel-2 L2A access
  via Microsoft Planetary Computer's public STAC API — no API key for
  search; individual band assets are Cloud-Optimized GeoTIFFs on Azure Blob
  Storage that require a short-lived SAS token from Planetary Computer's
  documented public `/api/sas/v1/sign` endpoint (never bypassed). Modeled
  on `weather/OpenMeteoProvider.ts`'s injectable-fetch + timeout/error
  pattern, not `data/DatasetProvider.ts`'s parameterless `discover()` (a
  satellite search is inherently parameterized by bbox/date range).
  Deterministic scene selection: must carry the required bands, must have a
  known cloud-cover value, lowest cloud cover wins, most recent breaks
  ties — never "first result."
- **`src/satellite/SentinelRasterBuilder.ts`**: reads real pixels straight
  out of the remote COG via HTTP range requests (the `geotiff` package —
  never a full ~100MB+ band download) into the **existing**
  `data/Raster.ts` `RasterGrid`/`RasterMetadata` — no parallel pixel-raster
  type was introduced. The field's WGS84 bbox is reprojected into the
  scene's native UTM zone with `proj4` (the zone is derived from the
  scene's own `proj:epsg`, validated against Sentinel-2's actual UTM EPSG
  ranges before use, never trusted blindly). Digital numbers are converted
  to reflectance per ESA's documented, processing-baseline-dependent rule
  (`/10000`, with a `-1000` offset for baseline ≥ 04.00) —
  `satellite/SentinelReflectance.ts`.
- **`src/satellite/SentinelFieldPipeline.ts`**: clip → per-pixel NDVI →
  statistics → Observation, built entirely from **existing** modules —
  `data/FieldClip.ts` for clipping, `data/SpatialStatistics.ts` for every
  statistic (mean/min/max/median/stddev, none reimplemented),
  `sensing/SpectralIndex.ts`'s own published NDVI formula for the per-pixel
  math, and `sensing/IndexEngine.ts` + `sensing/indexResultToObservation.ts`
  (unmodified) for the canonical field-mean Observation. Raw band
  reflectance Observations are `provenance: 'EXTERNAL'`; the derived NDVI
  Observation is `provenance: 'ESTIMATED'` — never `SIMULATED`, never
  `PREDICTED`. A field that doesn't intersect the retrieved raster throws
  rather than returning an empty-looking success.
- **`src/world/realTestField.ts`**: a second, real, non-Null-Island WGS84
  location (genuine Iowa cropland) alongside — never replacing — the
  existing `DEMO_ONLY` demo field. Boundary provenance is honestly
  `USER_DRAWN` (a hand-specified ~300m square), not `SURVEYED`.
- **UI**: a new Satellite panel (`ui/SatellitePanel.ts` +
  `ui/SatelliteFieldView.ts`, the latter reusing `ui/GeoView.ts`'s
  projection approach for a second, independent field) with an explicit
  "Fetch real Sentinel-2 imagery" button — this is a real, on-demand
  network operation, never fetched automatically at startup. LOADING/ERROR
  states render as honest text ("Satellite data temporarily unavailable:
  …"); a failed fetch never produces a plausible-looking result.
- **Security**: asset/sign URLs are allowlisted to Planetary Computer's own
  hosts (`*.blob.core.windows.net`, `planetarycomputer.microsoft.com`) and
  rejected otherwise; raster dimensions are capped (512×512) before any
  pixel array is allocated; STAC/sign response sizes are capped before
  parsing; every externally-sourced string (scene id, dataset name/source)
  is HTML-escaped before display.
- **Live-verified**: `satellite/SentinelIntegration.live.test.ts` performs
  the complete real chain end to end and is skipped by default (enable
  with `AGRIAETHER_LIVE_SATELLITE_TESTS=1`) — never part of normal/offline
  CI, never silently "passing" without a real network call.
- **Still not connected**: this milestone is deliberately Sentinel-2 (real
  vegetation index) only — no drone imagery ingestion, no field
  sectioning/management zones, no ML model, no crop-specific thresholds.
  See `PublicDatasetEvaluation.ts`'s Sentinel-2 entry (`verdict:
  'INTEGRATED'`) for the full accessibility/licensing/methodology record.

## Real ML + evidence-based field sectioning ("Push 2")

Builds on Push 1's real NDVI, not a rewrite of it. See `ml/README.md` for
the full ML reproducibility record (dataset, metrics, licensing).

- **`src/analysis/FieldSectioning.ts`**: the first real producer of
  `Zone.classification = 'GIS_DERIVED'` — reserved for this since Phase 2.
  Deterministic 1D k-means over real per-pixel NDVI (seeded from sorted-
  value quantiles, never `Math.random`) → 4-connected flood fill into
  spatial regions → a documented minimum-region-size filter → each
  surviving region becomes a real `Zone` (geometry = union of its raster
  cells as a `MultiPolygon`) plus a `ZoneGenerationRecord` (method,
  parameters, source observation/dataset ids, real
  `data/SpatialStatistics.ts` mean/stddev — nothing reimplemented). A zone
  means "similar NDVI under this clustering," never a claim about soil,
  disease, yield, or treatment need.
- **`src/agriculture/CropProfile.ts`**: Corn and Soybeans only — the two
  classes AgriAether's real trained model was evaluated on. Every
  numeric-threshold field is `null` and `hasValidatedThresholds: false`;
  no agronomic threshold is invented. `sensing/DiseasePestSignal.ts` now
  optionally accepts a `cropProfile` and annotates its result with which
  risk factors are crop-relevant — the underlying risk-factor logic is
  completely unchanged, so every pre-Push-2 caller sees identical
  behavior.
- **Real ML** (`ml/`): a frozen `Prithvi-EO-2.0-tiny-TL` encoder
  (Apache-2.0, 129MB, the smallest official Prithvi-EO-2.0 checkpoint) +
  one real trained `nn.Linear` head, on the official
  `ibm-nasa-geospatial/multi-temporal-crop-classification` (CC-BY-4.0)
  dataset (3,854 chips total). An initial 80-train/40-validation run
  scored only 35% validation accuracy; a full ML-quality audit found the
  real bottleneck was chip-level label noise on a 13-class task (mean
  dominant-class purity ~27%), not the model. The task was redesigned to
  **binary Crop vs. Non-Crop** with a purity filter (≥0.6, applied
  identically to both splits), and the sample was expanded to 1,600
  verified train / 151 verified validation chips (720/180 requested
  before that; 29 validation chips were permanently rate-limited on
  retry and are honestly recorded as skipped, never silently dropped),
  yielding **368 train / 73 validation** purity-filtered samples. Real
  validation
  accuracy: **93.15%** (balanced accuracy 93.20%, macro F1 93.02%, vs. a
  57.53% majority-class baseline) — see `ml/README.md` for the full audit
  (leakage checks, error inspection, and two negative capacity
  experiments with a 100M-parameter encoder that did not beat this
  result). `sensing/ModelRegistry.ts`'s `TRAINED_MODELS` entry is
  `STAGED`, not `DEPLOYED` — the live Sentinel-2 pipeline doesn't yet
  supply this model's required 6-band/3-timestep input, so no live-field
  accuracy claim is made. `sensing/PredictionImport.ts` is the
  Python-artifact → `PredictionRecord` adapter, tested against a
  committed real prediction artifact
  (`ml/manifests/sample_predictions.json`) — no PyTorch runtime in the
  browser, no inference microservice.
- **Domain shift, enforced structurally, not just documented**:
  `PredictionRecord.inputSource` (`'LIVE_FIELD' | 'MODEL_VALIDATION_DATA' |
  'UNKNOWN'`) exists specifically so a benchmark-chip prediction can never
  be silently presented as live-field data. Every prediction in this
  codebase today is `'MODEL_VALIDATION_DATA'` — the live Sentinel-2
  pipeline only fetches RED+NIR at one date, not the 6-band/3-timestep
  input this model needs, so no field (including the real Iowa test
  field) has ever actually been fed to it. `sensing/RecommendationEngine.ts`'s
  new `recommendFromSectionEvidence` reflects this: even a confident
  prediction only ever proposes "verify with a ground observation," never
  a confirmed identity.
- **UI**: the Satellite panel (`ui/SatellitePanel.ts`) gained a "Generate
  evidence-based management zones" button (only enabled after a real
  Sentinel-2 fetch), a real per-zone stats list, and a Model section
  showing the real STAGED model's real metrics with an explicit
  UNVERIFIED-for-this-field notice. `ui/SatelliteFieldView.ts` now draws
  real zone polygon outlines over the real NDVI heatmap.
- **Not done in this milestone**: no live-field ML prediction (blocked on
  extending the raster pipeline to 6 bands / 3 timesteps — see
  `ml/README.md`'s domain-shift section), no drone imagery, no
  fine-tuning of the encoder itself (frozen throughout), no crops beyond
  Corn/Soybeans.

## Machine Learning (summary)

A quick-reference version of the "Real ML" section above — everything here
is a real, reproducible result from `ml/`, not a target or an estimate.

**A. Task**: Crop vs. Non-Crop classification (binary).

**B. Model**: `Prithvi-EO-2.0-tiny-TL` — frozen encoder (Apache-2.0,
IBM/NASA) + one trained `nn.Linear` head. No other model is active.

**C. Dataset**: official `ibm-nasa-geospatial/multi-temporal-crop-classification`
(CC-BY-4.0), labels derived from the USDA Cropland Data Layer.

**D. Input**: 6-band HLS surface reflectance (Blue/Green/Red/NIR/SWIR1/SWIR2)
× 3 timesteps, 224×224px @ 30m — the exact input Prithvi-EO-2.0 expects.

**E. Data volume** (three distinct numbers — do not conflate them):

| Stage | Train | Validation |
|---|---:|---:|
| Original dataset | 3,854 chips total (official 80/20 split) | |
| Downloaded & integrity-verified | 1,600 | 151 (29 permanently skipped after repeated CDN rate-limiting — recorded, not hidden) |
| After binary purity filter (≥0.6, applied identically to both) | **368** | **73** |

**F. Evaluation** (on the 73-sample validation set, official split, zero
chip-ID overlap with training):

| Metric | Result |
|---|---:|
| Validation accuracy | 93.15% (68/73) |
| Balanced accuracy | 93.20% |
| Macro F1 | 93.02% |
| Non-Crop precision / recall / F1 | 95.1% / 92.9% / 94.0% |
| Crop precision / recall / F1 | 90.6% / 93.5% / 92.1% |
| Abstentions (confidence < 0.5) | 0 / 73 |
| Training accuracy | 98.91% (368 samples) |

**G. Baseline**: 57.53% (always predicting the majority class). The trained
model beats it by 35.6 points.

**H. Integrity**: official dataset split preserved end-to-end; zero
chip-ID overlap between train/validation; purity filtering applied
identically to both splits (audited, not asymmetric); zero corrupted or
wrong-shape files among verified chips; the 73-sample validation set was
held completely frozen across every comparison experiment (fingerprint-
checked before each run). One audit caveat, disclosed rather than hidden:
the dataset's *official* split is random, not geographically buffered, so
some train/validation chip pairs are geographically adjacent — see
`ml/README.md` for the measured distances and what that does and doesn't
imply.

**I. Limitations**:
- **These are benchmark validation results for the evaluated
  Crop-vs-Non-Crop task. They are not a claim of 93.15% accuracy on
  arbitrary real-world farms.** AgriAether's live Sentinel-2 pipeline
  currently fetches RED+NIR at a single date; this model needs 6 bands ×
  3 timesteps — the live field pipeline and the trained model's input
  requirements are **not yet equivalent** for validated live-field
  inference. No field in this codebase (including the real Iowa test
  field) has ever been fed to this model, and no `PredictionRecord`
  claims `inputSource: 'LIVE_FIELD'`.
- 73 validation samples is a real but small evaluation; the 95% Wilson
  confidence interval is roughly [85%, 97%] — wide enough that 93.15%
  should be read as "genuinely strong on this benchmark," not as a
  precise, tight number.
- Two negative capacity experiments (a 100M-parameter frozen encoder, and
  partial fine-tuning of its last block) did not beat this result — see
  `ml/README.md`. The task's chip-level label-noise ceiling, not model
  capacity, is the binding constraint.
- Deployment status is `STAGED`, not `DEPLOYED` (see `ModelRegistry.ts`) —
  intentionally, until live-field input compatibility and field-specific
  ground truth exist.

## Real / staged / simulated

Every capability below is labeled by what it actually is today — not
what it's designed to eventually become.

| Capability | Status |
|---|---|
| Sentinel-2 satellite imagery ingestion | ✅ Real |
| Reflectance conversion + NDVI | ✅ Real |
| Geospatial field processing (CRS, clipping, spatial stats) | ✅ Real |
| Evidence-based management zones (GIS_DERIVED) | ✅ Real |
| Crop profiles (Corn, Soybeans) | ✅ Real |
| Agricultural analysis / spectral index engine | ✅ Real (gated on real band availability) |
| Disease/pest evidence logic | ✅ Real (evidence, not diagnosis) |
| Recommendation engine | ✅ Real |
| Trained agricultural ML benchmark (Crop vs. Non-Crop) | ✅ Real — see "Machine Learning" |
| Digital Twin | ✅ Real |
| Knowledge Graph | ✅ Real |
| Persistence (IndexedDB) | ✅ Real |
| Reporting / UI | ✅ Real |
| ML model for **live-field** inference | 🟡 Staged — model is real and benchmarked, but the live Sentinel-2 pipeline doesn't yet supply its required 6-band/3-timestep input |
| Any prediction requiring field-specific ground truth | 🟡 Staged — validation-required |
| Drone flight, camera, GPS/IMU/soil hardware | 🔵 Simulated — `SimulatedFlightController` only; `UnimplementedRealHardwareDevice` always fails into `ERROR` rather than faking a reading |
| Autonomous mission planning / fleet management | 🔵 Simulated — real planning logic, simulated execution |
| Remote cloud sync | 🔵 Not implemented — `OfflineSync.ts` never reports `SYNCED` |

## Technology stack

- **Frontend**: TypeScript, Vite, Three.js (3D scene), Vitest (469 tests)
- **Geospatial**: Turf.js, `geotiff`, `proj4` — no hand-rolled GIS engine
- **ML pipeline** (`ml/`, separate from the npm app): Python, PyTorch,
  a frozen Prithvi-EO-2.0 encoder (IBM/NASA)
- **Persistence**: IndexedDB (browser), with an in-memory fallback for
  tests/non-browser environments
- **External data**: Open-Meteo (weather, keyless), Microsoft Planetary
  Computer (Sentinel-2 STAC), Hugging Face / Source Cooperative (the ML
  benchmark dataset)

## Quick start

```bash
npm install
npm run dev        # start the Vite dev server
npm run typecheck  # tsc --noEmit
npm run test       # vitest
npm run build      # typecheck + production build
```

No `.env` file is required to run the app — see "Security," above.
For the ML pipeline (a separate Python environment, not part of the npm
app), see `ml/README.md`.

## Configuration

`.env.example` documents the one environment variable this project's
pattern supports (`VITE_WEATHER_API_KEY`) — unused today, since the
active weather provider (Open-Meteo) is keyless. Copy it to `.env` only
if you're wiring in a provider that needs one; see the Security section
above for why a real secret can't be safely used directly from this
frontend as it stands.

## Testing

```bash
npm run test        # vitest — 469 tests across 101 files
npm run typecheck    # tsc --noEmit
npm run build        # full production build
```

CI (`.github/workflows/ci.yml`) runs all three on every push and pull
request to `main`, plus a lightweight Python syntax/manifest-integrity
check for `ml/` (it does not download the multi-GB dataset on every run
— see `ml/README.md` to reproduce the ML pipeline locally).

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
                barometer/battery sensors; Phase 6 added GroundSample (+
                groundSampleToObservations) for non-soil ground/fixed-
                station quantities
  telemetry/    TelemetryGenerator — the only place DroneState becomes
                Observations
  domain/       Farm, Field, Zone, Crop, SensorRecord, SensorDeployment,
                AgriculturalEvent, GeoReference — plain data + factories,
                no persistence or UI knowledge; Phase 6 added
                CropObservation (point-in-time, distinct from CropCycle)
  geo/          Coordinate/CRS types, Turf-based geometry utilities, the
                DEMO_ONLY georeference transform, demo geometry fixtures
  weather/      WeatherObservation, WeatherProvider (+ OpenMeteoProvider,
                MockWeatherProvider), normalization/validation,
                WeatherService (cache + staleness)
  soil/         SoilSample (method-implies-provenance),
                soilSampleToObservations (+ sensor-capability guard),
                SoilDataProvider (Phase 6, unconfigured — see above)
  sensing/      Remote-sensing taxonomy, SpectralIndex/IndexEngine,
                ThermalReading/features, AgriculturalAnalysis,
                AnalysisRegistry, ModelRegistry, TemporalChange,
                SpatialAggregation, SensorFusion, SensorHealth, Lineage,
                DataQuality, ImageAsset — the Phase 4 sensing/analytics
                architecture; synthetic/ holds the seeded test-only
                dataset generator; Phase 6 added Units.ts and
                ObservationQuery.ts
  data/         Phase 5: DatasetRecord registry, GeoJsonIngestion,
                CrsTransform, Raster/RasterGrid, FieldClip,
                SpatialStatistics, TemporalAlignment, Coverage, DataGap,
                MissionDataRequirement, FieldSummary, ImportJob,
                AssetSecurity, ProcessingStep (lineage); fixtures/ holds
                the deterministic test-only raster fixture; Phase 7 added
                DataSource, PublicDatasetEvaluation, CsvImport,
                ImportValidation, ImportPipeline, ImportIdentity
  world/        WorldRegistry (referential-integrity index + lookups),
                demoWorld.ts (the one seeded fixture)
  persistence/  Repository<T> interface, InMemoryRepository,
                IndexedDbRepository, repositories.ts factory
  ui/           Hud, Minimap, WorldPanel, DataInspector, GeoView,
                WeatherPanel, AnalysisRegistryPanel, DataCatalogPanel,
                ImportPanel (Phase 7) — render domain state/Observations,
                compute nothing
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
6. ~~Ground sensor architecture + measurement contracts~~ — this
   repository, Phase 6: new ground/fixed-station sensor kinds (leaf
   wetness, solar radiation, irrigation flow, water quality) and
   `GroundSample`/`groundSampleToObservations` alongside `SoilSample`,
   explicit tested unit conversions (`sensing/Units.ts`) and an
   `OUT_OF_RANGE` data-quality state, a point-in-time `CropObservation`
   distinct from `CropCycle`, an intentionally unconfigured
   `SoilDataProvider` interface, source-category grouping in
   `SensorFusion`, temporal `ObservationQuery` helpers, and the Data
   Catalog's new Ground Observations / Sensor Capability Registry
   sections — still no real ground-sensor hardware, no soil data provider,
   and no crop-health scoring of any kind.
7. ~~Real agricultural data ingestion + field data platform~~ — this
   repository, Phase 7: a `DataSource` registry distinguishing what's
   actually connected from what's evaluated-but-unconfigured, a generic
   CSV import pipeline (parse → map columns → validate → normalize →
   dedupe → Observation), a GeoJSON field-boundary import path with
   explicit CRS rejection, deterministic import identity for idempotent
   re-imports, an auditable `ImportReport` persisted per run, upload
   security checks reused from Phase 5's `AssetSecurity`, an evaluated-
   but-unintegrated public dataset survey, and Data Catalog / Observation
   Inspector sections surfacing sources and import history — still no
   live external dataset provider beyond the existing weather pipeline.
8. ~~Soil intelligence~~ — this repository, Phase 8: `SoilSample` gained
   `location`, `textureClass` (the 12-class USDA texture taxonomy), and
   `confidence`; the new `soil/SoilQuality.ts` adds deterministic
   moisture/EC/pH status bands, per-measurement OUT_OF_RANGE detection, and
   measurement-completeness reporting; `soilSampleToObservations` carries
   location/confidence through and gained a `soil.texture` observation
   path; `WorldRegistry` now validates a soil sample's zone actually
   belongs to its field; the Data Catalog's soil rows show real quality/
   completeness — still no soil-health score, no fertilizer
   recommendation, no spatial interpolation, and no live soil data
   provider.
9. ~~Sensor fusion, Digital Twin, temporal intelligence, Knowledge Graph~~ —
   Phase 10 (see "Phases 10–15" above).
10. ~~Decision intelligence~~ — Phase 11: `ModelRegistry` gained a feature
    schema/dataset version/train-eval timestamps and `PredictionRecord`
    provenance, `RecommendationEngine`, `IrrigationIntelligence`,
    `NutrientIntelligence`, and `FieldOptimization`.
11. ~~Autonomous drone operations~~ — Phase 12: agricultural mission
    planning, `AutonomyEngine`, edge-inference and hardware abstractions,
    and a fleet-assignment foundation — simulation-only throughout (see
    below).
12. ~~Farmer, community, offline, and localization foundations~~ — Phase 13.
13. ~~Explainability, decision traces, and research/experiment
    foundations~~ — Phase 14.
14. ~~Production hardening, security, and reliability~~ — Phase 15 (this
    milestone).

**Still not started / genuinely open:**
- ~~A first real trained ML model~~ — done: a real Prithvi-EO-2.0-tiny-TL
  (frozen) + trained linear head Crop-vs-Non-Crop classifier, 93.15%
  validation accuracy on a real, official, leakage-checked benchmark (see
  "Machine Learning" below and `ml/README.md`). What's still open: this
  model is `STAGED`, not `DEPLOYED` — it has never been fed a real
  AgriAether field, because the live Sentinel-2 pipeline doesn't yet fetch
  the 6-band/3-timestep input it requires. Every live-field prediction
  request still returns `NOT_AVAILABLE` with a stated reason.
- ~~A real (non-`DEMO_ONLY`) field boundary / CRS pipeline exercised
  end-to-end~~ — done: `world/realTestField.ts` is a real, non-Null-Island
  WGS84 field, and `satellite/` ingests real Sentinel-2 imagery against it
  (see "Real Earth observation: Sentinel-2" above). Field sectioning/
  management zones, drone imagery, and crop-specific thresholds remain
  not started.
- **Real hardware.** No flight controller, GPS, IMU, camera, or
  soil/environmental sensor is ever connected — `SimulatedFlightController`
  is the only implementation that can reach `CONNECTED`,
  `UnimplementedRealHardwareDevice` always fails into `ERROR`.
- **A real remote sync backend.** `OfflineSync.ts` is honest that one
  doesn't exist; `deriveSyncStatus` never reports `SYNCED`/`PENDING`.

## Limitations

- **Research/demo stage, not production.** No real hardware, no live ML
  field inference, no remote sync backend — see "Real / staged /
  simulated" above.
- **The 93.15% ML result is a benchmark number**, not a live-field
  accuracy claim — see "Machine Learning" for the full caveat.
- **Two crops configured** (Corn, Soybeans) — `CROP_PROFILES` in
  `src/agriculture/CropProfile.ts` — because those are the only two with
  a validated data source in this project; no other crop's agronomic
  thresholds are invented.
- **One real external dataset provider beyond weather and Sentinel-2** —
  everything else in the ingestion pipeline (CSV/GeoJSON import) is
  user-supplied data, not a live third-party feed.
- Large chunk-size build warning (`dist/assets/index-*.js` ~926KB) is a
  known, un-addressed item — not a functional bug, just unsplit.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for
setup, test requirements, and this project's coding expectations
(provenance/honesty is load-bearing here, not optional). This project
follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Found a security
issue? See [SECURITY.md](SECURITY.md) — please don't open a public issue
for it.

## License and attribution

AgriAether's own source code is [MIT licensed](LICENSE). Third-party
components keep their own licenses — this project does not, and cannot,
relicense them:

| Component | License / terms | Source |
|---|---|---|
| AgriAether source code (this repository) | MIT | — |
| Prithvi-EO-2.0 (encoder + vendored model code) | Apache 2.0 | IBM / NASA (`ibm-nasa-geospatial`) |
| `multi-temporal-crop-classification` dataset | CC-BY-4.0 | Clark University CGA / IBM-NASA |
| Sentinel-2 imagery | Copernicus (free & open) | ESA / Copernicus Programme, via Microsoft Planetary Computer |
| Weather data | Open-Meteo (keyless, free tier) | Open-Meteo.com |
| npm / PyPI dependencies | Various (see `package.json` / `ml/requirements.txt`) | Respective authors |

AgriAether does not vendor, redistribute, or claim ownership of any
external dataset or pretrained model — `ml/data/`, `ml/checkpoints/`, and
`ml/.venv/` are gitignored and reproduced locally via the scripts in
`ml/README.md`, never committed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for the full detail, and [CHANGELOG.md](CHANGELOG.md) for release history.

## Citation

If you use AgriAether in academic or research work, see
[CITATION.cff](CITATION.cff) for citation metadata (also available via
GitHub's "Cite this repository" button).

## Acknowledgements

- **[Prithvi-EO-2.0](https://huggingface.co/ibm-nasa-geospatial/Prithvi-EO-2.0-tiny-TL)** — IBM & NASA's geospatial foundation model, used here as a frozen encoder.
- **[multi-temporal-crop-classification](https://huggingface.co/datasets/ibm-nasa-geospatial/multi-temporal-crop-classification)** — the official benchmark dataset this project's ML result is trained and evaluated on.
- **[Copernicus / Sentinel-2](https://dataspace.copernicus.eu/)** and **[Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/)** — real satellite imagery access.
- **[Open-Meteo](https://open-meteo.com/)** — keyless weather data.
- **[Turf.js](https://turfjs.org/)**, **[geotiff.js](https://geotiffjs.github.io/)**, **[proj4js](http://proj4js.org/)** — the geospatial primitives this project builds on rather than reimplementing.
