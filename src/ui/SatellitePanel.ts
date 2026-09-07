import type { SentinelFieldAnalysisResult } from '../satellite/SentinelFieldPipeline';
import type { DatasetRecord } from '../data/Dataset';
import type { FieldSectioningResult } from '../analysis/FieldSectioning';
import type { Recommendation } from '../sensing/RecommendationEngine';
import type { ModelRecord } from '../sensing/ModelRegistry';
import { escapeHtml as esc } from './escapeHtml';

export type SatellitePanelState =
  | { status: 'IDLE' }
  | { status: 'LOADING'; message: string }
  | { status: 'ERROR'; message: string }
  | { status: 'READY'; analysis: SentinelFieldAnalysisResult; dataset: DatasetRecord; sectioning: FieldSectioningResult | null; sectionRecommendations: Recommendation[]; knowledgeGraphEvidenceCount: number | null };

/**
 * Real Sentinel-2 status/result panel — every field shown here comes
 * directly from a SentinelFieldAnalysisResult/DatasetRecord that a live
 * fetch actually produced. LOADING/ERROR are rendered as plain honest
 * text (e.g. "Satellite data temporarily unavailable: <reason>"), never a
 * result that merely looks complete. Scene/dataset text from the external
 * STAC response is escaped before interpolation, same as every other
 * panel since Phase 15.
 */
