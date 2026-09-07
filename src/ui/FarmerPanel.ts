import type { FarmerOverview } from '../farmer/FarmerInsights';
import type { FarmTask } from '../farmer/Task';
import type { SyncStatus } from '../offline/OfflineSync';
import { t, AVAILABLE_LANGUAGES, type LanguageCode } from '../i18n/i18n';
import { escapeHtml as esc } from './escapeHtml';

export interface FarmerViewModel {
  overview: FarmerOverview;
  tasks: FarmTask[];
  syncStatus: SyncStatus;
  language: LanguageCode;
}

/**
 * The farmer-facing view: plain-language current state, opportunities, and
 * tasks — no NDVI/CRS/sensor ids, no raw scores. Every list falls back to
 * an honest empty message rather than disappearing silently. Closed by
 * default, following the existing operator panels; onLanguageChange lets
 * the host swap `language` without this panel owning that state itself.
 */
export class FarmerPanel {
  private readonly panel = document.getElementById('farmerPanel');
  private readonly content = document.getElementById('farmerContent');
  private open = false;
  onLanguageChange: ((lang: LanguageCode) => void) | null = null;
  onTaskAction: ((taskId: string, action: 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED') => void) | null = null;

  toggle(): boolean {
    this.open = !this.open;
    this.panel?.classList.toggle('hidden', !this.open);
    return this.open;
  }

  private list(items: { text: string }[], emptyText: string): string {
    return items.length ? items.map((i) => `<div class="catalog-dataset">${esc(i.text)}</div>`).join('') : `<div class="catalog-muted">${emptyText}</div>`;
  }

  render(vm: FarmerViewModel): void {
    if (!this.content) return;
    const { overview, tasks, syncStatus, language } = vm;
    const lang = (key: string) => t(key, language);

    const languageSwitcher = AVAILABLE_LANGUAGES.map((l) => `<button class="lang-btn" data-lang="${l.code}" ${l.code === language ? 'disabled' : ''}>${l.label}</button>`).join(' ');

    const syncKey: Record<SyncStatus, string> = { LOCAL: 'sync.local', SYNCED: 'sync.synced', PENDING: 'sync.pending', STALE: 'sync.stale', ERROR: 'sync.error' };

    const taskActions = (task: FarmTask): string => {
      if (task.status === 'OPEN') return `<button class="lang-btn" data-task="${task.id}" data-action="IN_PROGRESS">${lang('action.markInProgress')}</button> <button class="lang-btn" data-task="${task.id}" data-action="DISMISSED">${lang('action.dismiss')}</button>`;
      if (task.status === 'IN_PROGRESS') return `<button class="lang-btn" data-task="${task.id}" data-action="COMPLETED">${lang('action.markComplete')}</button>`;
      return '';
    };
    const taskRows = tasks.length
      ? tasks
          .map(
            (task) =>
              `<div class="catalog-kv"><span>${task.type.replace(/_/g, ' ')} (${task.priority})</span><span>${lang(`status.${task.status === 'IN_PROGRESS' ? 'inProgress' : task.status.toLowerCase()}`)}</span></div><div class="catalog-muted">${esc(task.reason)}</div><div>${taskActions(task)}</div>`
          )
          .join('')
      : `<div class="catalog-muted">No open tasks.</div>`;

    this.content.innerHTML = [
      `<div class="catalog-section"><h4>${lang('farmer.title')} — ${esc(overview.fieldName)}</h4><div>${languageSwitcher}</div></div>`,
      `<div class="catalog-section"><h4>${lang('farmer.conditions')}</h4>${this.list(overview.currentConditions, 'No current condition data yet.')}</div>`,
      `<div class="catalog-section"><h4>${lang('farmer.changes')}</h4>${this.list(overview.importantChanges, 'No notable changes recently.')}</div>`,
      `<div class="catalog-section"><h4>${lang('farmer.opportunities')}</h4>${this.list(overview.opportunities, 'Nothing needs action right now.')}</div>`,
      `<div class="catalog-section"><h4>${lang('farmer.tasks')}</h4>${taskRows}</div>`,
      `<div class="catalog-section"><h4>${lang('farmer.mission')}</h4><div class="catalog-dataset">${overview.missionStatusText}</div></div>`,
      `<div class="catalog-section"><h4>${lang('farmer.dataQuality')}</h4>${this.list(overview.dataQualityWarnings, 'No data quality issues detected.')}</div>`,
      `<div class="catalog-section"><h4>${lang('farmer.missingInfo')}</h4>${this.list(overview.missingInformationRequests, 'Nothing more needed right now.')}</div>`,
      `<div class="catalog-section"><h4>${lang('farmer.offline')}</h4><div class="catalog-kv"><span>${lang(syncKey[syncStatus])}</span></div></div>`
    ].join('');

    this.content.querySelectorAll<HTMLButtonElement>('.lang-btn[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => this.onLanguageChange?.(btn.dataset.lang as LanguageCode));
    });
    this.content.querySelectorAll<HTMLButtonElement>('.lang-btn[data-task]').forEach((btn) => {
      btn.addEventListener('click', () => this.onTaskAction?.(btn.dataset.task!, btn.dataset.action as 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED'));
    });
  }
}
