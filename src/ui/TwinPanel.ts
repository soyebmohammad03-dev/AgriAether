import type { FieldTwinSnapshot } from '../twin/FieldTwin';
import type { GraphNode } from '../graph/KnowledgeGraph';

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return 'n/a';
  if (typeof v === 'number') return v.toFixed(2);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Compact Digital Twin + Evidence view: renders the FieldTwinSnapshot and
 * a small knowledge-graph evidence list, both computed elsewhere. Every
 * "no data" case is shown as an explicit INSUFFICIENT_DATA/empty message —
 * never a placeholder score. Closed by default, following DataCatalogPanel.
 */
export class TwinPanel {
  private readonly panel = document.getElementById('twinPanel');
  private readonly content = document.getElementById('twinContent');
  private open = false;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(twin: FieldTwinSnapshot, evidenceNodes: GraphNode[]): void {
    if (!this.content) return;

    const soilRows =
      twin.soilState === 'INSUFFICIENT_DATA'
        ? '<div class="catalog-muted">INSUFFICIENT_DATA — no soil sample recorded for this field.</div>'
        : [
            twin.soilState.moistureStatus ? `<div class="catalog-kv"><span>Moisture</span><span>${twin.soilState.moistureStatus}</span></div>` : '',
            twin.soilState.ecStatus ? `<div class="catalog-kv"><span>EC</span><span>${twin.soilState.ecStatus}</span></div>` : '',
            twin.soilState.phStatus ? `<div class="catalog-kv"><span>pH</span><span>${twin.soilState.phStatus}</span></div>` : '',
            `<div class="catalog-kv"><span>Completeness</span><span>${twin.soilState.completeness.presentCount}/${twin.soilState.completeness.totalKnownMeasurements}</span></div>`
          ].join('');

    const cropRows =
      twin.cropState.observationCount === 0
        ? '<div class="catalog-muted">INSUFFICIENT_DATA — no crop observations recorded.</div>'
        : [
            `<div class="catalog-kv"><span>Growth stage</span><span>${twin.cropState.latestGrowthStage}</span></div>`,
            twin.cropState.recentComparison
              ? `<div class="catalog-kv"><span>Progression</span><span>${twin.cropState.recentComparison.progression}</span></div>`
              : '<div class="catalog-muted">Only one observation — no progression yet.</div>'
          ].join('');

    const weatherRows =
      twin.weatherState === 'INSUFFICIENT_DATA'
        ? '<div class="catalog-muted">INSUFFICIENT_DATA — no weather history fetched.</div>'
        : [
            `<div class="catalog-kv"><span>Window</span><span>${twin.weatherState.windowDays}d</span></div>`,
            `<div class="catalog-kv"><span>Max temp avg</span><span>${fmtValue(twin.weatherState.tMaxAvgC)}${twin.weatherState.tMaxAvgC !== null ? '°C' : ''}</span></div>`,
            `<div class="catalog-kv"><span>Precipitation total</span><span>${fmtValue(twin.weatherState.precipitationTotalMm)}${twin.weatherState.precipitationTotalMm !== null ? 'mm' : ''}</span></div>`
          ].join('');

    const vegetationRows = twin.vegetationEvidence.length
      ? twin.vegetationEvidence.map((o) => `<div class="catalog-dataset">${o.type} = ${fmtValue(o.value)} (${o.provenance})</div>`).join('')
      : '<div class="catalog-muted">INSUFFICIENT_DATA — no vegetation-index observation for this field.</div>';

    const trendRows = Object.entries(twin.recentTrends)
      .map(([type, trend]) =>
        trend
          ? `<div class="catalog-kv"><span>${type}</span><span>${trend.direction}${trend.delta !== null ? ` (Δ${trend.delta.toFixed(2)})` : ''}</span></div>`
          : `<div class="catalog-muted">${type}: INSUFFICIENT_DATA</div>`
      )
      .join('');

    const evidenceItemRows = twin.evidence.items.length
      ? twin.evidence.items
          .map((i) => `<div class="catalog-kv"><span>${i.type}</span><span class="${i.freshness === 'STALE' ? 'catalog-gap' : 'catalog-ok'}">${fmtValue(i.observation.value)} — ${i.freshness}, ${i.sourceCategory}</span></div>`)
          .join('')
      : '<div class="catalog-muted">No evidence in the current window.</div>';

    const conflictRows = twin.evidence.conflicts.length
      ? twin.evidence.conflicts.map((c) => `<div class="catalog-gap">${c.reason}</div>`).join('')
      : '<div class="catalog-muted">No conflicting readings detected.</div>';

    const missingRows = twin.evidence.missingTypes.length
      ? `<div class="catalog-muted">Missing evidence: ${twin.evidence.missingTypes.join(', ')}</div>`
      : '';

    const graphRows = evidenceNodes.length
      ? evidenceNodes.slice(0, 20).map((n) => `<div class="catalog-dataset">${n.type}: ${n.label}${n.timestamp ? ` @ ${new Date(n.timestamp).toLocaleTimeString()}` : ''}</div>`).join('')
      : '<div class="catalog-muted">No graph-linked observation evidence found for this field yet.</div>';

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Digital Twin — ${twin.fieldName}</h4>`,
      `<div class="catalog-kv"><span>Zones</span><span>${twin.zones.length}</span></div>`,
      `<div class="catalog-kv"><span>Active sensors</span><span>${twin.activeSensors.length}</span></div>`,
      `<div class="catalog-kv"><span>Generated</span><span>${new Date(twin.generatedAt).toLocaleTimeString()}</span></div></div>`,
      `<div class="catalog-section"><h4>Soil State</h4>${soilRows}</div>`,
      `<div class="catalog-section"><h4>Crop State</h4>${cropRows}</div>`,
      `<div class="catalog-section"><h4>Weather Context</h4>${weatherRows}</div>`,
      `<div class="catalog-section"><h4>Vegetation Evidence</h4>${vegetationRows}</div>`,
      `<div class="catalog-section"><h4>Recent Trends (7d, measured-vs-measured, never modeled)</h4>${trendRows}</div>`,
      `<div class="catalog-section"><h4>Fused Evidence — Field Window</h4>${evidenceItemRows}${conflictRows}${missingRows}</div>`,
      `<div class="catalog-section"><h4>Knowledge Graph — Observation Evidence</h4>${graphRows}</div>`
    ].join('');
  }
}
