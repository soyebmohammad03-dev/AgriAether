import { describe, expect, it } from 'vitest';
import { t, AVAILABLE_LANGUAGES } from './i18n';

describe('t', () => {
  it('translates a known key into Hindi', () => {
    expect(t('farmer.title', 'hi')).toBe('खेत का विवरण');
  });

  it('falls back to the raw key for an unknown key rather than showing blank', () => {
    expect(t('nonexistent.key', 'en')).toBe('nonexistent.key');
  });

  it('supports at least English and Hindi', () => {
    const codes = AVAILABLE_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
  });
});
