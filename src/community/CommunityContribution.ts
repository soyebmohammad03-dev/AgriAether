import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';

export type ContributionType = 'OBSERVATION' | 'FIELD_RESEARCH' | 'KNOWLEDGE_NOTE' | 'DATASET_REFERENCE';
export type VerificationState = 'UNVERIFIED' | 'REVIEWED' | 'REJECTED';

/**
 * Contributions reuse Observation's Provenance vocabulary rather than a
 * parallel enum — USER_REPORTED/MEASURED/EXTERNAL cover the task brief's
 * DERIVED (~ESTIMATED), MODELED (~PREDICTED), and SIMULATED cases exactly.
 * A contribution's provenance is asserted by the contributor, not verified
 * by this module — that's what `verification` is for.
 */
export interface CommunityContribution {
  id: string;
  type: ContributionType;
  fieldId: string | null;
  zoneId: string | null;
  title: string;
  body: string;
  /** Free-form contributor identifier — no authentication system exists yet, see Phase 13 brief. */
  contributorId: string;
  provenance: Provenance;
  verification: VerificationState;
  referenceObservationIds: string[];
  createdAt: number;
}

const VERIFICATION_TRANSITIONS: Record<VerificationState, VerificationState[]> = {
  UNVERIFIED: ['REVIEWED', 'REJECTED'],
  REVIEWED: [],
  REJECTED: []
};

export function createCommunityContribution(params: {
  type: ContributionType;
  fieldId?: string | null;
  zoneId?: string | null;
  title: string;
  body: string;
  contributorId: string;
  provenance: Provenance;
  referenceObservationIds?: string[];
}): CommunityContribution {
  if (!params.title.trim()) {
    throw new Error('CommunityContribution requires a non-empty title');
  }
  if (!params.contributorId.trim()) {
    throw new Error('CommunityContribution requires a contributorId');
  }
  return {
    id: createId('contribution'),
    type: params.type,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    title: params.title,
    body: params.body,
    contributorId: params.contributorId,
    provenance: params.provenance,
    verification: 'UNVERIFIED',
    referenceObservationIds: params.referenceObservationIds ?? [],
    createdAt: Date.now()
  };
}

/**
 * A contribution starts UNVERIFIED and can only ever be reviewed once — it
 * never silently becomes authoritative. No automatic promotion path exists
 * anywhere in this codebase from a contribution into a Recommendation or
 * Digital Twin state; a caller wanting to act on one must treat
 * `verification` and `provenance` as first-class facts, always displayed
 * alongside the content.
 */
export function reviewContribution(contribution: CommunityContribution, to: 'REVIEWED' | 'REJECTED'): CommunityContribution {
  if (!VERIFICATION_TRANSITIONS[contribution.verification].includes(to)) {
    throw new Error(`Invalid verification transition: ${contribution.verification} -> ${to}`);
  }
  return { ...contribution, verification: to };
}
