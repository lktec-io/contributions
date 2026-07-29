'use strict';

const PDFDocument = require('pdfkit');
const { BRAND, COMPANY_NAME, generateQrBuffer, getPortalBaseUrl, drawShadowCard } = require('./reportBranding');
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

const STATUS_LABELS = { paid: 'Paid in Full', partial: 'Partially Paid', pledge: 'Pledged' };

// Single shared builder used by both the admin-side and public-side receipt
// download endpoints — one layout implementation, no duplication.
// `logoBuffer`/`organizationName` are optional — callers resolve branding
// via reportBranding.resolveBranding()/fetchImageBuffer() and pass the
// result in; omitting them keeps the original default Finance Hub look.
async function buildReceiptPdf({ contribution, paymentRequest, approverName, logoBuffer = null, organizationName = COMPANY_NAME, res }) {
  const rcptNo   = receiptNumber(paymentRequest);
  const filename = `receipt_${rcptNo}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 0, size: 'A4' });
  doc.pipe(res);

  const pageW    = doc.page.width;
  const pageH    = doc.page.height;
  const marginX  = 48;
  const contentW = pageW - marginX * 2;

  // Page background
  doc.rect(0, 0, pageW, pageH).fill(BRAND.bg);

  // ── Header banner ────────────────────────────────────────
  const headerH = 120;
  doc.rect(0, 0, pageW, headerH).fill(BRAND.navy);
  doc.rect(0, headerH - 3, pageW, 3).fill(BRAND.green);

  const badgeSize = 40;
  if (logoBuffer) {
    doc.save();
    doc.roundedRect(marginX, 26, badgeSize, badgeSize, 11).clip();
    doc.image(logoBuffer, marginX, 26, { fit: [badgeSize, badgeSize], align: 'center', valign: 'center' });
    doc.restore();
  } else {
    doc.roundedRect(marginX, 26, badgeSize, badgeSize, 11).fill(BRAND.green);
    doc.fillColor(BRAND.white).fontSize(15).font('Helvetica-Bold')
      .text('FH', marginX, 26 + badgeSize / 2 - 8, { width: badgeSize, align: 'center' });
  }

  const titleX = marginX + badgeSize + 14;
  doc.fillColor(BRAND.white).fontSize(19).font('Helvetica-Bold')
    .text(organizationName, titleX, 30);
  doc.fillColor(BRAND.accentGreen).fontSize(11).font('Helvetica')
    .text('Official Payment Receipt', titleX, 53);

  doc.fillColor('rgba(255,255,255,0.7)').fontSize(9.5).font('Helvetica-Bold')
    .text(`Receipt No: ${rcptNo}`, titleX, 74);

  // Status pill, top-right, with a soft shadow so it reads as a real badge
  const statusLabel = 'APPROVED';
  const pillW = 104, pillH = 30;
  const pillX = pageW - marginX - pillW, pillY = 30;
  doc.save();
  doc.fillOpacity(0.35);
  doc.roundedRect(pillX + 1.5, pillY + 2.5, pillW, pillH, 15).fill('#052e14');
  doc.restore();
  doc.roundedRect(pillX, pillY, pillW, pillH, 15).fill(BRAND.success);
  doc.fillColor(BRAND.white).fontSize(11).font('Helvetica-Bold')
    .text(statusLabel, pillX, pillY + 9, { width: pillW, align: 'center' });

  let y = headerH + 22;

  // ── Payment information card ─────────────────────────────
  const target    = parseFloat(contribution.amount) || 0;
  const paid      = parseFloat(contribution.paid_amount) || 0;
  const remaining = Math.max(target - paid, 0);

  const infoRows = [
    ['Contributor',       contribution.contributor_name],
    ['Event',             contribution.event_name],
    ['Target Amount',     formatMoney(target)],
    ['Amount Paid',       formatMoney(paid)],
    ['Remaining Balance', formatMoney(remaining)],
    ['Payment Date',      formatDate(paymentRequest.submitted_at || new Date())],
    ['Approval Date',     formatDate(paymentRequest.reviewed_at || new Date())],
    ['Approved By',       approverName || 'System'],
    ['Payment Status',    STATUS_LABELS[contribution.status] || contribution.status],
  ];

  const cardPad  = 18;
  const headingH = 24;
  const rowH     = 26;
  const infoCardH = cardPad * 2 + headingH + infoRows.length * rowH;

  drawShadowCard(doc, marginX, y, contentW, infoCardH, 12, BRAND.white);
  doc.fillColor(BRAND.navy).fontSize(11).font('Helvetica-Bold')
    .text('Payment Information', marginX + cardPad, y + cardPad - 2, { width: contentW - cardPad * 2 });

  let ry = y + cardPad + headingH;
  infoRows.forEach(([label, value], i) => {
    if (i > 0) {
      doc.moveTo(marginX + cardPad, ry).lineTo(marginX + contentW - cardPad, ry)
        .lineWidth(0.5).strokeColor(BRAND.border).stroke();
    }
    doc.fillColor(BRAND.muted).fontSize(9.5).font('Helvetica')
      .text(label, marginX + cardPad, ry + 8, { width: contentW / 2 - cardPad });
    doc.fillColor(BRAND.navy).fontSize(10.5).font('Helvetica-Bold')
      .text(String(value ?? '—'), marginX + contentW / 2, ry + 8, { width: contentW / 2 - cardPad, align: 'right' });
    ry += rowH;
  });

  y += infoCardH + 22;

  // ── Verification card — QR gets its own dedicated card, not a
  //    bare afterthought at the bottom ─────────────────────────
  const qrSize = 104;
  const verifyCardH = cardPad + headingH + 16 + qrSize + 16 + 16 + 14 + cardPad;

  drawShadowCard(doc, marginX, y, contentW, verifyCardH, 12, BRAND.white);
  doc.fillColor(BRAND.navy).fontSize(11).font('Helvetica-Bold')
    .text('Payment Verification', marginX + cardPad, y + cardPad - 2, { width: contentW - cardPad * 2, align: 'center' });

  const qrBuffer = await generateQrBuffer(`${getPortalBaseUrl()}/pay/${contribution.public_token}`);
  const qrX = pageW / 2 - qrSize / 2;
  const qrY = y + cardPad + headingH + 16;
  doc.roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 10).fill(BRAND.bg);
  doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

  doc.fillColor(BRAND.navy).fontSize(11).font('Helvetica-Bold')
    .text('Scan to Verify', marginX, qrY + qrSize + 16, { width: contentW, align: 'center' });
  doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica')
    .text(`Verified by ${organizationName}`, marginX, qrY + qrSize + 32, { width: contentW, align: 'center' });

  y += verifyCardH + 26;

  // ── Thank you section ────────────────────────────────────
  doc.fillColor(BRAND.green).fontSize(13).font('Helvetica-Bold')
    .text('Thank you for supporting this event.', marginX, y, { width: contentW, align: 'center' });
  y += 18;
  doc.fillColor(BRAND.muted).fontSize(9.5).font('Helvetica')
    .text('Your contribution helps us achieve our shared goal.', marginX, y, { width: contentW, align: 'center' });
  y += 14;
  doc.fillColor(BRAND.muted).fontSize(9.5).font('Helvetica')
    .text('We sincerely appreciate your generosity.', marginX, y, { width: contentW, align: 'center' });

  // ── Footer ────────────────────────────────────────────────
  const footerY = pageH - 46;
  doc.moveTo(marginX, footerY).lineTo(pageW - marginX, footerY).lineWidth(0.75).strokeColor(BRAND.border).stroke();
  doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica')
    .text(`${organizationName}  •  Confidential Report  •  Generated Automatically`, marginX, footerY + 12, { width: contentW, align: 'center' });

  doc.end();
}

module.exports = { buildReceiptPdf, receiptNumber };
