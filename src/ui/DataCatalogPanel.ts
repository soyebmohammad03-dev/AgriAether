import type { DatasetRecord } from '../data/Dataset';
import type { FieldSummary } from '../data/FieldSummary';
import type { DataGap } from '../data/DataGap';
import type { MissionDataRequirement } from '../data/MissionDataRequirement';
import type { SoilSample } from '../soil/SoilSample';
import type { GroundSample } from '../sensors/GroundSample';
import type { CropObservation } from '../domain/CropObservation';
import type { SensorKind } from '../domain/SensorRecord';
import type { DataSourceRecord } from '../data/DataSource';
import type { ImportReport } from '../data/ImportPipeline';
import { summarizeSoilSampleQuality } from '../soil/SoilQuality';

export interface SensorRegistryRow {
  kind: SensorKind;
  deployedCount: number;
}

/**
 * "Mission control for agricultural intelligence," not a spreadsheet: one
 * consolidated panel covering the Field Summary, Coverage, Data Gaps,
 * Mission Data Requirements, and Dataset list from the Phase 5 brief
 * (Parts 27–32), deliberately combined into one surface rather than five
 * separate ones — the brief itself warns against turning this into "an
 * enterprise GIS monster." Every number here is computed from real data
 * already collected elsewhere in the app; nothing is fabricated for this
 * view.
 */
