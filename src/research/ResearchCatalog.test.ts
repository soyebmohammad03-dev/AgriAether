import { describe, expect, it } from 'vitest';
import { buildResearchCatalog } from './ResearchCatalog';
import { PLANNED_MODELS } from '../sensing/ModelRegistry';

describe('buildResearchCatalog', () => {
  it('indexes real models without fabricating any new record', () => {
    const catalog = buildResearchCatalog({ datasets: [], models: PLANNED_MODELS, experiments: [], decisionTraces: [] });
    expect(catalog.length).toBe(PLANNED_MODELS.length);
    expect(catalog.every((e) => e.kind === 'model')).toBe(true);
  });

  it('returns an empty catalog when nothing exists yet, never a placeholder entry', () => {
    const catalog = buildResearchCatalog({ datasets: [], models: [], experiments: [], decisionTraces: [] });
    expect(catalog).toEqual([]);
  });
});
