/**
 * Phase 7, Part 9 — research into real, publicly accessible agricultural
 * datasets that AgriAether *could* integrate. This module records the
 * evaluation as data (so the README and Data Catalog can both cite it) and
 * deliberately wires up none of them as a live network provider.
 *
 * Why none is connected yet: every strong candidate is either (a) a
 * *modeled/estimated* surface, not a measurement, and this codebase's
 * scientific-honesty rule is that modeled soil/weather estimates must never
 * be presented as measured ground truth (see observation/Observation.ts and
 * the README's "Scientific honesty" section), or (b) requires an API key /
 * registration this environment cannot obtain and verify right now, or (c)
 * has a download/API shape (bulk rasters, per-county SOAP-era services)
 * that doesn't fit a browser-only, no-server architecture without a real
 * proxy — which Part 18 forbids adding for this phase. This mirrors the
 * decision already made for soil data in Phase 6 (see soil/SoilDataProvider.ts).
 *
 * If a future phase adds a small serverless proxy or an API-key input, the
 * `verdict: 'INTEGRATE_LATER'` candidates below are the ones worth revisiting
 * first — see DataSource.ts's `RESEARCH_DATASET` type and `ingestionStatus:
 * 'UNCONFIGURED'` for the seam that integration would use.
 */

export type DatasetMethodology = 'MEASURED' | 'MODELED' | 'ESTIMATED' | 'MIXED';

export interface PublicDatasetEvaluation {
  name: string;
  publisher: string;
  url: string;
  accessibility: string;
  licensing: string;
  geographicMeaning: string;
  temporalMeaning: string;
  methodology: DatasetMethodology;
  methodologyNotes: string;
  apiStability: string;
  suitability: string;
  verdict: 'NOT_SUITABLE' | 'INTEGRATE_LATER' | 'INTEGRATED';
}

