'use strict';

const QRCode = require('qrcode');

// Same hex values already used throughout the app (src/index.css design
// tokens) and in the pre-existing export code — no new colors invented.
const BRAND = {
  navy:      '#0D1B2A',
  navyLight: '#1B2838',
  card:      '#162232',
  green:     '#00B894',
  orange:    '#FFA500',
  red:       '#FF4C4C',
  blue:      '#3B82F6',
  textMuted: '#8892A0',
  textDim:   '#5A6577',
};

const COMPANY_NAME = 'Finance Hub';

// Reused by the PDF export, Excel export, and the receipt builder — a
// single implementation instead of three copies of the same QR call.
async function generateQrBuffer(text) {
  return QRCode.toBuffer(text, {
    margin: 1,
    width: 240,
    color: { dark: '#0D1B2A', light: '#FFFFFF' },
  });
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

module.exports = { BRAND, COMPANY_NAME, generateQrBuffer, getPortalBaseUrl, formatTime };
