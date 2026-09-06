import { describe, expect, it } from 'vitest';
import { validateUploadCandidate } from './AssetSecurity';

describe('validateUploadCandidate', () => {
  it('accepts a well-formed candidate', () => {
    const result = validateUploadCandidate({ filename: 'field-01.geojson', sizeBytes: 1024, declaredMimeType: 'application/geo+json' });
    expect(result.valid).toBe(true);
    expect(result.sanitizedFilename).toBe('field-01.geojson');
  });

  it('rejects path traversal in the filename', () => {
    const result = validateUploadCandidate({ filename: '../../etc/passwd', sizeBytes: 100, declaredMimeType: 'text/csv' });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('path-traversal'))).toBe(true);
  });

  it('rejects an oversized file', () => {
    const result = validateUploadCandidate({ filename: 'huge.tif', sizeBytes: 100 * 1024 * 1024, declaredMimeType: 'image/tiff' });
    expect(result.valid).toBe(false);
  });

  it('rejects a disallowed MIME type even with an innocuous-looking filename (never trusts extension alone)', () => {
    const result = validateUploadCandidate({ filename: 'script.jpg', sizeBytes: 100, declaredMimeType: 'application/x-sh' });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('MIME type'))).toBe(true);
  });

  it('sanitizes a filename with directory components', () => {
    const result = validateUploadCandidate({ filename: '/uploads/weird name!.png', sizeBytes: 100, declaredMimeType: 'image/png' });
    expect(result.sanitizedFilename).not.toContain('/');
    expect(result.sanitizedFilename).not.toContain('!');
  });

  it('rejects an empty file', () => {
    expect(validateUploadCandidate({ filename: 'a.png', sizeBytes: 0, declaredMimeType: 'image/png' }).valid).toBe(false);
  });
});
