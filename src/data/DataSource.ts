import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';

/**
 * Every kind of agricultural data origin the ingestion layer knows how to
 * describe. Adding a new value here does NOT mean a provider is connected —
 * see `ingestionStatus` on DataSourceRecord for that. This is the taxonomy
 * from the Phase 7 brief, kept as data rather than scattered string literals.
 */
export type DataSourceType =
  | 'DRONE'
  | 'GROUND_SENSOR'
  | 'WEATHER_API'
  | 'SATELLITE'
  | 'FARMER_ENTRY'
  | 'RESEARCH_DATASET'
  | 'CSV_UPLOAD'
  | 'GEOJSON_UPLOAD'
  | 'IOT_GATEWAY'
  | 'MANUAL_OBSERVATION'
  | 'SIMULATION'
  | 'DERIVED';

export type IngestionStatus =
  | 'CONNECTED' // a live provider actually answers requests (e.g. OpenMeteoProvider)
  | 'MANUAL_UPLOAD' // a person supplies a file per import; there is no standing connection
  | 'UNCONFIGURED'; // evaluated but deliberately not wired up — see PublicDatasetEvaluation.ts

export type ReliabilityRating = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

/**
 * The registry record for one origin of agricultural data. This is distinct
 * from DatasetRecord (data/Dataset.ts): a DataSourceRecord describes a
 * *provider* (who/what supplies data, and how trustworthy it generally is);
 * a DatasetRecord describes one *product* that provider produced. One
 * source can back many datasets and many imports.
 */
export interface DataSourceRecord {
  id: string;
  type: DataSourceType;
  provider: string;
  name: string;
  version: string | null;
  isExternal: boolean;
  /** What kind of Observation.provenance this source is allowed to stamp — never asserted per-import, always fixed at registration. */
  nature: Provenance;
  /** Free-text description of spatial coverage (e.g. "single demo field, Null Island"); never a fabricated real-world extent. */
  geographicCoverage: string | null;
  temporalCoverageStart: number | null;
  temporalCoverageEnd: number | null;
  /** Dot-namespaced Observation types this source can plausibly supply. */
  supportedObservationTypes: string[];
  license: string | null;
  attribution: string | null;
  reliability: ReliabilityRating;
  ingestionStatus: IngestionStatus;
  notes: string | null;
  createdAt: number;
}

export function createDataSourceRecord(params: {
  type: DataSourceType;
  provider: string;
  name: string;
  version?: string | null;
  isExternal: boolean;
  nature: Provenance;
  geographicCoverage?: string | null;
  temporalCoverageStart?: number | null;
  temporalCoverageEnd?: number | null;
  supportedObservationTypes: string[];
  license?: string | null;
  attribution?: string | null;
  reliability: ReliabilityRating;
  ingestionStatus: IngestionStatus;
  notes?: string | null;
}): DataSourceRecord {
  if (!params.provider.trim()) throw new Error('DataSource requires a non-empty provider');
  if (!params.name.trim()) throw new Error('DataSource requires a non-empty name');
  if (params.supportedObservationTypes.length === 0) {
    throw new Error(`DataSource "${params.name}" must declare at least one supported observation type`);
  }
  if (params.ingestionStatus === 'CONNECTED' && params.type === 'RESEARCH_DATASET') {
    // A research dataset claiming CONNECTED would imply a live network integration this codebase
    // does not have (see PublicDatasetEvaluation.ts) — refuse rather than let that claim slip in.
    throw new Error(`DataSource "${params.name}" is a RESEARCH_DATASET; it cannot claim ingestionStatus CONNECTED without a real provider implementation.`);
  }
  return {
    id: createId('source'),
    type: params.type,
    provider: params.provider,
    name: params.name,
    version: params.version ?? null,
    isExternal: params.isExternal,
    nature: params.nature,
    geographicCoverage: params.geographicCoverage ?? null,
    temporalCoverageStart: params.temporalCoverageStart ?? null,
    temporalCoverageEnd: params.temporalCoverageEnd ?? null,
    supportedObservationTypes: params.supportedObservationTypes,
    license: params.license ?? null,
    attribution: params.attribution ?? null,
    reliability: params.reliability,
    ingestionStatus: params.ingestionStatus,
    notes: params.notes ?? null,
    createdAt: Date.now()
  };
}

/**
 * The sources this codebase actually knows about out of the box. Every
 * entry here is either genuinely connected (the simulation engine) or
 * explicitly a manual-upload pathway — never a stub pretending to be live.
 * A UI listing "available sources to import from" should read this list,
 * not invent one.
 */
export function builtInDataSources(): DataSourceRecord[] {
  return [
    createDataSourceRecord({
      type: 'SIMULATION',
      provider: 'AgriAether',
      name: 'Simulation Engine',
      isExternal: false,
      nature: 'SIMULATED',
      geographicCoverage: 'Simulated scene only, no real-world referent',
      supportedObservationTypes: ['drone.position', 'drone.orientation', 'drone.altitude', 'drone.battery.soc', 'drone.ground_speed', 'drone.heading'],
      reliability: 'HIGH',
      ingestionStatus: 'CONNECTED',
      notes: 'Always available — this is the app\'s own drone/mission simulator, not a physical instrument.'
    }),
    createDataSourceRecord({
      type: 'CSV_UPLOAD',
      provider: 'user upload',
      name: 'CSV Agricultural Data Import',
      isExternal: true,
      nature: 'UNKNOWN', // fixed per-import by whoever uploads — see ImportPipeline.ts, never assumed MEASURED
      geographicCoverage: 'Whatever the uploaded file contains',
      supportedObservationTypes: ['soil.moisture', 'soil.temperature', 'soil.ec', 'soil.ph', 'air.temperature', 'humidity', 'precipitation'],
      reliability: 'UNKNOWN',
      ingestionStatus: 'MANUAL_UPLOAD',
      notes: 'Provenance must be declared explicitly by the importing user for every import — never defaulted to MEASURED.'
    }),
    createDataSourceRecord({
      type: 'GEOJSON_UPLOAD',
      provider: 'user upload',
      name: 'GeoJSON Field Boundary Import',
      isExternal: true,
      nature: 'EXTERNAL',
      geographicCoverage: 'Whatever the uploaded file contains',
      supportedObservationTypes: ['field.boundary'],
      reliability: 'UNKNOWN',
      ingestionStatus: 'MANUAL_UPLOAD',
      notes: 'Geometry provenance (SURVEYED/USER_DRAWN/EXTERNAL) must be declared per import — see domain/GeoReference.ts.'
    })
  ];
}
