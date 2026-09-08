# Changelog

All notable changes to AgriAether are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] — 2026-09-09

First public release.

### Added
- Farm/Field/Zone/Sensor domain model, simulation core, and a
  Farm/Field/Zone-aware geospatial layer.
- Real external data: Open-Meteo weather, and real Sentinel-2 L2A
  satellite imagery (via Microsoft Planetary Computer) with reflectance
  conversion and real per-pixel NDVI.
- Evidence-based management zones (`GIS_DERIVED`), computed from real
  NDVI clustering, never a placeholder.
- A real, trained agricultural ML benchmark: Prithvi-EO-2.0-tiny-TL
  (frozen encoder) + a trained linear head, Crop-vs-Non-Crop
  classification, **93.15% validation accuracy** (balanced accuracy
  93.20%, macro F1 93.02%, vs. a 57.53% majority baseline) on the
  official `ibm-nasa-geospatial/multi-temporal-crop-classification`
  benchmark — see `ml/README.md` for the full audit trail, including two
  documented negative capacity experiments. This is a **benchmark**
  result; the model is `STAGED`, not `DEPLOYED`, and no live-field
  prediction has ever been made (the live Sentinel-2 pipeline doesn't yet
  supply the model's required 6-band/3-timestep input).
- Digital Twin and Knowledge Graph of farm state.
- Agricultural recommendation, irrigation, and nutrient intelligence.
- Simulation-first autonomous mission planning, edge inference, and
  fleet-management architecture.
- Farmer/community/offline/localization layers.
- Explainability and research/experimentation tooling.
- CSV/GeoJSON import pipeline with validation, deduplication, and an
  auditable import report.
- Public-release scaffolding: MIT license, CI (typecheck/test/build +
  CodeQL), issue/PR templates, Dependabot, contribution/security/conduct
  policies.

### Known limitations
- No live-field ML inference (see above).
- No real hardware (drone flight controller, camera, GPS/IMU, soil
  sensors) is connected — simulated throughout.
- No remote cloud sync backend.
- Two crops configured (Corn, Soybeans) — the only two with a validated
  data source in this project.
