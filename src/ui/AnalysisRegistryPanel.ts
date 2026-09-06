import type { AnalysisEvaluation } from '../sensing/AnalysisRegistry';

/**
 * Lists every registered analysis with its real support status against the
 * currently deployed sensors — never a fake result. Computed once at
 * startup (sensor kinds don't change at runtime in Phase 4) and rendered
 * only while the panel is open.
 */
export class AnalysisRegistryPanel {
  private readonly panel = document.getElementById('analysisRegistryPanel');
  private readonly list = document.getElementById('analysisRegistryList');
  private open = false;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  render(evaluations: AnalysisEvaluation[]): void {
    if (!this.list) return;
    this.list.innerHTML = evaluations
      .map(({ definition, availability, reason }) => {
        const statusClass = availability === 'SUPPORTED' ? 'analysis-supported' : 'analysis-unsupported';
        return [
          `<div class="analysis-row">`,
          `<div class="analysis-row-head"><span class="analysis-name">${definition.name}</span><span class="analysis-status ${statusClass}">${availability}</span></div>`,
          `<div class="analysis-detail">Inputs: ${definition.inputSummary}</div>`,
          `<div class="analysis-detail">Output: ${definition.outputSummary}</div>`,
          `<div class="analysis-detail analysis-reason">${reason}</div>`,
          `</div>`
        ].join('');
      })
      .join('');
  }
}
