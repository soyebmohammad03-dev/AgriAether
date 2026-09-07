import type { Provenance } from '../observation/Observation';
import type { GeodeticProvenance } from '../domain/GeoReference';
import type { DataSourceRecord } from '../data/DataSource';
import { parseCsv, type ColumnMapping } from '../data/CsvImport';
import { runCsvObservationImport, runFieldBoundaryImport, type CsvImportResult, type FieldBoundaryImportResult } from '../data/ImportPipeline';
import { validateUploadCandidate } from '../data/AssetSecurity';

const CANONICAL_COLUMNS: Array<{ key: keyof ColumnMapping; label: string; required: boolean }> = [
  { key: 'timestamp', label: 'timestamp', required: true },
  { key: 'observationType', label: 'observation_type', required: true },
  { key: 'value', label: 'value', required: true },
  { key: 'unit', label: 'unit', required: false },
  { key: 'latitude', label: 'latitude', required: false },
  { key: 'longitude', label: 'longitude', required: false },
  { key: 'fieldId', label: 'field_id', required: false },
  { key: 'zoneId', label: 'zone_id', required: false },
  { key: 'sensorId', label: 'sensor_id', required: false }
];

const CSV_PROVENANCE_OPTIONS: Provenance[] = ['MEASURED', 'EXTERNAL', 'USER_REPORTED', 'UNKNOWN'];
const GEOMETRY_PROVENANCE_OPTIONS: GeodeticProvenance[] = ['SURVEYED', 'USER_DRAWN', 'EXTERNAL'];

export interface ImportPanelDeps {
  farmId: string;
  csvSource: DataSourceRecord;
  geojsonSource: DataSourceRecord;
  knownFieldIds: () => ReadonlySet<string>;
  knownZoneIds: () => ReadonlySet<string>;
  knownSensorCapabilities: (sensorId: string) => readonly string[] | null;
  existingObservationIds: () => ReadonlySet<string>;
  onCsvImportComplete: (result: CsvImportResult) => void;
  onFieldBoundaryImportComplete: (result: FieldBoundaryImportResult) => void;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The one UI surface for Phase 7's ingestion pipeline (Part 15): pick a
 * kind, upload a file, map CSV columns (or preview GeoJSON geometry),
 * declare provenance explicitly, and run the import. Every state here is
 * honest: no fake progress bar (imports are synchronous, see
 * data/ImportPipeline.ts), no "connected" claim for a manual upload, and
 * the report shown after Import is exactly what data/ImportPipeline.ts
 * returned — nothing embellished for display.
 */
export class ImportPanel {
  private readonly panel = document.getElementById('importPanel');
  private readonly content = document.getElementById('importContent');
  private open = false;

  private kind: 'CSV' | 'GEOJSON' = 'CSV';
  private csvText: string | null = null;
  private csvHeader: string[] = [];
  private csvFilename: string | null = null;
  private geojsonRaw: unknown = null;
  private geojsonFilename: string | null = null;
  private lastCsvResult: CsvImportResult | null = null;
  private lastGeoJsonResult: FieldBoundaryImportResult | null = null;
  private lastError: string | null = null;

  constructor(private readonly deps: ImportPanelDeps) {}

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    if (this.open) this.render();
    return this.open;
  }

  private resetFileState(): void {
    this.csvText = null;
    this.csvHeader = [];
    this.csvFilename = null;
    this.geojsonRaw = null;
    this.geojsonFilename = null;
    this.lastCsvResult = null;
    this.lastGeoJsonResult = null;
    this.lastError = null;
  }

