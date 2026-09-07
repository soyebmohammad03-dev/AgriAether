import type { SentinelFieldAnalysisResult } from '../satellite/SentinelFieldPipeline';
import type { DatasetRecord } from '../data/Dataset';
import { escapeHtml as esc } from './escapeHtml';

export type SatellitePanelState =
  | { status: 'IDLE' }
  | { status: 'LOADING'; message: string }
  | { status: 'ERROR'; message: string }
  | { status: 'READY'; analysis: SentinelFieldAnalysisResult; dataset: DatasetRecord };

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

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(state: SatellitePanelState): void {
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

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Sentinel-2 L2A — Real Earth Observation</h4>${fetchButton}</div>`,
      `<div class="catalog-section">${body}</div>`,
      `<div class="catalog-section"><h4>Field Map — Real Boundary + NDVI</h4><canvas id="satelliteFieldCanvas" width="240" height="240"></canvas><div class="catalog-muted">Green polygon: real field boundary. Colored cells: real per-pixel NDVI (only shown once a fetch succeeds) — never a placeholder image.</div></div>`
    ].join('');

    document.getElementById('satelliteFetchBtn')?.addEventListener('click', () => this.onFetchRequested?.());
  }
}
