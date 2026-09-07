/**
 * A small, dependency-free CSV parser and column-mapping layer (Phase 7,
 * Part 3). No CSV library is added — RFC 4180 quoting is the only real
 * complexity, and handling it by hand keeps this from pulling in a
 * dependency for what is genuinely a few lines. Treats every input file as
 * untrusted (Part 14): hard row/field-length caps, and a parse failure
 * reports a clear error instead of guessing at malformed input.
 */

export const MAX_CSV_ROWS = 50_000;
export const MAX_FIELD_LENGTH = 10_000;

export interface CsvParseResult {
  header: string[];
  rows: string[][];
  errors: string[];
}

/** Parses one RFC-4180-ish CSV record starting at `start`, respecting quoted fields ("" as an escaped quote). Returns the fields and the index just past the record's terminating newline (or the end of input). */
function parseLine(text: string, start: number): { fields: string[]; next: number } {
  const fields: string[] = [];
  let field = '';
  let i = start;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      fields.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      fields.push(field);
      return { fields, next: i + 1 };
    }
    field += c;
    i += 1;
  }
  fields.push(field);
  return { fields, next: i };
}

/**
 * Parses raw CSV text into a header row and data rows. Never throws on
 * malformed content — a structural problem (empty file, oversized row
 * count/fields, ragged rows) is reported in `errors` and the caller decides
 * whether to proceed. This is the "fail clearly rather than silently
 * accepting bad agricultural data" contract from Part 2.
 */
export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  if (text.trim().length === 0) {
    return { header: [], rows: [], errors: ['CSV file is empty.'] };
  }

  const { fields: header, next: afterHeader } = parseLine(text, 0);
  if (header.length === 0 || (header.length === 1 && header[0] === '')) {
    return { header: [], rows: [], errors: ['CSV file has no header row.'] };
  }

  const rows: string[][] = [];
  let pos = afterHeader;
  while (pos < text.length) {
    const { fields, next } = parseLine(text, pos);
    pos = next;
    if (fields.length === 1 && fields[0] === '') continue; // trailing blank line
    if (rows.length >= MAX_CSV_ROWS) {
      errors.push(`CSV exceeds the ${MAX_CSV_ROWS}-row limit — remaining rows were not parsed.`);
      break;
    }
    const oversizedField = fields.find((f) => f.length > MAX_FIELD_LENGTH);
    if (oversizedField !== undefined) {
      errors.push(`Row ${rows.length + 2} has a field longer than ${MAX_FIELD_LENGTH} characters — skipped.`);
      continue;
    }
    if (fields.length !== header.length) {
      errors.push(`Row ${rows.length + 2} has ${fields.length} field(s), expected ${header.length} — skipped.`);
      continue;
    }
    rows.push(fields);
  }

  return { header, rows, errors };
}

/**
 * The canonical observation-import columns a researcher can map their CSV's
 * actual column names onto (Part 3). Only `observation_type` and `value`
 * are required — coordinates OR field_id/zone_id can establish location,
 * and timestamp defaults to import time only if explicitly allowed by the
 * caller (ImportPipeline.ts never assumes "now" silently).
 */
export interface ColumnMapping {
  timestamp: string | null;
  latitude: string | null;
  longitude: string | null;
  fieldId: string | null;
  zoneId: string | null;
  sensorId: string | null;
  observationType: string;
  value: string;
  unit: string | null;
}

export interface CsvObservationDraft {
  rowNumber: number;
  timestampRaw: string | null;
  latRaw: string | null;
  lonRaw: string | null;
  fieldId: string | null;
  zoneId: string | null;
  sensorId: string | null;
  observationType: string;
  valueRaw: string;
  unit: string | null;
}

/** Maps parsed CSV rows through a ColumnMapping into drafts ready for ImportValidation.ts — no parsing/validation of the values themselves happens here, only column lookup. */
export function mapCsvRowsToDrafts(header: string[], rows: string[][], mapping: ColumnMapping): CsvObservationDraft[] {
  const indexOf = (col: string | null): number => (col === null ? -1 : header.indexOf(col));
  const idx = {
    timestamp: indexOf(mapping.timestamp),
    lat: indexOf(mapping.latitude),
    lon: indexOf(mapping.longitude),
    fieldId: indexOf(mapping.fieldId),
    zoneId: indexOf(mapping.zoneId),
    sensorId: indexOf(mapping.sensorId),
    observationType: indexOf(mapping.observationType),
    value: indexOf(mapping.value),
    unit: indexOf(mapping.unit)
  };

  const get = (row: string[], i: number): string | null => (i >= 0 && i < row.length && row[i] !== '' ? row[i] : null);

  return rows.map((row, i) => ({
    rowNumber: i + 2, // +1 for header, +1 for 1-indexing
    timestampRaw: get(row, idx.timestamp),
    latRaw: get(row, idx.lat),
    lonRaw: get(row, idx.lon),
    fieldId: get(row, idx.fieldId),
    zoneId: get(row, idx.zoneId),
    sensorId: get(row, idx.sensorId),
    observationType: get(row, idx.observationType) ?? '',
    valueRaw: get(row, idx.value) ?? '',
    unit: get(row, idx.unit)
  }));
}
