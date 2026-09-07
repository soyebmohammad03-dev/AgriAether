import type { Explanation } from '../explainability/Explanation';
import type { DecisionTrace } from '../explainability/DecisionTrace';
import type { Experiment } from '../research/Experiment';
import type { ResearchCatalogEntry } from '../research/ResearchCatalog';
import { escapeHtml as esc } from './escapeHtml';

export interface ResearchViewModel {
  explanation: Explanation | null;
  decisionTrace: DecisionTrace | null;
  experiment: Experiment | null;
  catalog: ResearchCatalogEntry[];
}

/**
 * "Why this result?" — the research/explainability view. Every section
 * answers one of the brief's questions (what data, what transformation,
 * which rule, what assumptions, is it reproducible) directly from an
 * Explanation/DecisionTrace/Experiment already computed elsewhere. Closed
 * by default, following the existing operator panels.
 */
export class ResearchPanel {
  private readonly panel = document.getElementById('researchPanel');
  private readonly content = document.getElementById('researchContent');
  private open = false;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(vm: ResearchViewModel): void {
    if (!this.content) return;
    const { explanation, decisionTrace, experiment, catalog } = vm;

    const explanationRows = explanation
      ? [
          `<div class="catalog-kv"><span>Conclusion</span><span>${explanation.conclusion}</span></div>`,
          `<div class="catalog-kv"><span>Confidence</span><span>${explanation.confidence ?? 'not reported'}</span></div>`,
          `<div class="catalog-kv"><span>Method</span><span>${explanation.method}</span></div>`,
          `<div class="catalog-dataset">Farmer: ${esc(explanation.farmerText)}</div>`,
          `<div class="catalog-dataset">Technical: ${esc(explanation.technicalText)}</div>`,
          `<div class="catalog-kv"><span>Evidence used</span><span>${explanation.evidenceObservationIds.join(', ') || 'none'}</span></div>`,
          `<div class="catalog-kv"><span>Evidence not available</span><span>${explanation.evidenceNotAvailable.join(', ') || 'none'}</span></div>`,
          ...explanation.assumptions.map((a) => `<div class="catalog-muted">Assumption: ${a}</div>`),
          ...explanation.limitations.map((l) => `<div class="catalog-gap">Limitation: ${l}</div>`)
        ].join('')
      : '<div class="catalog-muted">Nothing to explain yet — no actionable result for this field.</div>';

    const traceRows = decisionTrace
      ? decisionTrace.steps.map((s) => `<div class="catalog-kv"><span>${s.stage}</span><span>${s.description}</span></div>`).join('')
      : '<div class="catalog-muted">No decision trace available.</div>';

    const experimentRows = experiment
      ? [
          `<div class="catalog-kv"><span>Baseline (${experiment.baselineKind})</span><span>${experiment.baselineSummary}</span></div>`,
          ...experiment.scenarioChanges.map((c) => `<div class="catalog-muted">Changed ${c.field}: ${String(c.fromValue)} → ${String(c.toValue)} (${c.kind})</div>`),
          ...experiment.results.map((r) => `<div class="catalog-kv"><span>${r.label} (${r.kind})</span><span>${String(r.value)}</span></div>`),
          `<div class="catalog-muted">${experiment.reproducibilityNote}</div>`
        ].join('')
      : '<div class="catalog-muted">No experiment run yet.</div>';

    const catalogRows = catalog.length
      ? catalog
          .slice(0, 15)
          .map((e) => `<div class="catalog-dataset">[${e.kind}] ${esc(e.title)} — ${esc(e.provenance)}</div>`)
          .join('')
      : '<div class="catalog-muted">No datasets, models, experiments, or traces yet.</div>';

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>Why This Result?</h4>${explanationRows}</div>`,
      `<div class="catalog-section"><h4>Decision Trace</h4>${traceRows}</div>`,
      `<div class="catalog-section"><h4>Experiment / What-If</h4>${experimentRows}</div>`,
      `<div class="catalog-section"><h4>Research Catalog</h4>${catalogRows}</div>`
    ].join('');
  }
}
