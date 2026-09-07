/**
 * The one HTML-escaping function every panel must run untrusted text
 * through before interpolating it into `innerHTML` — dataset/source names,
 * free-text fields (CropObservation.observedCondition), imported
 * filenames, community contribution text. Panel content here is built as
 * template strings rather than DOM APIs (see ImportPanel.ts, the original
 * source of this pattern), so this is the XSS boundary: a malicious CSV/
 * GeoJSON/community-contribution value can never inject markup through it.
 * System-generated text (enum values, computed numbers, hardcoded template
 * strings) does not need to pass through this — only strings that ultimately
 * originate from a file upload, sensor/device name, or user/community input.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
