import { describe, expect, it } from 'vitest';
import { getCropProfile, CROP_PROFILES, UNCONFIGURED_CROP_PROFILE } from './CropProfile';

describe('getCropProfile', () => {
  it('returns UNCONFIGURED_CROP_PROFILE for an unrecognized crop rather than guessing', () => {
    expect(getCropProfile('quinoa')).toBe(UNCONFIGURED_CROP_PROFILE);
  });

  it('returns UNCONFIGURED_CROP_PROFILE for null/undefined', () => {
    expect(getCropProfile(null)).toBe(UNCONFIGURED_CROP_PROFILE);
    expect(getCropProfile(undefined)).toBe(UNCONFIGURED_CROP_PROFILE);
  });

  it('is case-insensitive for a configured crop', () => {
    expect(getCropProfile('Corn')).toBe(CROP_PROFILES.corn);
    expect(getCropProfile('CORN')).toBe(CROP_PROFILES.corn);
  });

  it('every configured profile is honest about having no validated numeric thresholds', () => {
    for (const profile of Object.values(CROP_PROFILES)) {
      expect(profile.hasValidatedThresholds).toBe(false);
      expect(profile.moistureThresholds).toBeNull();
      expect(profile.nutrientThresholds).toBeNull();
      expect(profile.sourceCitation.length).toBeGreaterThan(0);
    }
  });
});
