import type { SpectralBand } from './SpectralBand';

export type SpectralIndexId = 'NDVI' | 'GNDVI' | 'NDRE' | 'SAVI' | 'EVI';

/**
 * One vegetation index's formula and requirements, documented rather than
 * assumed. Every formula here is a well-established published one — this
 * module does not invent new agronomic math, only implements it correctly
 * and refuses to run it on missing inputs.
 */
export interface SpectralIndexDefinition {
  id: SpectralIndexId;
  name: string;
  requiredBands: SpectralBand[];
  /** The formula, as documentation — not executed from this string. */
  formula: string;
  /** The index's defined numeric range, where one exists. */
  range: [number, number] | null;
  assumptions: string;
  limitations: string;
  calculate: (bands: Record<SpectralBand, number>) => number;
}

const SAVI_L = 0.5; // standard soil-brightness correction factor for moderate vegetation cover

export const SPECTRAL_INDEX_DEFINITIONS: Record<SpectralIndexId, SpectralIndexDefinition> = {
  NDVI: {
    id: 'NDVI',
    name: 'Normalized Difference Vegetation Index',
    requiredBands: ['RED', 'NIR'],
    formula: '(NIR - RED) / (NIR + RED)',
    range: [-1, 1],
    assumptions: 'Bands are calibrated reflectance (0-1), not raw radiance.',
    limitations: 'Saturates at high canopy cover; sensitive to soil background at low cover; requires cloud-free, well-lit capture.',
    calculate: (b) => (b.NIR - b.RED) / (b.NIR + b.RED)
  },
  GNDVI: {
    id: 'GNDVI',
    name: 'Green Normalized Difference Vegetation Index',
    requiredBands: ['GREEN', 'NIR'],
    formula: '(NIR - GREEN) / (NIR + GREEN)',
    range: [-1, 1],
    assumptions: 'Bands are calibrated reflectance (0-1).',
    limitations: 'More sensitive to chlorophyll concentration than NDVI but similarly saturates at high canopy cover.',
    calculate: (b) => (b.NIR - b.GREEN) / (b.NIR + b.GREEN)
  },
  NDRE: {
    id: 'NDRE',
    name: 'Normalized Difference Red Edge',
    requiredBands: ['RED_EDGE', 'NIR'],
    formula: '(NIR - RED_EDGE) / (NIR + RED_EDGE)',
    range: [-1, 1],
    assumptions: 'Bands are calibrated reflectance (0-1); sensor has a red-edge band, which most consumer RGB/NIR sensors lack.',
    limitations: 'Requires a red-edge band most low-cost multispectral sensors do not include — do not substitute RED for RED_EDGE.',
    calculate: (b) => (b.NIR - b.RED_EDGE) / (b.NIR + b.RED_EDGE)
  },
  SAVI: {
    id: 'SAVI',
    name: 'Soil-Adjusted Vegetation Index',
    requiredBands: ['RED', 'NIR'],
    formula: `((NIR - RED) / (NIR + RED + L)) * (1 + L), L=${SAVI_L}`,
    range: [-1, 1],
    assumptions: `Bands are calibrated reflectance (0-1); L=${SAVI_L} is the standard fixed correction factor for moderate vegetation density, not fitted to this field.`,
    limitations: 'L is a fixed approximation, not calibrated for this specific soil/canopy — treat as indicative, not precise.',
    calculate: (b) => ((b.NIR - b.RED) / (b.NIR + b.RED + SAVI_L)) * (1 + SAVI_L)
  },
  EVI: {
    id: 'EVI',
    name: 'Enhanced Vegetation Index',
    requiredBands: ['BLUE', 'RED', 'NIR'],
    formula: '2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)',
    range: [-1, 1], // not a hard mathematical bound (see limitations) but the practically meaningful range published usage treats as valid
    assumptions: 'Bands are calibrated reflectance (0-1); requires a blue band most basic multispectral sensors omit.',
    limitations: 'Denominator can approach zero under some reflectance combinations, producing extreme values — treat outputs outside roughly [-1, 1] as numerically unstable, not agronomically meaningful.',
    calculate: (b) => (2.5 * (b.NIR - b.RED)) / (b.NIR + 6 * b.RED - 7.5 * b.BLUE + 1)
  }
};
