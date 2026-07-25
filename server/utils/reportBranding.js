'use strict';

const QRCode = require('qrcode');

// Fixed brand palette for all generated documents (PDF reports, Excel
// reports, receipts, public receipts) — deliberately distinct from the
// web app's own dark UI theme; this is the "premium financial document"
// palette and nothing outside it should be used in document generation.
const BRAND = {
  navy:       '#0B1F3A', // Dark Navy — headers, primary text
  green:      '#0F9D58', // Primary Green — brand accent, primary totals
  accentGreen:'#34A853', // Accent Green — secondary highlights
  bg:         '#F7FAFC', // Background — light page/card fill
  border:     '#DCE6E8', // Borders — dividers, card outlines
  success:    '#16A34A', // Success — approved/paid status
  muted:      '#64748B', // Muted Text — secondary/labels
  white:      '#FFFFFF',
};

const COMPANY_NAME = 'Finance Hub';

// '#RRGGBB' -> 'FFRRGGBB' (ExcelJS ARGB) — single source of truth so the
// PDF and Excel renderers can never drift onto slightly different hues.
function argb(hex) {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

// Reused by the PDF export, Excel export, and the receipt builder — a
// single implementation instead of three copies of the same QR call.
async function generateQrBuffer(text) {
  return QRCode.toBuffer(text, {
    margin: 1,
    width: 240,
    color: { dark: BRAND.navy, light: BRAND.white },
  });
}

// Shared pdfkit helper — a rounded card with a simulated soft shadow and a
// thin border, used by both the PDF report (summary boxes) and the receipt
// (info/verification cards) so every document uses the exact same "card"
// visual language. Opacity change is scoped with save()/restore() so it
// never leaks into whatever gets drawn next.
function drawShadowCard(doc, x, y, w, h, radius, fillColor) {
  doc.save();
  doc.fillOpacity(0.5);
  doc.roundedRect(x + 1.5, y + 2.5, w, h, radius).fill('#94A3B8');
  doc.restore();
  doc.roundedRect(x, y, w, h, radius).fill(fillColor);
  doc.roundedRect(x, y, w, h, radius).lineWidth(0.75).strokeColor(BRAND.border).stroke();
}

function getPortalBaseUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

// 'HH:MM' in 24h, matches the plain style already used by formatDate().
function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const hours   = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

module.exports = { BRAND, COMPANY_NAME, generateQrBuffer, getPortalBaseUrl, formatTime, argb, drawShadowCard };
