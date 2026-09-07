export type SyncStatus = 'LOCAL' | 'SYNCED' | 'PENDING' | 'STALE' | 'ERROR';

/**
 * This repository has no remote sync endpoint — see the Phase 13 brief's
 * explicit "no real cloud sync" constraint. `hasRemoteEndpoint` exists so
 * this function tells the truth about that: with no endpoint, a record can
 * only ever be LOCAL (queued for a sync that doesn't exist yet) or ERROR
 * (a real, observed failure) — never SYNCED or PENDING, which would imply
 * a remote round trip that isn't actually happening.
 */
export function deriveSyncStatus(params: { hasRemoteEndpoint: boolean; error: string | null }): SyncStatus {
  if (params.error) return 'ERROR';
  if (!params.hasRemoteEndpoint) return 'LOCAL';
  return 'PENDING';
}

/**
 * Whether a record's last known timestamp is stale relative to `now` — the
 * same staleness concept TemporalIntelligence.classifyFreshness already
 * uses, exposed here for offline-state UI so "this data might be old" is
 * always visible rather than silently presented as current.
 */
export function isStale(timestamp: number | null, now: number, staleAfterMs: number): boolean {
  if (timestamp === null) return true;
  return now - timestamp > staleAfterMs;
}

export type ConflictState = 'NONE' | 'LOCAL_ONLY' | 'CONFLICT';

/**
 * Foundation only — with no remote endpoint (see deriveSyncStatus), every
 * local record is LOCAL_ONLY today. This exists so a future real sync
 * implementation has a documented decision point (matching updatedAt =
 * NONE, diverging = CONFLICT) instead of one invented later without a
 * contract, and so this codebase never silently auto-resolves a conflict
 * it can't actually detect yet.
 */
export function detectConflict(local: { updatedAt: number }, remote: { updatedAt: number } | null): ConflictState {
  if (!remote) return 'LOCAL_ONLY';
  return local.updatedAt === remote.updatedAt ? 'NONE' : 'CONFLICT';
}
