import type { GrowthStage } from '../domain/Crop';

/**
 * Crop-specific context for analysis functions that can use it —
 * deliberately NOT a source of numeric agronomic thresholds. This
 * repository has no validated, cited source for crop-specific moisture/
 * nutrient/stress thresholds, and Part 7 of this milestone's brief is
 * explicit: do not invent agronomic thresholds. So every threshold field
 * here is `null` and `hasValidatedThresholds` is always `false` until a
 * real cited source is added — a CropProfile today only ever narrows
 * *which* generic evidence categories and risk-factor descriptions are
 * relevant to a crop, never fabricates a crop-specific number.
 *
 * `UNCONFIGURED_CROP_PROFILE` is the honest default: every consumer
 * (CropStressSignal, DiseasePestSignal, IrrigationIntelligence, ...) must
 * treat "no profile" or "profile without validated thresholds" as a
 * reason to keep using its existing generic behavior, never a reason to
 * guess.
 */
export interface CropProfile {
  id: string;
  cropTypeId: string | null;
  cropName: string;
  cultivar: string | null;
  version: string;
  /** Which of the existing domain/Crop.ts GrowthStage values this crop actually passes through — reuses the existing enum, never a parallel one. */
  applicableGrowthStages: GrowthStage[];
  hasValidatedThresholds: boolean;
  moistureThresholds: null;
  nutrientThresholds: null;
  /** Descriptive risk-factor names this crop is relevant to — references the SAME generic, evidence-based risk factors DiseasePestSignal.ts already screens for (e.g. "favorable_fungal_conditions"), never a new numeric cutoff. */
  relevantDiseaseRiskFactors: string[];
  /** Observation types most useful for this crop's context — informs, never gates, existing evidence requirements. */
  evidenceRequirements: string[];
  sourceCitation: string;
  createdAt: number;
}

const now = Date.UTC(2026, 0, 1);

/**
 * Two crops only, and only the two present in the real, cited dataset this
 * milestone's ML model was trained on (see ml/manifests/model_manifest.json)
 * — "Corn" and "Soybeans" are literal class labels from the USDA Cropland
 * Data Layer via ibm-nasa-geospatial/multi-temporal-crop-classification.
 * No other crop is configured because no validated source for one was
 * available in this session — see UNCONFIGURED_CROP_PROFILE below.
 */
export const CROP_PROFILES: Record<string, CropProfile> = {
  corn: {
    id: 'crop_profile_corn_v1',
    cropTypeId: null,
    cropName: 'Corn (Zea mays)',
    cultivar: null,
    version: '1.0.0',
    applicableGrowthStages: ['PLANTED', 'EMERGENCE', 'VEGETATIVE', 'FLOWERING', 'MATURITY', 'HARVESTED'],
    hasValidatedThresholds: false,
    moistureThresholds: null,
    nutrientThresholds: null,
    relevantDiseaseRiskFactors: ['favorable_fungal_conditions', 'saturated_soil_root_rot_risk'],
    evidenceRequirements: ['vegetation_index.ndvi', 'soil.moisture', 'weather.daily_precipitation'],
    sourceCitation: 'Class label taxonomy: USDA Cropland Data Layer (CDL), via ibm-nasa-geospatial/multi-temporal-crop-classification (CC-BY-4.0). No crop-specific numeric threshold source is cited yet — see hasValidatedThresholds.',
    createdAt: now
  },
  soybeans: {
    id: 'crop_profile_soybeans_v1',
    cropTypeId: null,
    cropName: 'Soybeans (Glycine max)',
    cultivar: null,
    version: '1.0.0',
    applicableGrowthStages: ['PLANTED', 'EMERGENCE', 'VEGETATIVE', 'FLOWERING', 'MATURITY', 'HARVESTED'],
    hasValidatedThresholds: false,
    moistureThresholds: null,
    nutrientThresholds: null,
    relevantDiseaseRiskFactors: ['favorable_fungal_conditions', 'saturated_soil_root_rot_risk'],
    evidenceRequirements: ['vegetation_index.ndvi', 'soil.moisture', 'weather.daily_precipitation'],
    sourceCitation: 'Class label taxonomy: USDA Cropland Data Layer (CDL), via ibm-nasa-geospatial/multi-temporal-crop-classification (CC-BY-4.0). No crop-specific numeric threshold source is cited yet — see hasValidatedThresholds.',
    createdAt: now
  }
};

/** The explicit non-guess: returned whenever a crop is unknown or has no configured profile. Every crop-aware function must treat this the same as "no profile at all." */
export const UNCONFIGURED_CROP_PROFILE: CropProfile = {
  id: 'crop_profile_unconfigured',
  cropTypeId: null,
  cropName: 'UNKNOWN',
  cultivar: null,
  version: '1.0.0',
  applicableGrowthStages: [],
  hasValidatedThresholds: false,
  moistureThresholds: null,
  nutrientThresholds: null,
  relevantDiseaseRiskFactors: [],
  evidenceRequirements: [],
  sourceCitation: 'No crop identified or no profile configured for this crop.',
  createdAt: now
};

/** Case-insensitive lookup by common name — never guesses a close match; an unrecognized name returns UNCONFIGURED_CROP_PROFILE, not the nearest profile. */
export function getCropProfile(cropCommonName: string | null | undefined): CropProfile {
  if (!cropCommonName) return UNCONFIGURED_CROP_PROFILE;
  const key = cropCommonName.trim().toLowerCase();
  return CROP_PROFILES[key] ?? UNCONFIGURED_CROP_PROFILE;
}
