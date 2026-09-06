import { createMultispectralReading, type MultispectralReading } from '../MultispectralReading';
import { createThermalReading, type ThermalReading } from '../ThermalReading';

/**
 * A deterministic, seeded synthetic dataset generator — for exercising the
 * IndexEngine/TemporalChange/SpatialAggregation pipelines in tests only.
 * Every record it produces has `provenance: 'SIMULATED'`; nothing here is
 * ever wired into the live application's UI as if it were a real capture —
 * see the README's "Scientific honesty" section for why. Deterministic via
 * mulberry32 (a small, well-known seeded PRNG) so the same seed always
 * reproduces the same dataset, which matters for reproducible tests.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticFieldDataset {
  seed: number;
  multispectralReadings: MultispectralReading[];
  thermalReadings: ThermalReading[];
}

/**
 * Generates `count` synthetic multispectral readings (all 5 known bands,
 * calibrated reflectance) and matching canopy/air thermal reading pairs.
 * The reflectance curve is a simple, explicitly non-physical function of
 * the seed and index — it does not represent any real crop, soil, or
 * imaging condition, and must never be interpreted as one.
 */
export function generateSyntheticFieldDataset(seed: number, count: number): SyntheticFieldDataset {
  const rand = mulberry32(seed);
  const now = Date.now();

  const multispectralReadings: MultispectralReading[] = [];
  const thermalReadings: ThermalReading[] = [];

  for (let i = 0; i < count; i++) {
    const vegetationLevel = rand(); // 0 (bare soil-like) .. 1 (dense canopy-like) — arbitrary, not derived from any real spectral library
    multispectralReadings.push(
      createMultispectralReading({
        bands: {
          BLUE: 0.02 + 0.03 * (1 - vegetationLevel) + rand() * 0.01,
          GREEN: 0.03 + 0.05 * (1 - vegetationLevel) + rand() * 0.01,
          RED: 0.04 + 0.15 * (1 - vegetationLevel) + rand() * 0.01,
          RED_EDGE: 0.1 + 0.3 * vegetationLevel + rand() * 0.02,
          NIR: 0.1 + 0.5 * vegetationLevel + rand() * 0.02
        },
        unitKind: 'reflectance',
        capturedAt: now + i * 1000,
        provenance: 'SIMULATED'
      })
    );

    const airTemp = 20 + rand() * 5;
    thermalReadings.push(
      createThermalReading({ target: 'AIR', temperatureC: airTemp, capturedAt: now + i * 1000, provenance: 'SIMULATED' })
    );
    thermalReadings.push(
      createThermalReading({
        target: 'CANOPY',
        temperatureC: airTemp - vegetationLevel * 3 + rand(), // denser (synthetic) canopy modeled as slightly cooler — a documented toy assumption, not a validated relationship
        capturedAt: now + i * 1000,
        provenance: 'SIMULATED'
      })
    );
  }

  return { seed, multispectralReadings, thermalReadings };
}
