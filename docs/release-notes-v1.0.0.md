## AgriAether v1.0.0 — first public release

AgriAether is an AI-powered agricultural intelligence platform combining
real Sentinel-2 satellite imagery, geospatial field analysis, a trained
crop-classification ML benchmark, evidence-based management zones, a
Digital Twin / Knowledge Graph, and a simulation-first autonomous
field-operations architecture.

### Highlights

- **Real Sentinel-2 integration**: real L2A imagery (via Microsoft
  Planetary Computer), reflectance conversion, and real per-pixel NDVI —
  not a placeholder or synthetic raster.
- **GIS-derived management zones**: evidence-based field sectioning from
  real NDVI clustering (`GIS_DERIVED` zones), with per-zone statistics
  and lineage.
- **A real, trained agricultural ML benchmark**: Prithvi-EO-2.0-tiny-TL
  (frozen encoder, IBM/NASA, Apache-2.0) + a trained linear head, on the
  official `ibm-nasa-geospatial/multi-temporal-crop-classification`
  dataset. Task: binary Crop vs. Non-Crop.
  - **93.15% validation accuracy** (68/73), **93.20% balanced accuracy**,
    **93.02% macro F1**, vs. a 57.53% majority-class baseline, 0/73
    abstentions.
  - Full data chain, disclosed: 3,854-chip original dataset →
    1,600 train / 151 validation downloaded & integrity-verified →
    368 train / 73 validation after a ≥0.6 purity filter.
  - **This is a benchmark result, not a live-field accuracy claim.** The
    live Sentinel-2 pipeline currently fetches RED+NIR at a single date;
    this model needs 6 bands × 3 timesteps. No field has ever been fed to
    this model. Model status is `STAGED`, not `DEPLOYED`.
  - Two negative capacity experiments (a 100M-parameter frozen encoder,
    and partial fine-tuning) did not beat this result — see
    `ml/README.md` for the full audit trail, including a disclosed
    geographic-adjacency caveat in the dataset's official split.
- **Digital Twin & Knowledge Graph** of farm/field/zone/sensor state.
- **Explainable recommendation engine** (irrigation, nutrient,
  general field recommendations) with decision traces.
- **Simulation-first autonomous mission planning**: waypoint generation,
  fleet assignment, edge-inference and hardware abstractions —
  architecturally real, execution simulated (no real flight hardware is
  connected).
- **Farmer/community/offline/localization** foundations.
- **Explainability and research/experimentation tooling.**
- **CSV/GeoJSON import pipeline** with validation, deduplication, and an
  auditable import report.

### Known limitations (disclosed, not hidden)

- No live-field ML inference — see above.
- No real hardware (drone flight controller, camera, GPS/IMU, soil
  sensors) — simulated throughout; `UnimplementedRealHardwareDevice`
  always fails into `ERROR` rather than faking a reading.
- No remote cloud sync backend.
- Two crops configured (Corn, Soybeans) — the only two with a validated
  data source in this project.
- The ML benchmark's 73-sample validation set gives a 95% Wilson
  confidence interval of roughly [85%, 97%] — read 93.15% as "genuinely
  strong," not a precise figure.

See the [README](https://github.com/soyebmohammad03-dev/AgriAether#readme)
for the full "Real / staged / simulated" breakdown and
[`ml/README.md`](https://github.com/soyebmohammad03-dev/AgriAether/blob/main/ml/README.md)
for the complete ML audit trail.
