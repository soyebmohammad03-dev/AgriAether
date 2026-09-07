import { describe, expect, it, beforeEach } from 'vitest';
import { diagnostics } from './Diagnostics';

describe('diagnostics', () => {
  beforeEach(() => diagnostics.clearForTests());

  it('records an event with a generated id and timestamp', () => {
    const event = diagnostics.log({ severity: 'WARN', category: 'IMPORT', operation: 'test.op', message: 'x' });
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('recent() returns newest first', () => {
    diagnostics.log({ severity: 'INFO', category: 'GENERAL', operation: 'a', message: 'first' });
    diagnostics.log({ severity: 'INFO', category: 'GENERAL', operation: 'b', message: 'second' });
    const recent = diagnostics.recent(2);
    expect(recent[0].message).toBe('second');
  });

  it('caps the buffer at MAX_EVENTS rather than growing unbounded', () => {
    for (let i = 0; i < 600; i++) {
      diagnostics.log({ severity: 'DEBUG', category: 'GENERAL', operation: 'loop', message: `${i}` });
    }
    expect(diagnostics.recent(1000).length).toBeLessThanOrEqual(500);
  });

  it('byCategory filters correctly', () => {
    diagnostics.log({ severity: 'ERROR', category: 'PERSISTENCE', operation: 'x', message: 'db error' });
    diagnostics.log({ severity: 'INFO', category: 'MISSION', operation: 'y', message: 'mission info' });
    const persistenceOnly = diagnostics.byCategory('PERSISTENCE');
    expect(persistenceOnly.every((e) => e.category === 'PERSISTENCE')).toBe(true);
  });
});
