import { createId } from '../domain/id';
import type { Provenance } from '../observation/Observation';
import type { ImageAsset } from './ImageAsset';

/**
 * Metadata for one RGB image capture. Deliberately just three visible bands
 * — an RGB image can never feed a vegetation index like NDVI that needs
 * NIR; see SpectralIndex.ts and IndexEngine.ts, which check this
 * structurally rather than trusting a caller not to try.
 */
export interface RgbImageObservation {
  id: string;
  asset: ImageAsset;
  capturedAt: number;
  sensorId: string | null;
  fieldId: string | null;
  zoneId: string | null;
  missionId: string | null;
  droneId: string | null;
  /** Meters AGL at capture, if known. */
  altitude: number | null;
  /** Degrees, if known. */
  heading: number | null;
  /** Approximate ground sample distance in cm/pixel, if it can be derived from altitude+sensor specs; null if not computed. */
  groundSampleDistanceCm: number | null;
  provenance: Provenance;
}

export function createRgbImageObservation(params: {
  asset: ImageAsset;
  capturedAt: number;
  sensorId?: string | null;
  fieldId?: string | null;
  zoneId?: string | null;
  missionId?: string | null;
  droneId?: string | null;
  altitude?: number | null;
  heading?: number | null;
  groundSampleDistanceCm?: number | null;
  provenance: Provenance;
}): RgbImageObservation {
  return {
    id: createId('rgb_image'),
    asset: params.asset,
    capturedAt: params.capturedAt,
    sensorId: params.sensorId ?? null,
    fieldId: params.fieldId ?? null,
    zoneId: params.zoneId ?? null,
    missionId: params.missionId ?? null,
    droneId: params.droneId ?? null,
    altitude: params.altitude ?? null,
    heading: params.heading ?? null,
    groundSampleDistanceCm: params.groundSampleDistanceCm ?? null,
    provenance: params.provenance
  };
}
