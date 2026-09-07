import type { Polygon, MultiPolygon } from 'geojson';
import { createId } from '../domain/id';
import { createImportedObservation, type Observation, type Provenance } from '../observation/Observation';
import type { GeoReference, GeodeticProvenance } from '../domain/GeoReference';
import type { DataSourceRecord } from './DataSource';
import { parseCsv, mapCsvRowsToDrafts, type ColumnMapping } from './CsvImport';
import { validateObservationDraft, type RowValidationContext } from './ImportValidation';
import { deterministicObservationId } from './ImportIdentity';
import { ingestFieldBoundaryGeoJson } from './GeoJsonIngestion';
import { diagnostics } from '../diagnostics/Diagnostics';

/** One diagnostics entry per completed import run — severity reflects whether anything was actually rejected, never the raw record count. */
function logImportReport(report: ImportReport): void {
  diagnostics.log({
    severity: report.recordsRejected > 0 ? 'WARN' : 'INFO',
    category: 'IMPORT',
    operation: report.kind === 'CSV_OBSERVATIONS' ? 'runCsvObservationImport' : 'runFieldBoundaryImport',
    message: `Import ${report.id}: ${report.recordsAccepted} accepted, ${report.recordsRejected} rejected, ${report.recordsQuestionable} questionable, ${report.duplicatesSkipped} duplicates (of ${report.recordsReceived} received).`,
    correlationId: report.id,
    detail: { sourceId: report.sourceId, kind: report.kind }
  });
}

/**
 * The auditable result of one import (Phase 7, Part 2 & Part 8) — every
 * number here comes from what the pipeline actually did to the actual
 * input, never a fabricated summary. Persisted as-is (see
 * world/WorldRegistry.ts's registerImportRecord).
 */
export interface ImportReport {
  id: string;
  sourceId: string;
  kind: 'CSV_OBSERVATIONS' | 'GEOJSON_FIELD_BOUNDARY';
  startedAt: number;
  endedAt: number;
  recordsReceived: number;
  recordsAccepted: number;
  recordsRejected: number;
  recordsQuestionable: number;
  duplicatesSkipped: number;
  validationErrors: string[];
  warnings: string[];
  missingTimestamps: number;
  missingCoordinates: number;
  unitIssues: number;
}

function emptyCounters() {
  return { accepted: 0, rejected: 0, questionable: 0, duplicates: 0, missingTimestamps: 0, missingCoordinates: 0, unitIssues: 0 };
}

export interface CsvImportParams {
  csvText: string;
  mapping: ColumnMapping;
  source: DataSourceRecord;
  /** Explicit, per-import — never defaulted. See createImportedObservation's contract. */
  provenance: Exclude<Provenance, 'SIMULATED' | 'ESTIMATED' | 'PREDICTED'>;
  farmId?: string | null;
  /** ids already persisted (data/ImportIdentity.ts deterministic ids) — a row that would produce one of these is a duplicate, not a new record. */
  existingObservationIds: ReadonlySet<string>;
  validation?: RowValidationContext;
}

export interface CsvImportResult {
  report: ImportReport;
  accepted: Observation<number>[];
}

/**
 * Runs the full CSV ingestion pipeline (Part 2): parse -> validate ->
 * normalize -> quality assessment -> provenance assignment -> Observation
 * construction. Deliberately does NOT persist anything — the caller
 * (App.ts / a future import service) owns writing `accepted` and the
 * report to repositories, same separation every other domain module here
 * uses (see world/WorldRegistry.ts).
 */
export function runCsvObservationImport(params: CsvImportParams): CsvImportResult {
  const startedAt = Date.now();
  const validationErrors: string[] = [];
  const warnings: string[] = [];
  const counters = emptyCounters();
  const accepted: Observation<number>[] = [];
  const seenInThisBatch = new Set<string>();

  const parsed = parseCsv(params.csvText);
  validationErrors.push(...parsed.errors);

  if (parsed.header.length === 0) {
    return {
      report: {
        id: createId('import'),
        sourceId: params.source.id,
        kind: 'CSV_OBSERVATIONS',
        startedAt,
        endedAt: Date.now(),
        recordsReceived: 0,
        recordsAccepted: 0,
        recordsRejected: 0,
        recordsQuestionable: 0,
        duplicatesSkipped: 0,
        validationErrors,
        warnings,
        missingTimestamps: 0,
        missingCoordinates: 0,
        unitIssues: 0
      },
      accepted: []
    };
  }

  const drafts = mapCsvRowsToDrafts(parsed.header, parsed.rows, params.mapping);

  for (const draft of drafts) {
    if (!draft.timestampRaw) counters.missingTimestamps += 1;
    if (!draft.latRaw && !draft.lonRaw) counters.missingCoordinates += 1;

    const result = validateObservationDraft(draft, params.validation);
    if (result.errors.some((e) => e.toLowerCase().includes('unit')) || result.warnings.some((w) => w.toLowerCase().includes('unit'))) {
      counters.unitIssues += 1;
    }

    if (result.status === 'REJECTED') {
      counters.rejected += 1;
      validationErrors.push(...result.errors);
      continue;
    }
    warnings.push(...result.warnings);

    const id = deterministicObservationId({
      sourceId: params.source.id,
      type: draft.observationType,
      timestamp: result.timestamp!,
      value: result.normalizedValue,
      unit: result.normalizedUnit,
      lat: result.lat,
      lon: result.lon,
      fieldId: draft.fieldId,
      zoneId: draft.zoneId,
      sensorId: draft.sensorId
    });

    if (params.existingObservationIds.has(id) || seenInThisBatch.has(id)) {
      counters.duplicates += 1;
      continue;
    }
    seenInThisBatch.add(id);

    const observation = createImportedObservation({
      id,
      type: draft.observationType,
      value: result.normalizedValue!,
      unit: result.normalizedUnit,
      timestamp: result.timestamp!,
      location: result.lat !== null && result.lon !== null ? { frame: 'geodetic', crs: 'EPSG:4326', lat: result.lat, lon: result.lon } : null,
      source: `import:${params.source.id}`,
      provenance: params.provenance,
      confidence: null,
      farmId: params.farmId ?? null,
      fieldId: draft.fieldId,
      zoneId: draft.zoneId,
      sensorId: draft.sensorId,
      metadata: {
        dataQuality: result.status === 'QUESTIONABLE' ? 'QUESTIONABLE' : 'VALID',
        importRowNumber: draft.rowNumber
      }
    });
    accepted.push(observation);
    if (result.status === 'QUESTIONABLE') counters.questionable += 1;
    else counters.accepted += 1;
  }

  const csvReport: ImportReport = {
    id: createId('import'),
    sourceId: params.source.id,
    kind: 'CSV_OBSERVATIONS',
    startedAt,
    endedAt: Date.now(),
    recordsReceived: drafts.length,
    recordsAccepted: counters.accepted,
    recordsRejected: counters.rejected,
    recordsQuestionable: counters.questionable,
    duplicatesSkipped: counters.duplicates,
    validationErrors,
    warnings,
    missingTimestamps: counters.missingTimestamps,
    missingCoordinates: counters.missingCoordinates,
    unitIssues: counters.unitIssues
  };
  logImportReport(csvReport);
  return { report: csvReport, accepted };
}

