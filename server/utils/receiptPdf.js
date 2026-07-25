'use strict';

const PDFDocument = require('pdfkit');
const { BRAND, COMPANY_NAME, generateQrBuffer, getPortalBaseUrl } = require('./reportBranding');
const { formatDate } = require('./helpers');

// Deterministic, derived from the payment_requests row — no new column/table
// needed. Unique because payment_requests.id is unique.
function receiptNumber(paymentRequest) {
  const year = new Date(paymentRequest.reviewed_at || paymentRequest.submitted_at).getFullYear();
  const seq  = String(paymentRequest.id).padStart(6, '0');
  return `RCP-${year}-${seq}`;
}

function formatMoney(n) {
  return `TZS ${(parseFloat(n) || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Single shared builder used by both the admin-side and public-side receipt
// download endpoints — one layout implementation, no duplication.
async function buildReceiptPdf({ contribution, paymentRequest, approverName, res }) {
  const rcptNo    = receiptNumber(paymentRequest);
  const filename  = `receipt_${rcptNo}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  doc.pipe(res);

  const pageW    = doc.page.width;
  const pageH    = doc.page.height;
  const marginX  = 48;
  const contentW = pageW - marginX * 2;

  // ── Header banner ────────────────────────────────────────
  doc.rect(0, 0, pageW, 120).fill(BRAND.navy);
  doc.rect(0, 118, pageW, 2).fill(BRAND.green);

  const badgeSize = 40;
  doc.roundedRect(marginX, 30, badgeSize, badgeSize, 10).fill(BRAND.green);
  doc.fillColor('#FFFFFF').fontSize(15).font('Helvetica-Bold')
    .text('FH', marginX, 30 + badgeSize / 2 - 8, { width: badgeSize, align: 'center' });

  doc.fillColor(BRAND.green).fontSize(20).font('Helvetica-Bold')
    .text(COMPANY_NAME, marginX + badgeSize + 14, 34);
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica')
    .text('Official Payment Receipt', marginX + badgeSize + 14, 58);

  doc.fillColor('rgba(255,255,255,0.7)').fontSize(10).font('Helvetica-Bold')
    .text(`Receipt No: ${rcptNo}`, pageW - marginX - 220, 44, { width: 220, align: 'right' });

  let y = 150;

  // ── Status pill ──────────────────────────────────────────
  const target    = parseFloat(contribution.amount) || 0;
  const paid      = parseFloat(contribution.paid_amount) || 0;
  const remaining = Math.max(target - paid, 0);
  const statusLabel = contribution.status === 'paid' ? 'PAID' : 'APPROVED';

  doc.roundedRect(marginX, y, 110, 28, 14).fill(BRAND.green);
  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
    .text(statusLabel, marginX, y + 8, { width: 110, align: 'center' });
  y += 50;

  // ── Details card ─────────────────────────────────────────
  const cardPad = 20;
  const rows = [
    ['Contributor',       contribution.contributor_name],
    ['Event',             contribution.event_name],
    ['Target Amount',     formatMoney(target)],
    ['Amount Paid',       formatMoney(paid)],
    ['Remaining Balance', formatMoney(remaining)],
    ['Payment Date',      formatDate(paymentRequest.reviewed_at || new Date())],
    ['Approved By',       approverName || 'System'],
  ];

  const cardH = rows.length * 28 + cardPad * 2;
  doc.roundedRect(marginX, y, contentW, cardH, 10).fill(BRAND.card);

  let ry = y + cardPad;
  rows.forEach(([label, value]) => {
    doc.fillColor(BRAND.textMuted).fontSize(10).font('Helvetica')
      .text(label, marginX + cardPad, ry, { width: contentW / 2 - cardPad });
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
      .text(String(value ?? '—'), marginX + contentW / 2, ry, { width: contentW / 2 - cardPad, align: 'right' });
    ry += 28;
  });
  y += cardH + 30;

  // ── QR verification ──────────────────────────────────────
  const qrBuffer = await generateQrBuffer(`${getPortalBaseUrl()}/pay/${contribution.public_token}`);
  const qrSize = 110;
  doc.image(qrBuffer, pageW / 2 - qrSize / 2, y, { width: qrSize, height: qrSize });
  y += qrSize + 14;
  doc.fillColor(BRAND.textMuted).fontSize(9).font('Helvetica')
    .text('Scan to view your live contribution page', marginX, y, { width: contentW, align: 'center' });
  y += 34;

  // ── Thank you section ────────────────────────────────────
  doc.fillColor(BRAND.green).fontSize(13).font('Helvetica-Bold')
    .text('Thank you for supporting this event.', marginX, y, { width: contentW, align: 'center' });
  y += 20;
  doc.fillColor(BRAND.textMuted).fontSize(10).font('Helvetica')
    .text('Your contribution is highly appreciated.', marginX, y, { width: contentW, align: 'center' });

  // ── Footer ────────────────────────────────────────────────
  const footerY = pageH - 60;
  doc.rect(marginX, footerY, contentW, 1).fill(BRAND.navyLight);
  doc.fillColor(BRAND.textDim).fontSize(8).font('Helvetica')
    .text(`${COMPANY_NAME}  •  Confidential  •  Generated ${formatDate(new Date())}`, marginX, footerY + 10, { width: contentW, align: 'center' });

  doc.end();
}

module.exports = { buildReceiptPdf, receiptNumber };
