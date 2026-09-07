import { describe, expect, it } from 'vitest';
import { createCommunityContribution, reviewContribution } from './CommunityContribution';

describe('createCommunityContribution', () => {
  it('starts UNVERIFIED regardless of provenance', () => {
    const c = createCommunityContribution({ type: 'KNOWLEDGE_NOTE', title: 'Local pest sighting', body: 'x', contributorId: 'farmer_1', provenance: 'USER_REPORTED' });
    expect(c.verification).toBe('UNVERIFIED');
  });

  it('rejects an empty title', () => {
    expect(() => createCommunityContribution({ type: 'KNOWLEDGE_NOTE', title: '', body: 'x', contributorId: 'f1', provenance: 'USER_REPORTED' })).toThrow();
  });
});

describe('reviewContribution', () => {
  it('moves UNVERIFIED -> REVIEWED once', () => {
    const c = createCommunityContribution({ type: 'OBSERVATION', title: 'x', body: 'x', contributorId: 'f1', provenance: 'USER_REPORTED' });
    const reviewed = reviewContribution(c, 'REVIEWED');
    expect(reviewed.verification).toBe('REVIEWED');
  });

  it('rejects re-reviewing an already-REVIEWED contribution', () => {
    const c = createCommunityContribution({ type: 'OBSERVATION', title: 'x', body: 'x', contributorId: 'f1', provenance: 'USER_REPORTED' });
    const reviewed = reviewContribution(c, 'REVIEWED');
    expect(() => reviewContribution(reviewed, 'REJECTED')).toThrow();
  });
});
