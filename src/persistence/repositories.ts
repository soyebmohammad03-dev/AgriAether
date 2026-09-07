import type { Farm } from '../domain/Farm';
import type { Field } from '../domain/Field';
import type { Zone } from '../domain/Zone';
import type { CropCycle } from '../domain/Crop';
import type { SensorRecord } from '../domain/SensorRecord';
import type { SensorDeployment } from '../domain/SensorDeployment';
import type { AgriculturalEvent } from '../domain/AgriculturalEvent';
import type { Observation } from '../observation/Observation';
import type { WeatherCacheEntry } from '../weather/WeatherCacheEntry';
import type { DatasetRecord } from '../data/Dataset';
import type { SoilSample } from '../soil/SoilSample';
import type { GroundSample } from '../sensors/GroundSample';
import type { CropObservation } from '../domain/CropObservation';
import type { DataSourceRecord } from '../data/DataSource';
import type { ImportReport } from '../data/ImportPipeline';
import type { Repository } from './Repository';
import { InMemoryRepository } from './InMemoryRepository';
import { IndexedDbRepository } from './IndexedDbRepository';

export interface AgriAetherRepositories {
  farms: Repository<Farm>;
  fields: Repository<Field>;
  zones: Repository<Zone>;
  cropCycles: Repository<CropCycle>;
  sensors: Repository<SensorRecord>;
  sensorDeployments: Repository<SensorDeployment>;
  observations: Repository<Observation<unknown>>;
  agriculturalEvents: Repository<AgriculturalEvent>;
  weatherCache: Repository<WeatherCacheEntry>;
  datasets: Repository<DatasetRecord>;
  soilSamples: Repository<SoilSample>;
  groundSamples: Repository<GroundSample>;
  cropObservations: Repository<CropObservation>;
  dataSources: Repository<DataSourceRecord>;
  importRecords: Repository<ImportReport>;
}

export function createInMemoryRepositories(): AgriAetherRepositories {
  return {
    farms: new InMemoryRepository<Farm>(),
    fields: new InMemoryRepository<Field>(),
    zones: new InMemoryRepository<Zone>(),
    cropCycles: new InMemoryRepository<CropCycle>(),
    sensors: new InMemoryRepository<SensorRecord>(),
    sensorDeployments: new InMemoryRepository<SensorDeployment>(),
    observations: new InMemoryRepository<Observation<unknown>>(),
    agriculturalEvents: new InMemoryRepository<AgriculturalEvent>(),
    weatherCache: new InMemoryRepository<WeatherCacheEntry>(),
    datasets: new InMemoryRepository<DatasetRecord>(),
    soilSamples: new InMemoryRepository<SoilSample>(),
    groundSamples: new InMemoryRepository<GroundSample>(),
    cropObservations: new InMemoryRepository<CropObservation>(),
    dataSources: new InMemoryRepository<DataSourceRecord>(),
    importRecords: new InMemoryRepository<ImportReport>()
  };
}

export function createIndexedDbRepositories(): AgriAetherRepositories {
  return {
    farms: new IndexedDbRepository<Farm>('farms'),
    fields: new IndexedDbRepository<Field>('fields'),
    zones: new IndexedDbRepository<Zone>('zones'),
    cropCycles: new IndexedDbRepository<CropCycle>('cropCycles'),
    sensors: new IndexedDbRepository<SensorRecord>('sensors'),
    sensorDeployments: new IndexedDbRepository<SensorDeployment>('sensorDeployments'),
    observations: new IndexedDbRepository<Observation<unknown>>('observations'),
    agriculturalEvents: new IndexedDbRepository<AgriculturalEvent>('agriculturalEvents'),
    weatherCache: new IndexedDbRepository<WeatherCacheEntry>('weatherCache'),
    datasets: new IndexedDbRepository<DatasetRecord>('datasets'),
    soilSamples: new IndexedDbRepository<SoilSample>('soilSamples'),
    groundSamples: new IndexedDbRepository<GroundSample>('groundSamples'),
    cropObservations: new IndexedDbRepository<CropObservation>('cropObservations'),
    dataSources: new IndexedDbRepository<DataSourceRecord>('dataSources'),
    importRecords: new IndexedDbRepository<ImportReport>('importRecords')
  };
}

/** IndexedDB where available (real browsers), in-memory fallback otherwise (e.g. a non-browser test runner). */
export function createRepositories(): AgriAetherRepositories {
  return typeof indexedDB !== 'undefined' ? createIndexedDbRepositories() : createInMemoryRepositories();
}
