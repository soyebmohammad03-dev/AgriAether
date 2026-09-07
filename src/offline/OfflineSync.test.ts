import { describe, expect, it } from 'vitest';
import { deriveSyncStatus, isStale, detectConflict } from './OfflineSync';

describe('deriveSyncStatus', () => {
  it('never claims SYNCED or PENDING when there is no remote endpoint', () => {
    expect(deriveSyncStatus({ hasRemoteEndpoint: false, error: null })).toBe('LOCAL');
  });

  it('reports ERROR when a real error is present, even without a remote endpoint', () => {
    expect(deriveSyncStatus({ hasRemoteEndpoint: false, error: 'boom' })).toBe('ERROR');
  });
});

describe('isStale', () => {
  it('treats a null timestamp as stale', () => {
    expect(isStale(null, Date.now(), 1000)).toBe(true);
  });

  it('is false within the freshness window', () => {
    const now = 100_000;
    expect(isStale(now - 500, now, 1000)).toBe(false);
  });
});

describe('detectConflict', () => {
  it('reports LOCAL_ONLY when no remote record exists', () => {
    expect(detectConflict({ updatedAt: 1 }, null)).toBe('LOCAL_ONLY');
  });

  it('reports CONFLICT when timestamps diverge', () => {
    expect(detectConflict({ updatedAt: 1 }, { updatedAt: 2 })).toBe('CONFLICT');
  });
});
