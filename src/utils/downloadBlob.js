export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Pulls the filename out of a Content-Disposition header value
// (e.g. `attachment; filename="receipt_RCP-2026-000001.pdf"`), falling
// back to a caller-supplied default if the header is missing/unparsable.
export function filenameFromDisposition(headerValue, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(headerValue || '');
  return match ? match[1] : fallback;
}
