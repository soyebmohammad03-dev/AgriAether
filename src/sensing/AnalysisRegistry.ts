import type { SensorKind } from '../domain/SensorRecord';
import { SPECTRAL_INDEX_DEFINITIONS, type SpectralIndexId } from './SpectralIndex';

export type AnalysisAvailability = 'SUPPORTED' | 'UNSUPPORTED';

export interface AnalysisDefinition {
  id: string;
  name: string;
  category: 'VEGETATION_INDEX' | 'THERMAL' | 'CHANGE_DETECTION' | 'AGGREGATION';
  description: string;
  /** At least one deployed sensor of one of these kinds must exist for this analysis to be attemptable at all. */
  requiredSensorKinds: SensorKind[];
  inputSummary: string;
  outputSummary: string;
}

const VEGETATION_INDEX_ANALYSES: AnalysisDefinition[] = (Object.keys(SPECTRAL_INDEX_DEFINITIONS) as SpectralIndexId[]).map((id) => {
  const def = SPECTRAL_INDEX_DEFINITIONS[id];
  return {
    id: `vegetation_index:${id}`,
    name: def.name,
    category: 'VEGETATION_INDEX',
    description: def.formula,
    requiredSensorKinds: ['multispectral-camera'],
    inputSummary: `Bands: ${def.requiredBands.join(', ')} (calibrated reflectance)`,
    outputSummary: def.range ? `Unitless index, range [${def.range[0]}, ${def.range[1]}]` : 'Unitless index, unbounded'
  };
});

const OTHER_ANALYSES: AnalysisDefinition[] = [
  {
    id: 'thermal:canopy_air_temperature_difference',
    name: 'Canopy − Air Temperature Difference',
    category: 'THERMAL',
    description: 'canopy_temperature_c - air_temperature_c',
    requiredSensorKinds: ['thermal-camera'],
    inputSummary: 'One CANOPY thermal reading + one AIR thermal reading',
    outputSummary: 'Degrees C (a physical quantity — not an agronomic interpretation)'
  },
  {
    id: 'temporal:observation_change',
    name: 'Temporal Observation Change',
    category: 'CHANGE_DETECTION',
    description: 'Compares two same-type Observations from the same location over time',
    requiredSensorKinds: [], // works on any Observation stream already collected, not gated by a specific sensor kind
    inputSummary: 'Two Observations, same type and location, different timestamps',
    outputSummary: 'INCREASED | DECREASED | STABLE | INSUFFICIENT_DATA'
  },
  {
    id: 'aggregation:zone_statistic',
    name: 'Zone-Level Aggregation',
    category: 'AGGREGATION',
    description: 'mean/min/max/count of same-type Observations sharing a zone',
    requiredSensorKinds: [],
    inputSummary: 'One or more Observations sharing type and zoneId',
    outputSummary: 'A statistic distinct from any individual raw reading'
  }
];

export const ANALYSIS_REGISTRY: AnalysisDefinition[] = [...VEGETATION_INDEX_ANALYSES, ...OTHER_ANALYSES];

export interface AnalysisEvaluation {
  definition: AnalysisDefinition;
  availability: AnalysisAvailability;
  reason: string;
}

/**
 * The one function the UI calls to decide what to show — never a hardcoded
 * "supported" flag. An analysis with an empty `requiredSensorKinds` (change
 * detection, aggregation) is always structurally available; everything else
 * needs a deployed sensor of the right kind before it's worth attempting.
 */
export function evaluateAnalysis(definition: AnalysisDefinition, availableSensorKinds: readonly SensorKind[]): AnalysisEvaluation {
  if (definition.requiredSensorKinds.length === 0) {
    return { definition, availability: 'SUPPORTED', reason: 'No specific sensor kind required.' };
  }
  const hasRequiredSensor = definition.requiredSensorKinds.some((kind) => availableSensorKinds.includes(kind));
  if (hasRequiredSensor) {
    return { definition, availability: 'SUPPORTED', reason: `A required sensor kind (${definition.requiredSensorKinds.join(' or ')}) is deployed.` };
  }
  return {
    definition,
    availability: 'UNSUPPORTED',
    reason: `Requires one of [${definition.requiredSensorKinds.join(', ')}]; available sensor kinds: [${availableSensorKinds.join(', ') || 'none'}].`
  };
}

export function evaluateAllAnalyses(availableSensorKinds: readonly SensorKind[]): AnalysisEvaluation[] {
  return ANALYSIS_REGISTRY.map((def) => evaluateAnalysis(def, availableSensorKinds));
}
