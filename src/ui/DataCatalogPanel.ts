import type { DatasetRecord } from '../data/Dataset';
import type { FieldSummary } from '../data/FieldSummary';
import type { DataGap } from '../data/DataGap';
import type { MissionDataRequirement } from '../data/MissionDataRequirement';

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

  render(params: { summary: FieldSummary; gaps: DataGap[]; missionRequirements: MissionDataRequirement[]; datasets: DatasetRecord[] }): void {
    if (!this.content) return;
    const { summary, gaps, missionRequirements, datasets } = params;

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
      `<div class="catalog-section"><h4>Dataset Catalog</h4>${datasetRows}</div>`
    ].join('');
  }
}
