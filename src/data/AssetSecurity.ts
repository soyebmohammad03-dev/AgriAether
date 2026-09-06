/**
 * Upload validation rules — written now even though no upload UI exists in
 * this codebase yet (see README), so the first real upload feature has a
 * tested contract to call instead of inventing checks under deadline
 * pressure. Never trust a filename's extension alone: `declaredMimeType`
 * is the primary check, and every filename is sanitized regardless.
 */
export interface UploadCandidate {
  filename: string;
  sizeBytes: number;
  declaredMimeType: string;
}

export interface UploadValidationResult {
  valid: boolean;
  issues: string[];
  /** The filename with path components stripped — safe to use for storage; null if validation failed. */
  sanitizedFilename: string | null;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/tiff', 'application/geo+json', 'application/json', 'text/csv'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB — generous for one orthomosaic tile or GeoJSON boundary, documented rather than arbitrary

/** Strips directory components and any parent-directory traversal — never trusts a client-supplied path. */
function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? '';
  return base.replace(/^\.+/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function validateUploadCandidate(candidate: UploadCandidate): UploadValidationResult {
  const issues: string[] = [];

  if (!candidate.filename || candidate.filename.includes('..') || candidate.filename.includes('\0')) {
    issues.push('Filename contains a path-traversal or null-byte pattern.');
  }
  if (candidate.sizeBytes <= 0) {
    issues.push('File is empty.');
  }
  if (candidate.sizeBytes > MAX_FILE_SIZE_BYTES) {
    issues.push(`File is ${candidate.sizeBytes} bytes, exceeding the ${MAX_FILE_SIZE_BYTES}-byte limit.`);
  }
  if (!ALLOWED_MIME_TYPES.includes(candidate.declaredMimeType)) {
    issues.push(`MIME type "${candidate.declaredMimeType}" is not in the allowed list [${ALLOWED_MIME_TYPES.join(', ')}].`);
  }

  return {
    valid: issues.length === 0,
    issues,
    sanitizedFilename: issues.length === 0 ? sanitizeFilename(candidate.filename) : null
  };
}
