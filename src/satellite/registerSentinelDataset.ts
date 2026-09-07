import { createDatasetRecord, type DatasetRecord } from '../data/Dataset';
import { createDataSourceRecord, type DataSourceRecord } from '../data/DataSource';
import type { DataQuality } from '../sensing/DataQuality';
import type { SentinelFieldAnalysisResult } from './SentinelFieldPipeline';

/**
 * The real, live-verified DataSource entry for Sentinel-2 L2A. Deliberately
 * NOT added to data/DataSource.ts's builtInDataSources() — that list is
 * loaded unconditionally at app startup for sources with no per-use cost
 * (simulation, manual upload, Open-Meteo). A live Sentinel-2 fetch is an
 * on-demand, non-trivial network operation the user explicitly triggers, so
 * this DataSourceRecord is registered only once that first fetch actually
 * succeeds — ingestionStatus: 'CONNECTED' is never claimed before a real
 * scene has actually been retrieved.
 */
export function createSentinelDataSourceRecord(): DataSourceRecord {
  return createDataSourceRecord({
    type: 'SATELLITE',
    provider: 'European Space Agency (Copernicus) via Microsoft Planetary Computer',
    name: 'Sentinel-2 L2A (Planetary Computer STAC)',
    version: 'STAC API v1',
    isExternal: true,
    nature: 'EXTERNAL',
    geographicCoverage: 'Global, cloud/scene-dependent — see per-dataset spatialExtent',
    supportedObservationTypes: ['remote_sensing.reflectance.red', 'remote_sensing.reflectance.nir', 'vegetation_index.ndvi'],
    license: 'Copernicus Sentinel Data Terms and Conditions (free, open, attribution required)',
    attribution: 'Contains modified Copernicus Sentinel data, processed by ESA / Microsoft Planetary Computer',
    reliability: 'HIGH',
    ingestionStatus: 'CONNECTED',
    notes: 'Real public STAC search (no API key) + documented SAS asset signing; each fetch is a real HTTP range-read of a Sentinel-2 L2A Cloud-Optimized GeoTIFF, never a fixture.'
  });
}

/** One DatasetRecord per real scene actually retrieved — this is the audit trail a researcher or the Data Catalog reads, not a static registration made once at startup. */
export function createSentinelDatasetRecord(params: { analysis: SentinelFieldAnalysisResult; fieldId: string }): DatasetRecord {
  const { scene } = params.analysis;
  const quality: DataQuality = params.analysis.quality;
  return createDatasetRecord({
    name: `Sentinel-2 L2A scene ${scene.itemId}`,
    provider: 'ESA Copernicus / Microsoft Planetary Computer',
    source: scene.selfUrl ?? `stac:${scene.collection}:${scene.itemId}`,
    type: 'IMAGERY',
    acquiredAtStart: Date.parse(scene.datetime),
    spatialExtent: params.analysis.grid.metadata.extent,
    crs: 'EPSG:4326',
    resolutionMeters: 10,
    bands: ['RED', 'NIR'],
    license: 'Copernicus Sentinel Data Terms and Conditions',
    attribution: 'Contains modified Copernicus Sentinel data',
    provenance: 'EXTERNAL',
    quality,
    fieldId: params.fieldId
  });
}