export class DataCatalogPanel {
  private readonly panel = document.getElementById('dataCatalogPanel');
  private readonly content = document.getElementById('dataCatalogContent');
  private open = false;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(params: {
    summary: FieldSummary;
    gaps: DataGap[];
    missionRequirements: MissionDataRequirement[];
    datasets: DatasetRecord[];
    soilSamples: SoilSample[];
    groundSamples: GroundSample[];
    cropObservations: CropObservation[];
    sensorRegistry: SensorRegistryRow[];
    dataSources: DataSourceRecord[];
    importRecords: ImportReport[];
  }): void {
    if (!this.content) return;
    const { summary, gaps, missionRequirements, datasets, soilSamples, groundSamples, cropObservations, sensorRegistry, dataSources, importRecords } = params;

    const coverageRows = Object.entries(summary.coverage.sensorCoverage)
      .map(([category, status]) => `<div class="catalog-kv"><span>${category}</span><span class="${status === 'available' ? 'catalog-ok' : 'catalog-muted'}">${status}</span></div>`)
      .join('');

    const gapRows = gaps.length
      ? gaps.map((g) => `<div class="catalog-gap">${g.description}</div>`).join('')
      : '<div class="catalog-muted">No data gaps detected against the checklist this app knows about.</div>';

    const missionRows = missionRequirements
      .filter((r) => r.status === 'MISSION_REQUIRED')
      .map((r) => `<div class="catalog-gap">${r.analysisName}: requires [${r.required.join(', ')}] — not currently deployed.</div>`)
      .join('') || '<div class="catalog-muted">No outstanding mission data requirements.</div>';

    const datasetRows = datasets.length
      ? datasets
          .map(
            (d) =>
              `<div class="catalog-dataset"><strong>${d.name}</strong> — ${d.type}, provider: ${d.provider}, provenance: ${d.provenance}, quality: ${d.quality}${d.license ? `, license: ${d.license}` : ''}</div>`
          )
          .join('')
      : '<div class="catalog-muted">No datasets registered.</div>';

    const soilRows = soilSamples.length
      ? soilSamples
          .map((s) => {
            const quality = summarizeSoilSampleQuality(s);
            const statuses = [
              quality.moistureStatus ? `moisture:${quality.moistureStatus}` : null,
              quality.ecStatus ? `EC:${quality.ecStatus}` : null,
              quality.phStatus ? `pH:${quality.phStatus}` : null
            ]
              .filter(Boolean)
              .join(' ');
            const depth = s.depthCm !== null ? `${s.depthCm}cm` : 'depth unknown';
            const location = s.location ? `${s.location.lat.toFixed(5)},${s.location.lon.toFixed(5)}` : s.zoneId ? `zone: ${s.zoneId}` : 'field-level';
            return `<div class="catalog-dataset"><strong>Soil (${s.method})</strong> — provenance: ${s.provenance}, ${depth}, ${location}, completeness: ${quality.completeness.presentCount}/${quality.completeness.totalKnownMeasurements}${s.textureClass ? `, texture: ${s.textureClass}` : ''}${statuses ? ` — ${statuses}` : ''}${quality.hasOutOfRangeMeasurement ? ' <span class="catalog-gap">(out-of-range measurement)</span>' : ''}</div>`;
          })
          .join('')
      : '<div class="catalog-muted">No soil observations recorded. No physical soil sensor or laboratory sample has been registered for this field — see soil/SoilSample.ts and soil/SoilDataProvider.ts.</div>';

    const groundRows = groundSamples.length
      ? groundSamples
          .map(
            (s) =>
              `<div class="catalog-dataset"><strong>Ground (${s.method})</strong> — provenance: ${s.provenance}, measurements: ${Object.keys(s.measurements).join(', ')}</div>`
          )
          .join('')
      : '<div class="catalog-muted">No ground-station observations recorded. No weather-station, rain-gauge, leaf-wetness, or other ground sensor is currently deployed.</div>';

    const cropRows = cropObservations.length
      ? cropObservations
          .map(
            (c) =>
              `<div class="catalog-dataset"><strong>Crop observation</strong> — stage: ${c.growthStage}, source: ${c.source}${c.observedCondition ? `, "${c.observedCondition}"` : ''}</div>`
          )
          .join('')
      : '<div class="catalog-muted">No crop observations recorded. No health/stress/disease score is ever fabricated in its place.</div>';

    const sourceRows = dataSources.length
      ? dataSources
          .map(
            (s) =>
              `<div class="catalog-dataset"><strong>${s.name}</strong> — ${s.type}, nature: ${s.nature}, status: ${s.ingestionStatus}${s.license ? `, license: ${s.license}` : ''}</div>`
          )
          .join('')
      : '<div class="catalog-muted">No data sources registered.</div>';

    const importRows = importRecords.length
      ? importRecords
          .slice(0, 10)
          .map(
            (r) =>
              `<div class="catalog-dataset">${new Date(r.startedAt).toLocaleString()} — ${r.kind}: ${r.recordsAccepted} accepted, ${r.recordsQuestionable} questionable, ${r.recordsRejected} rejected, ${r.duplicatesSkipped} duplicates skipped (of ${r.recordsReceived} received)</div>`
          )
          .join('')
      : '<div class="catalog-muted">No imports run yet. Use Import Data to bring in a real CSV or GeoJSON dataset.</div>';

    const registryRows = sensorRegistry
      .map(
        (row) =>
          `<div class="catalog-kv"><span>${row.kind}</span><span class="${row.deployedCount > 0 ? 'catalog-ok' : 'catalog-muted'}">${row.deployedCount > 0 ? `${row.deployedCount} deployed` : 'no hardware connected'}</span></div>`
      )
      .join('');

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Field Summary — ${summary.fieldName}</h4>`,
      `<div class="catalog-kv"><span>Area</span><span>${summary.areaHectares !== null ? summary.areaHectares.toFixed(2) + ' ha' : 'unknown'}</span></div>`,
      `<div class="catalog-kv"><span>Datasets</span><span>${summary.datasetCount}</span></div>`,
      `<div class="catalog-kv"><span>Sensor observations (recent)</span><span>${summary.sensorObservationCount}</span></div>`,
      `<div class="catalog-kv"><span>Latest acquisition</span><span>${summary.latestAcquisition ? new Date(summary.latestAcquisition).toLocaleTimeString() : 'none'}</span></div>`,
      summary.note ? `<div class="catalog-muted">${summary.note}</div>` : `<div class="catalog-ok">Available analyses: ${summary.availableAnalyses.join(', ')}</div>`,
      `</div>`,
      `<div class="catalog-section"><h4>Coverage</h4>${coverageRows}</div>`,
      `<div class="catalog-section"><h4>Data Gaps</h4>${gapRows}</div>`,
      `<div class="catalog-section"><h4>Mission Data Requirements</h4>${missionRows}</div>`,
      `<div class="catalog-section"><h4>Dataset Catalog</h4>${datasetRows}</div>`,
      `<div class="catalog-section"><h4>Data Sources</h4>${sourceRows}</div>`,
      `<div class="catalog-section"><h4>Import History</h4>${importRows}</div>`,
      `<div class="catalog-section"><h4>Ground Observations</h4>${soilRows}${groundRows}${cropRows}</div>`,
      `<div class="catalog-section"><h4>Sensor Capability Registry</h4><div class="catalog-muted">Every sensor kind AgriAether's domain model can represent, cross-checked against what is actually deployed — never a live reading invented for a kind with no hardware.</div>${registryRows}</div>`
    ].join('');
  }
}
