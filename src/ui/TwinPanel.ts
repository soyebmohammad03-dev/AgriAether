import type { FieldTwinSnapshot } from '../twin/FieldTwin';
import type { GraphNode } from '../graph/KnowledgeGraph';
import type { DatasetReadinessCheck } from '../sensing/ModelRegistry';
import { escapeHtml as esc } from './escapeHtml';

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

  render(twin: FieldTwinSnapshot, evidenceNodes: GraphNode[], modelReadiness: DatasetReadinessCheck[] = []): void {
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

    const diseasePestRows =
      twin.diseasePestRisk.riskFactors.length > 0
        ? twin.diseasePestRisk.riskFactors.map((f) => `<div class="catalog-gap">${f.type}: ${f.description}</div>`).join('')
        : `<div class="catalog-muted">${twin.diseasePestRisk.status} — no known risk factor fired.</div>`;
    const diseasePestMissingRow = twin.diseasePestRisk.missingEvidence.length
      ? `<div class="catalog-muted">Missing evidence: ${twin.diseasePestRisk.missingEvidence.join(', ')}</div>`
      : '';

    const irrigationRows = [
      twin.irrigation.moistureStatus ? `<div class="catalog-kv"><span>Moisture status</span><span>${twin.irrigation.moistureStatus}</span></div>` : '',
      `<div class="catalog-kv"><span>Recent rainfall</span><span>${fmtValue(twin.irrigation.recentRainfallMm)}${twin.irrigation.recentRainfallMm !== null ? 'mm' : ''}</span></div>`,
      `<div class="catalog-kv"><span>Recent irrigation events</span><span>${twin.irrigation.recentIrrigationEvents.length}</span></div>`,
      `<div class="catalog-kv"><span>Need status</span><span>${twin.irrigation.needStatus}</span></div>`,
      ...twin.irrigation.reasons.map((r) => `<div class="catalog-gap">${r}</div>`),
      twin.irrigation.missingEvidence.length ? `<div class="catalog-muted">Missing evidence: ${twin.irrigation.missingEvidence.join(', ')}</div>` : ''
    ].join('');

    const nutrientRow = (label: string, reading: typeof twin.nutrient.nitrogen) =>
      reading
        ? `<div class="catalog-kv"><span>${label}</span><span>${reading.value.toFixed(1)}ppm — ${reading.status}</span></div>`
        : `<div class="catalog-muted">${label}: missing</div>`;
    const nutrientRows = [
      nutrientRow('Nitrogen', twin.nutrient.nitrogen),
      nutrientRow('Phosphorus', twin.nutrient.phosphorus),
      nutrientRow('Potassium', twin.nutrient.potassium)
    ].join('');

    const recommendationRows = twin.recommendations.length
      ? twin.recommendations
          .map(
            (r) =>
              `<div class="catalog-gap"><strong>${r.category}</strong> (${r.status}${r.urgency ? `, ${r.urgency}` : ''}): ${r.proposedAction}${
                r.missingEvidence.length ? ` — missing: ${r.missingEvidence.join(', ')}` : ''
              }</div>`
          )
          .join('')
      : '<div class="catalog-muted">No recommendations — insufficient evidence or nothing fired.</div>';

    const optimizationRows = twin.fieldOptimization.triggers.map((t) => `<div class="catalog-kv"><span></span><span>${t}</span></div>`).join('');

    const modelReadinessRows = modelReadiness.length
      ? modelReadiness
          .map((m) => `<div class="catalog-kv"><span>${m.task}</span><span class="${m.status === 'READY' ? 'catalog-ok' : 'catalog-gap'}">${m.status} (${m.labeledSampleCount}/${m.minLabeledSamples} labeled)</span></div>`)
          .join('')
      : '';

    const graphRows = evidenceNodes.length
      ? evidenceNodes.slice(0, 20).map((n) => `<div class="catalog-dataset">${n.type}: ${n.label}${n.timestamp ? ` @ ${new Date(n.timestamp).toLocaleTimeString()}` : ''}</div>`).join('')
      : '<div class="catalog-muted">No graph-linked observation evidence found for this field yet.</div>';

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Digital Twin — ${esc(twin.fieldName)}</h4>`,
      `<div class="catalog-kv"><span>Zones</span><span>${twin.zones.length}</span></div>`,
      `<div class="catalog-kv"><span>Active sensors</span><span>${twin.activeSensors.length}</span></div>`,
      `<div class="catalog-kv"><span>Generated</span><span>${new Date(twin.generatedAt).toLocaleTimeString()}</span></div></div>`,
      `<div class="catalog-section"><h4>Soil State</h4>${soilRows}</div>`,
      `<div class="catalog-section"><h4>Crop State</h4>${cropRows}</div>`,
      `<div class="catalog-section"><h4>Weather Context</h4>${weatherRows}</div>`,
      `<div class="catalog-section"><h4>Vegetation Evidence</h4>${vegetationRows}</div>`,
      `<div class="catalog-section"><h4>Recent Trends (7d, measured-vs-measured, never modeled)</h4>${trendRows}</div>`,
      `<div class="catalog-section"><h4>Fused Evidence — Field Window</h4>${evidenceItemRows}${conflictRows}${missingRows}</div>`,
      `<div class="catalog-section"><h4>Disease / Pest Risk Factors (${twin.diseasePestRisk.status}, screen only — never a diagnosis)</h4>${diseasePestRows}${diseasePestMissingRow}</div>`,
      `<div class="catalog-section"><h4>Irrigation Status</h4>${irrigationRows}</div>`,
      `<div class="catalog-section"><h4>Nutrient Evidence (bands only, never a fertility score)</h4>${nutrientRows}</div>`,
      `<div class="catalog-section"><h4>Field Optimization — ${twin.fieldOptimization.status}</h4>${optimizationRows}</div>`,
      `<div class="catalog-section"><h4>Recommendations</h4>${recommendationRows}</div>`,
      modelReadinessRows ? `<div class="catalog-section"><h4>Model Readiness</h4>${modelReadinessRows}</div>` : '',
      `<div class="catalog-section"><h4>Knowledge Graph — Observation Evidence</h4>${graphRows}</div>`
    ].join('');
  }
}