  private handleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const declaredMimeType = this.kind === 'CSV' ? 'text/csv' : 'application/geo+json';
    const validation = validateUploadCandidate({ filename: file.name, sizeBytes: file.size, declaredMimeType });
    if (!validation.valid) {
      this.lastError = `Upload rejected: ${validation.issues.join(' ')}`;
      this.lastCsvResult = null;
      this.lastGeoJsonResult = null;
      this.render();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      this.lastError = null;
      this.lastCsvResult = null;
      this.lastGeoJsonResult = null;
      if (this.kind === 'CSV') {
        this.csvText = text;
        this.csvFilename = validation.sanitizedFilename;
        this.csvHeader = parseCsv(text).header;
      } else {
        this.geojsonFilename = validation.sanitizedFilename;
        try {
          this.geojsonRaw = JSON.parse(text);
        } catch (error) {
          this.geojsonRaw = null;
          this.lastError = `File is not valid JSON: ${(error as Error).message}`;
        }
      }
      this.render();
    };
    reader.onerror = () => {
      this.lastError = 'Failed to read the selected file.';
      this.render();
    };
    reader.readAsText(file);
  }

  private currentMapping(): ColumnMapping {
    const get = (key: keyof ColumnMapping): string | null => {
      const select = document.getElementById(`importMap_${key}`) as HTMLSelectElement | null;
      return select && select.value !== '' ? select.value : null;
    };
    return {
      timestamp: get('timestamp'),
      latitude: get('latitude'),
      longitude: get('longitude'),
      fieldId: get('fieldId'),
      zoneId: get('zoneId'),
      sensorId: get('sensorId'),
      observationType: get('observationType') ?? '',
      value: get('value') ?? '',
      unit: get('unit')
    };
  }

  private runCsvImport(): void {
    if (!this.csvText) return;
    const mapping = this.currentMapping();
    if (!mapping.timestamp || !mapping.observationType || !mapping.value) {
      this.lastError = 'Map timestamp, observation_type, and value before importing.';
      this.render();
      return;
    }
    const provenanceSelect = document.getElementById('importProvenance') as HTMLSelectElement | null;
    const provenance = (provenanceSelect?.value ?? 'UNKNOWN') as Exclude<Provenance, 'SIMULATED' | 'ESTIMATED' | 'PREDICTED'>;

    const result = runCsvObservationImport({
      csvText: this.csvText,
      mapping,
      source: this.deps.csvSource,
      provenance,
      farmId: this.deps.farmId,
      existingObservationIds: this.deps.existingObservationIds(),
      validation: {
        knownFieldIds: this.deps.knownFieldIds(),
        knownZoneIds: this.deps.knownZoneIds(),
        knownSensorCapabilities: this.deps.knownSensorCapabilities,
        now: Date.now()
      }
    });
    this.lastCsvResult = result;
    this.lastError = null;
    this.deps.onCsvImportComplete(result);
    this.render();
  }

  private runGeoJsonImport(): void {
    if (this.geojsonRaw === null) return;
    const provenanceSelect = document.getElementById('importGeometryProvenance') as HTMLSelectElement | null;
    const provenance = (provenanceSelect?.value ?? 'EXTERNAL') as GeodeticProvenance;
    const result = runFieldBoundaryImport({ raw: this.geojsonRaw, source: this.deps.geojsonSource, provenance });
    this.lastGeoJsonResult = result;
    this.lastError = null;
    this.deps.onFieldBoundaryImportComplete(result);
    this.render();
  }

  private renderReport(report: { recordsReceived: number; recordsAccepted: number; recordsRejected: number; recordsQuestionable: number; duplicatesSkipped: number; validationErrors: string[]; warnings: string[]; missingTimestamps: number; missingCoordinates: number; unitIssues: number }): string {
    return [
      `<div class="import-report">`,
      `<h4>Import Report</h4>`,
      `<div class="catalog-kv"><span>Received</span><span>${report.recordsReceived}</span></div>`,
      `<div class="catalog-kv"><span>Accepted</span><span class="catalog-ok">${report.recordsAccepted}</span></div>`,
      `<div class="catalog-kv"><span>Questionable</span><span>${report.recordsQuestionable}</span></div>`,
      `<div class="catalog-kv"><span>Rejected</span><span>${report.recordsRejected}</span></div>`,
      `<div class="catalog-kv"><span>Duplicates skipped</span><span>${report.duplicatesSkipped}</span></div>`,
      `<div class="catalog-kv"><span>Missing timestamps</span><span>${report.missingTimestamps}</span></div>`,
      `<div class="catalog-kv"><span>Missing coordinates</span><span>${report.missingCoordinates}</span></div>`,
      `<div class="catalog-kv"><span>Unit issues</span><span>${report.unitIssues}</span></div>`,
      report.validationErrors.length
        ? `<div class="import-errors">${report.validationErrors.slice(0, 20).map((e) => `<div>${esc(e)}</div>`).join('')}${report.validationErrors.length > 20 ? `<div class="catalog-muted">…and ${report.validationErrors.length - 20} more.</div>` : ''}</div>`
        : '',
      report.warnings.length
        ? `<div class="import-warnings">${report.warnings.slice(0, 10).map((w) => `<div>${esc(w)}</div>`).join('')}${report.warnings.length > 10 ? `<div class="catalog-muted">…and ${report.warnings.length - 10} more.</div>` : ''}</div>`
        : '',
      `</div>`
    ].join('');
  }

  render(): void {
    if (!this.content) return;

    const tabs = `<div class="import-tabs">
      <button id="importKindCsv" class="${this.kind === 'CSV' ? 'active' : ''}">CSV Observations</button>
      <button id="importKindGeoJson" class="${this.kind === 'GEOJSON' ? 'active' : ''}">GeoJSON Field Boundary</button>
    </div>`;

    const fileInput = `<div class="import-upload">
      <input type="file" id="importFileInput" accept="${this.kind === 'CSV' ? '.csv,text/csv' : '.geojson,.json,application/geo+json,application/json'}" />
      ${this.lastError ? `<div class="import-error-banner">${esc(this.lastError)}</div>` : ''}
    </div>`;

    let body = '';
    if (this.kind === 'CSV') {
      if (this.csvHeader.length > 0) {
        const mappingRows = CANONICAL_COLUMNS.map((col) => {
          const options = ['<option value="">— none —</option>', ...this.csvHeader.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`)].join('');
          return `<div class="catalog-kv"><span>${col.label}${col.required ? ' *' : ''}</span><select id="importMap_${col.key}">${options}</select></div>`;
        }).join('');
        const provenanceOptions = CSV_PROVENANCE_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join('');
        body = `
          <div class="catalog-muted">File: ${this.csvFilename ? esc(this.csvFilename) : 'none'} — ${this.csvHeader.length} column(s) detected.</div>
          <div class="import-mapping">${mappingRows}</div>
          <div class="catalog-kv"><span>Provenance (required) *</span><select id="importProvenance">${provenanceOptions}</select></div>
          <div class="catalog-muted">Provenance is declared by you, the importer — it is never inferred from the file. Only mark MEASURED if this data genuinely came from a calibrated instrument.</div>
          <button id="importRunCsv" class="ctrl-btn">Run Import</button>
        `;
      } else {
        body = '<div class="catalog-muted">Upload a CSV to map its columns. Required columns: timestamp, observation_type, value (unit and location columns are optional but recommended).</div>';
      }
      if (this.lastCsvResult) body += this.renderReport(this.lastCsvResult.report);
    } else {
      if (this.geojsonRaw !== null) {
        const provenanceOptions = GEOMETRY_PROVENANCE_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join('');
        body = `
          <div class="catalog-muted">File: ${this.geojsonFilename ? esc(this.geojsonFilename) : 'none'}.</div>
          <div class="catalog-kv"><span>Geometry provenance (required) *</span><select id="importGeometryProvenance">${provenanceOptions}</select></div>
          <div class="catalog-muted">SURVEYED = real GPS/RTK survey. USER_DRAWN = hand-drawn on a map. EXTERNAL = from a third-party file whose own survey method is unknown to this app.</div>
          <button id="importRunGeoJson" class="ctrl-btn">Run Import</button>
        `;
      } else {
        body = '<div class="catalog-muted">Upload a GeoJSON Polygon or MultiPolygon field boundary. WGS84 (EPSG:4326) only — any other declared CRS is rejected, never guessed.</div>';
      }
      if (this.lastGeoJsonResult) body += this.renderReport(this.lastGeoJsonResult.report);
    }

    this.content.innerHTML = tabs + fileInput + `<div class="import-body">${body}</div>`;

    document.getElementById('importFileInput')?.addEventListener('change', (e) => this.handleFileSelected(e));
    document.getElementById('importKindCsv')?.addEventListener('click', () => {
      this.kind = 'CSV';
      this.resetFileState();
      this.render();
    });
    document.getElementById('importKindGeoJson')?.addEventListener('click', () => {
      this.kind = 'GEOJSON';
      this.resetFileState();
      this.render();
    });
    document.getElementById('importRunCsv')?.addEventListener('click', () => this.runCsvImport());
    document.getElementById('importRunGeoJson')?.addEventListener('click', () => this.runGeoJsonImport());
  }
}
