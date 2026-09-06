import type { SensorKind } from '../domain/SensorRecord';
import type { SpectralIndexId } from './SpectralIndex';

/**
 * What each sensor KIND is capable of in principle — distinct from a
 * specific SensorRecord's declared `capabilities` (Observation types one
 * particular instance actually produces). This catalog answers "what could
 * a multispectral camera ever support," AnalysisRegistry.ts uses it to
 * decide whether an analysis is even worth attempting for a given kind,
 * and it is also where the taxonomy from the Phase 4 brief (Part 2) lives
 * as data instead of scattered comments.
 */
export interface SensorKindProfile {
  observableQuantities: string[];
  rawDataType: 'position' | 'orientation' | 'pressure' | 'charge_state' | 'image_rgb' | 'image_multispectral' | 'image_thermal' | 'point_cloud' | 'scalar';
  supportedIndices: SpectralIndexId[];
  temporalCharacteristic: 'continuous' | 'per_capture';
  calibrationRequired: boolean;
}

export const SENSOR_CAPABILITY_CATALOG: Record<SensorKind, SensorKindProfile> = {
  gps: { observableQuantities: ['position'], rawDataType: 'position', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  imu: { observableQuantities: ['orientation', 'angular_rate'], rawDataType: 'orientation', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  barometer: { observableQuantities: ['altitude_estimate'], rawDataType: 'pressure', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: true },
  battery: { observableQuantities: ['state_of_charge'], rawDataType: 'charge_state', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },

  'rgb-camera': { observableQuantities: ['visible_imagery'], rawDataType: 'image_rgb', supportedIndices: [], temporalCharacteristic: 'per_capture', calibrationRequired: false },
  'multispectral-camera': {
    observableQuantities: ['spectral_reflectance_or_radiance'],
    rawDataType: 'image_multispectral',
    supportedIndices: ['NDVI', 'GNDVI', 'NDRE', 'SAVI', 'EVI'], // the actual index list still depends on which bands THIS sensor has — see IndexEngine
    temporalCharacteristic: 'per_capture',
    calibrationRequired: true
  },
  'thermal-camera': { observableQuantities: ['surface_temperature'], rawDataType: 'image_thermal', supportedIndices: [], temporalCharacteristic: 'per_capture', calibrationRequired: true },
  lidar: { observableQuantities: ['range', 'point_cloud'], rawDataType: 'point_cloud', supportedIndices: [], temporalCharacteristic: 'per_capture', calibrationRequired: true },

  'soil-moisture': { observableQuantities: ['volumetric_water_content'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: true },
  'soil-temperature': { observableQuantities: ['temperature'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  'soil-ec': { observableQuantities: ['electrical_conductivity'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: true },
  'soil-ph': { observableQuantities: ['ph'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: true },
  'soil-npk': { observableQuantities: ['nitrogen', 'phosphorus', 'potassium'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: true },

  'weather-station': { observableQuantities: ['air_temperature', 'humidity', 'pressure'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  'rain-gauge': { observableQuantities: ['precipitation'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  anemometer: { observableQuantities: ['wind_speed', 'wind_direction'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  'air-temperature': { observableQuantities: ['air_temperature'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false },
  humidity: { observableQuantities: ['relative_humidity'], rawDataType: 'scalar', supportedIndices: [], temporalCharacteristic: 'continuous', calibrationRequired: false }
};