/** GeoJSON CRS names this pipeline accepts as "this is WGS84" when a legacy `crs` member is present. Anything else is rejected rather than guessed at (Part 4). */
const ACCEPTED_CRS_NAMES = ['urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:OGC::CRS84', 'EPSG:4326', 'urn:ogc:def:crs:EPSG::4326'];

export interface FieldBoundaryImportParams {
  /** Parsed (but otherwise untrusted) JSON — the caller has already done JSON.parse in a try/catch. */
  raw: unknown;
  source: DataSourceRecord;
  provenance: GeodeticProvenance;
}

export interface FieldBoundaryImportResult {
  report: ImportReport;
  geoReference: GeoReference | null;
  areaHectares: number | null;
}

/**
 * Runs GeoJSON field-boundary ingestion through the same audit-report shape
 * as the CSV pipeline (Part 4 + Part 2). Rejects — never guesses — an
 * explicit non-WGS84 CRS declaration; GeoJSON without a `crs` member is
 * WGS84 per RFC 7946, so that case proceeds normally.
 */
export function runFieldBoundaryImport(params: FieldBoundaryImportParams): FieldBoundaryImportResult {
  const startedAt = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  const raw = params.raw as { type?: string; crs?: { properties?: { name?: string } } } | null;
  if (!raw || typeof raw !== 'object') {
    errors.push('Input is not a valid GeoJSON object.');
  } else if (raw.crs) {
    const name = raw.crs.properties?.name;
    if (!name || !ACCEPTED_CRS_NAMES.includes(name)) {
      errors.push(`GeoJSON declares CRS "${name ?? 'unknown'}" — only WGS84 (CRS84/EPSG:4326) is supported. The geometry was not guessed into a different CRS.`);
    }
  }

  if (errors.length > 0) {
    const rejectedReport: ImportReport = {
      id: createId('import'),
      sourceId: params.source.id,
      kind: 'GEOJSON_FIELD_BOUNDARY',
      startedAt,
      endedAt: Date.now(),
      recordsReceived: 1,
      recordsAccepted: 0,
      recordsRejected: 1,
      recordsQuestionable: 0,
      duplicatesSkipped: 0,
      validationErrors: errors,
      warnings,
      missingTimestamps: 0,
      missingCoordinates: 0,
      unitIssues: 0
    };
    logImportReport(rejectedReport);
    return { report: rejectedReport, geoReference: null, areaHectares: null };
  }

  const geometry = raw as unknown as Polygon | MultiPolygon;
  const ingestion = ingestFieldBoundaryGeoJson(geometry);

  const rejected = ingestion.status === 'INVALID';
  const geoReference: GeoReference | null = rejected
    ? null
    : { kind: 'geodetic', crs: 'EPSG:4326', geometry: ingestion.geometry!, provenance: params.provenance };

  if (ingestion.status === 'REPAIRED') {
    warnings.push(`Geometry was repaired (${ingestion.repairMethod}) before acceptance: ${ingestion.issues.join('; ') || 'ring closed automatically'}.`);
  }

  const finalReport: ImportReport = {
    id: createId('import'),
    sourceId: params.source.id,
    kind: 'GEOJSON_FIELD_BOUNDARY',
    startedAt,
    endedAt: Date.now(),
    recordsReceived: 1,
    recordsAccepted: rejected ? 0 : 1,
    recordsRejected: rejected ? 1 : 0,
    recordsQuestionable: 0,
    duplicatesSkipped: 0,
    validationErrors: rejected ? ingestion.issues : [],
    warnings,
    missingTimestamps: 0,
    missingCoordinates: 0,
    unitIssues: 0
  };
  logImportReport(finalReport);
  return { report: finalReport, geoReference, areaHectares: ingestion.areaHectares };
}
