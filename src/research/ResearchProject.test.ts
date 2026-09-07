import { describe, expect, it } from 'vitest';
import { createResearchProject, createResearchFinding } from './ResearchProject';

describe('createResearchProject', () => {
  it('rejects an empty name', () => {
    expect(() => createResearchProject({ name: '', description: 'x' })).toThrow();
  });

  it('starts with no experiments/datasets/models/findings — nothing fabricated', () => {
    const project = createResearchProject({ name: 'Irrigation study', description: 'x' });
    expect(project.experimentIds).toEqual([]);
    expect(project.findingIds).toEqual([]);
  });
});

describe('createResearchFinding', () => {
  it('always starts UNVERIFIED, never presented as settled', () => {
    const finding = createResearchFinding({ projectId: 'p1', summary: 'Zones with saturated soil showed elevated risk factors more often.', provenance: 'experiment:e1' });
    expect(finding.verification).toBe('UNVERIFIED');
  });
});
