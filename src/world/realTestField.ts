import type { Polygon } from 'geojson';
import { createFarm } from '../domain/Farm';
import { createField, type Field } from '../domain/Field';
import { ingestFieldBoundaryGeoJson } from '../data/GeoJsonIngestion';
import type { WorldRegistry } from './WorldRegistry';

/**
 * A REAL, non-Null-Island WGS84 location — genuine agricultural land in
 * Iowa, USA (Sentinel-2 MGRS tile 15TVG; confirmed via a live STAC query
 * during Phase "Push 1" development to have >90% "vegetated" land-cover
 * classification in its scene metadata, i.e. real cropland, not a city or
 * water body). This is NOT a specific named farmer's field and carries no
 * survey — GeodeticProvenance is honestly `USER_DRAWN` (a small ~300m
 * square hand-specified for this milestone), not `SURVEYED`. It exists so
 * this codebase has one real place to point a real satellite query at,
 * alongside (never replacing) the existing DEMO_ONLY Null Island fixture.
 */
export const REAL_TEST_FIELD_CENTER = { lat: 42.04, lon: -93.62 };
const HALF_WIDTH_DEG_LAT = 0.00135; // ~150m
const HALF_WIDTH_DEG_LON = 0.00181; // ~150m at this latitude (cos(42.04°) correction)

export function buildRealTestFieldBoundary(): Polygon {
  const { lat, lon } = REAL_TEST_FIELD_CENTER;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - HALF_WIDTH_DEG_LON, lat - HALF_WIDTH_DEG_LAT],
        [lon + HALF_WIDTH_DEG_LON, lat - HALF_WIDTH_DEG_LAT],
        [lon + HALF_WIDTH_DEG_LON, lat + HALF_WIDTH_DEG_LAT],
        [lon - HALF_WIDTH_DEG_LON, lat + HALF_WIDTH_DEG_LAT],
        [lon - HALF_WIDTH_DEG_LON, lat - HALF_WIDTH_DEG_LAT]
      ]
    ]
  };
}

const REAL_FARM_NAME = 'Research Farm (Real Location, Unverified Ownership)';
const REAL_FIELD_NAME = 'Iowa Test Field (Real WGS84, USER_DRAWN boundary)';

/**
 * Idempotent find-or-create for the real test field, mirroring
 * world/demoWorld.ts's ensureDemoWorld pattern exactly — a second,
 * independent Farm/Field, never touching or replacing the Null Island demo
 * world.
 */
export async function ensureRealTestField(registry: WorldRegistry): Promise<{ farmId: string; field: Field }> {
  const existingFarm = registry.listFarms().find((f) => f.name === REAL_FARM_NAME);
  if (existingFarm) {
    const existingField = registry.listFieldsForFarm(existingFarm.id).find((f) => f.name === REAL_FIELD_NAME);
    if (existingField) return { farmId: existingFarm.id, field: existingField };
  }

  const farm =
    existingFarm ??
    (await registry.registerFarm(
      createFarm({
        name: REAL_FARM_NAME,
        description: 'A real, non-demo geographic location (Iowa, USA) used to validate real Sentinel-2 ingestion — not a verified/owned farm, not for agricultural advice.',
        // No independent farm-level boundary exists (only the field boundary below) — honestly 'unknown', never inferred from the field's geometry.
        geoReference: { kind: 'unknown' }
      })
    ));

  const ingestion = ingestFieldBoundaryGeoJson(buildRealTestFieldBoundary());
  if (ingestion.status === 'INVALID' || !ingestion.geometry) {
    throw new Error(`Real test field boundary failed ingestion validation: ${ingestion.issues.join('; ')}`);
  }

  const field = await registry.registerField(
    createField({
      farmId: farm.id,
      name: REAL_FIELD_NAME,
      description: 'Real WGS84 coordinates over genuine Iowa cropland (Sentinel-2 tile 15TVG). Boundary is a hand-specified ~300m square (USER_DRAWN), not a legal/surveyed field boundary — used only to validate the real satellite pipeline.',
      geoReference: { kind: 'geodetic', crs: 'EPSG:4326', geometry: ingestion.geometry, provenance: 'USER_DRAWN' },
      areaHectares: ingestion.areaHectares,
      status: 'active'
    })
  );

  return { farmId: farm.id, field };
}