export const PUBLIC_DATASET_EVALUATIONS: PublicDatasetEvaluation[] = [
  {
    name: 'Open-Meteo Weather Forecast & Historical API',
    publisher: 'Open-Meteo (open-source, aggregates national weather services)',
    url: 'https://open-meteo.com',
    accessibility: 'Free, no API key required, plain HTTPS JSON.',
    licensing: 'CC BY 4.0 (attribution required).',
    geographicMeaning: 'Global grid, interpolated to a requested lat/lon point — not a station reading at that exact point.',
    temporalMeaning: 'Real-time current conditions plus forecast and historical reanalysis.',
    methodology: 'MIXED',
    methodologyNotes: 'Current/historical values are reanalysis-model output blended with station and satellite data, not a raw station reading; already labeled EXTERNAL (never MEASURED) by weather/OpenMeteoProvider.ts.',
    apiStability: 'Public production API, stable schema, already integrated and tested in this codebase.',
    suitability: 'Already the live provider for AgriAether\'s weather pipeline (Phase 5).',
    verdict: 'INTEGRATED'
  },
  {
    name: 'ISRIC SoilGrids 2.0',
    publisher: 'ISRIC — World Soil Information',
    url: 'https://soilgrids.org',
    accessibility: 'Public REST API and bulk raster downloads, no key required.',
    licensing: 'CC BY 4.0.',
    geographicMeaning: 'Global 250m-resolution grid, machine-learning predictions from point soil samples — a coarse spatial estimate, not a per-field soil test.',
    temporalMeaning: 'Static snapshot (no real-time updates); the underlying training data spans decades.',
    methodology: 'MODELED',
    methodologyNotes: 'Explicitly a predicted surface from a digital soil mapping model, not a measurement at any specific point. Presenting a 250m-cell SoilGrids value as a farm\'s actual soil-moisture or pH reading would violate this codebase\'s MEASURED-vs-EXTERNAL/ESTIMATED distinction.',
    apiStability: 'Documented REST API with rate limits; considered reasonably stable but was not exercised against a live endpoint in this session.',
    suitability: 'Good future ESTIMATED-provenance baseline layer for a real field once one exists, not appropriate to fabricate ground truth for the current DEMO_ONLY field.',
    verdict: 'INTEGRATE_LATER'
  },
  {
    name: 'USDA NASS Quick Stats',
    publisher: 'USDA National Agricultural Statistics Service',
    url: 'https://quickstats.nass.usda.gov',
    accessibility: 'Free REST API, requires a self-service API key.',
    licensing: 'US Government public domain.',
    geographicMeaning: 'County/state/national aggregate statistics (yield, planted acreage) — never field-level.',
    temporalMeaning: 'Annual survey/census data, published with a multi-month lag.',
    methodology: 'MEASURED',
    methodologyNotes: 'Aggregated from farmer-reported surveys and objective yield measurements at the county level; genuinely measured but not at field or point resolution.',
    apiStability: 'Long-running US government API, stable.',
    suitability: 'Wrong spatial resolution for a per-field/per-zone Observation — would need an aggregate-level Observation context this codebase does not yet model, and an API key this environment cannot register for right now.',
    verdict: 'NOT_SUITABLE'
  },
  {
    name: 'NASA POWER Agroclimatology',
    publisher: 'NASA Langley Research Center',
    url: 'https://power.larc.nasa.gov',
    accessibility: 'Free REST API, no key required.',
    licensing: 'Public domain (US Government).',
    geographicMeaning: '0.5° x 0.5° satellite/reanalysis grid (~50km cells) — far coarser than field scale.',
    temporalMeaning: 'Daily/hourly historical time series, multi-decade record.',
    methodology: 'ESTIMATED',
    methodologyNotes: 'Derived from satellite retrievals and atmospheric model reanalysis, not ground instruments.',
    apiStability: 'Stable, long-running NASA service.',
    suitability: 'Coarser and less field-relevant than the already-integrated Open-Meteo pipeline; no clear benefit to adding a second weather-shaped external source in this phase.',
    verdict: 'NOT_SUITABLE'
  },
  {
    name: 'USDA SSURGO (Soil Survey Geographic Database)',
    publisher: 'USDA Natural Resources Conservation Service',
    url: 'https://www.nrcs.usda.gov/resources/data-and-reports/soil-survey-geographic-database-ssurgo',
    accessibility: 'Bulk downloads (state-by-state shapefiles/geodatabases, multi-GB) or a SOAP-style Soil Data Access web service.',
    licensing: 'US Government public domain.',
    geographicMeaning: 'US-only, field-scale soil map units from physical field surveys — genuinely high-resolution.',
    temporalMeaning: 'Static survey data, revised infrequently.',
    methodology: 'MEASURED',
    methodologyNotes: 'Built from real soil surveys and pedon measurements, unusually trustworthy for a public dataset — but delivered as map-unit polygons with associated lab data, not point observations.',
    apiStability: 'Web service exists but is awkward (SOAP/XML) for a browser-only client with no backend proxy (see Part 18 of this phase\'s architectural rule).',
    suitability: 'US-only and requires either a multi-GB bulk download or a server-side proxy this phase deliberately does not add — a strong future candidate, not practical to wire up live here.',
    verdict: 'INTEGRATE_LATER'
  },
  {
    name: 'Sentinel-2 L2A (via Microsoft Planetary Computer STAC API)',
    publisher: 'European Space Agency (Copernicus) / hosted and cataloged by Microsoft Planetary Computer',
    url: 'https://planetarycomputer.microsoft.com/api/stac/v1',
    accessibility: 'Free, no API key for STAC search; individual Cloud-Optimized GeoTIFF assets require a short-lived SAS token from Planetary Computer\'s public /api/sas/v1/sign endpoint — a documented, keyless signing mechanism, not a workaround.',
    licensing: 'Copernicus Sentinel Data Terms and Conditions — free and open, attribution required ("Contains modified Copernicus Sentinel data").',
    geographicMeaning: 'Global (excluding poles), 10-20m native resolution per band, real per-scene footprint — genuinely field-scale, unlike every other evaluated candidate in this file.',
    temporalMeaning: 'Real per-scene acquisition timestamp (5-day revisit with two satellites), atmospherically corrected (L2A = bottom-of-atmosphere reflectance).',
    methodology: 'MEASURED',
    methodologyNotes: 'A genuine satellite radiometric measurement, atmospherically corrected by ESA\'s Sen2Cor processor — not a model/reanalysis surface like every weather/soil candidate above. Digital numbers require a documented, baseline-dependent conversion to reflectance (DN/10000, with a -1000 BOA offset for processing baseline >= 04.00) — see satellite/SentinelReflectance.ts. AgriAether never assigns provenance MEASURED to the derived NDVI Observation itself (that stays ESTIMATED, per Observation.ts\'s own rule that a derived/computed value is never MEASURED); the raw band reflectance Observations are provenance EXTERNAL.',
    apiStability: 'Public production STAC API; live-tested end-to-end (search -> scene selection -> SAS signing -> windowed COG read via HTTP range requests -> NDVI) during this phase\'s development — see satellite/SentinelIntegration.live.test.ts.',
    suitability: 'The first genuinely field-relevant, measured (not modeled/interpolated) remote-sensing data source this codebase has integrated — see satellite/SentinelStacProvider.ts.',
    verdict: 'INTEGRATED'
  }
];
