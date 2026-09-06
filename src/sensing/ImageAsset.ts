import { createId } from '../domain/id';

/**
 * A reference to image bytes, never the bytes themselves — no domain object
 * in this codebase holds raw image binaries inline. `storage: 'local'` is
 * the only backend implemented today (Phase 4 has no real imagery source to
 * store); `storage: 'object-store'` is reserved for a future backend, so
 * adding one later is a new variant here, not a schema rewrite.
 */
export type ImageAssetStorage =
  | { kind: 'local'; reference: string } // e.g. an object URL or IndexedDB blob key — resolution is the caller's job
  | { kind: 'object-store'; bucket: string; key: string }; // not implemented yet — see README

export interface ImageAsset {
  id: string;
  storage: ImageAssetStorage;
  widthPx: number | null;
  heightPx: number | null;
  format: 'JPEG' | 'PNG' | 'TIFF' | 'RAW' | 'UNKNOWN';
  sizeBytes: number | null;
  capturedAt: number;
}

export function createImageAsset(params: {
  storage: ImageAssetStorage;
  widthPx?: number | null;
  heightPx?: number | null;
  format?: ImageAsset['format'];
  sizeBytes?: number | null;
  capturedAt: number;
}): ImageAsset {
  return {
    id: createId('image'),
    storage: params.storage,
    widthPx: params.widthPx ?? null,
    heightPx: params.heightPx ?? null,
    format: params.format ?? 'UNKNOWN',
    sizeBytes: params.sizeBytes ?? null,
    capturedAt: params.capturedAt
  };
}