export class SatellitePanel {
  private readonly panel = document.getElementById('satellitePanel');
  private readonly content = document.getElementById('satelliteContent');
  private open = false;
  onFetchRequested: (() => void) | null = null;
  onGenerateZonesRequested: (() => void) | null = null;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(state: SatellitePanelState, model?: ModelRecord | null): void {
    if (!this.content) return;

    const fetchButton = `<button id="satelliteFetchBtn" class="lang-btn">Fetch real Sentinel-2 imagery for this field</button>`;

    let body: string;
    if (state.status === 'IDLE') {
      body = `<div class="catalog-muted">No satellite fetch has been run yet. This performs a real, live network request (public STAC search + signed COG range-reads) — not a fixture.</div>`;
    } else if (state.status === 'LOADING') {
      body = `<div class="catalog-muted">${esc(state.message)}</div>`;
    } else if (state.status === 'ERROR') {
      body = `<div class="catalog-gap">Satellite data temporarily unavailable: ${esc(state.message)}</div>`;
    } else {
      const { analysis, dataset } = state;
      const { scene } = analysis;
      body = [
        `<div class="catalog-kv"><span>Scene</span><span>${esc(scene.itemId)}</span></div>`,
        `<div class="catalog-kv"><span>Acquired</span><span>${new Date(scene.datetime).toISOString()}</span></div>`,
        `<div class="catalog-kv"><span>Cloud cover</span><span>${scene.cloudCoverPercent !== null ? `${scene.cloudCoverPercent.toFixed(2)}%` : 'unknown'}</span></div>`,
        `<div class="catalog-kv"><span>Processing baseline</span><span>${esc(scene.processingBaseline ?? 'unknown')}</span></div>`,
        `<div class="catalog-kv"><span>CRS (source)</span><span>EPSG:${scene.epsg ?? 'unknown'}</span></div>`,
        `<div class="catalog-kv"><span>Bands used</span><span>RED (B04), NIR (B08), 10m native</span></div>`,
        `<div class="catalog-kv"><span>Valid pixels</span><span>${analysis.validPixelCount}/${analysis.totalPixelCount}</span></div>`,
        `<div class="catalog-kv"><span>Quality</span><span class="${analysis.quality === 'VALID' ? 'catalog-ok' : 'catalog-gap'}">${analysis.quality}</span></div>`,
        `<div class="catalog-kv"><span>NDVI mean</span><span>${analysis.ndviStats.mean.value?.toFixed(4) ?? 'n/a'}</span></div>`,
        `<div class="catalog-kv"><span>NDVI min / max</span><span>${analysis.ndviStats.min.value?.toFixed(4) ?? 'n/a'} / ${analysis.ndviStats.max.value?.toFixed(4) ?? 'n/a'}</span></div>`,
        `<div class="catalog-kv"><span>NDVI median</span><span>${analysis.ndviStats.median.value?.toFixed(4) ?? 'n/a'}</span></div>`,
        `<div class="catalog-kv"><span>NDVI std dev</span><span>${analysis.ndviStats.stddev.value?.toFixed(4) ?? 'n/a'}</span></div>`,
        `<div class="catalog-dataset">Dataset: ${esc(dataset.name)} — provenance ${dataset.provenance}, source ${esc(dataset.source)}</div>`,
        `<div class="catalog-muted">NDVI Observation provenance: ${analysis.ndviObservation?.provenance ?? 'n/a'} (derived from real EXTERNAL reflectance, never SIMULATED/PREDICTED).</div>`
      ].join('');
    }

    const zoneButton = state.status === 'READY' ? `<button id="satelliteZonesBtn" class="lang-btn">Generate evidence-based management zones</button>` : '';

    const zonesBody =
      state.status === 'READY' && state.sectioning
        ? state.sectioning.zones.length
          ? [
              `<div class="catalog-muted">${state.sectioning.zones.length} zone(s), ${state.sectioning.unassignedCellCount} cell(s) filtered as too-small regions (min region size enforced) — method: kmeans_ndvi_connected_components.</div>`,
              ...state.sectioning.generationRecords.map(
                (r, i) =>
                  `<div class="catalog-kv"><span>${esc(state.sectioning!.zones[i].name)}</span><span>${r.cellCount} cells, mean NDVI ${r.meanNdvi?.toFixed(3) ?? 'n/a'}, ${r.quality}</span></div>`
              ),
              ...state.sectionRecommendations.map((r) => `<div class="catalog-gap">[${r.status}] ${esc(r.proposedAction)}</div>`),
              state.knowledgeGraphEvidenceCount !== null
                ? `<div class="catalog-muted">Knowledge Graph: ${state.knowledgeGraphEvidenceCount} observation(s) traceable from this field through its zones.</div>`
                : ''
            ].join('')
          : `<div class="catalog-muted">No zone met the minimum region size — field NDVI is too uniform/small at this resolution to section further.</div>`
        : state.status === 'READY'
          ? `<div class="catalog-muted">Not generated yet — press "Generate evidence-based management zones".</div>`
          : '';

    const modelBody = model
      ? [
          `<div class="catalog-kv"><span>Model</span><span>${esc(model.name)}</span></div>`,
          `<div class="catalog-kv"><span>Status</span><span class="${model.deploymentStatus === 'DEPLOYED' ? 'catalog-ok' : 'catalog-muted'}">${model.deploymentStatus}</span></div>`,
          `<div class="catalog-kv"><span>Validation accuracy</span><span>${model.evaluationMetrics?.validationAccuracy ?? 'n/a'} (majority-class baseline: ${model.evaluationMetrics?.majorityClassBaselineAccuracy ?? 'n/a'})</span></div>`,
          `<div class="catalog-muted">Trained/evaluated on real held-out benchmark chips (ibm-nasa-geospatial/multi-temporal-crop-classification) — NOT this field. Field applicability is UNVERIFIED; see ml/README.md.</div>`,
          `<div class="catalog-muted">${esc(model.limitations)}</div>`
        ].join('')
      : '<div class="catalog-muted">No trained model registered.</div>';

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Sentinel-2 L2A — Real Earth Observation</h4>${fetchButton}</div>`,
      `<div class="catalog-section">${body}</div>`,
      `<div class="catalog-section"><h4>Field Map — Real Boundary + NDVI + Zones</h4><canvas id="satelliteFieldCanvas" width="240" height="240"></canvas><div class="catalog-muted">Green polygon: real field boundary. Colored cells: real per-pixel NDVI. Colored outlines: evidence-based (GIS_DERIVED) management zones, once generated — never a placeholder image.</div></div>`,
      `<div class="catalog-section"><h4>Evidence-Based Management Zones</h4>${zoneButton}${zonesBody}</div>`,
      `<div class="catalog-section"><h4>ML Model — Crop Classification (Benchmark Validation Only)</h4>${modelBody}</div>`
    ].join('');

    document.getElementById('satelliteFetchBtn')?.addEventListener('click', () => this.onFetchRequested?.());
    document.getElementById('satelliteZonesBtn')?.addEventListener('click', () => this.onGenerateZonesRequested?.());
  }
}
