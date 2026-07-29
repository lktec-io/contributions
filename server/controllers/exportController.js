const ExcelJS   = require('exceljs');
const XLSX       = require('xlsx');   // still used by CSV
const PDFDocument = require('pdfkit');
const Contribution = require('../models/Contribution');
const Event = require('../models/Event');
const User = require('../models/User');
const { formatDate } = require('../utils/helpers');
const { BRAND, COMPANY_NAME, generateQrBuffer, getPortalBaseUrl, formatTime, argb, drawShadowCard, resolveBranding, fetchImageBuffer } = require('../utils/reportBranding');

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

const { getIsolationFilter } = require('../utils/tenantHelpers');

async function getContributionsForExport(req) {
  const { eventId } = req.query;
  const filter = getIsolationFilter(req);
  if (eventId) filter.eventId = eventId;
  return Contribution.findAll(filter);
}

// ── CSV ───────────────────────────────────────────────────────
async function exportCSV(req, res, next) {
  try {
    const contributions = await getContributionsForExport(req);
    const eventId = req.query.eventId;
    let eventName = 'all';
    if (eventId) {
      const event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    const rows = contributions.map(c => ({
      'Contributor Name': c.contributor_name,
      'Phone':            c.phone || '',
      'Email':            c.email || '',
      'Event':            c.event_name,
      'Pledge Amount':    parseFloat(c.amount),
      'Paid Amount':      parseFloat(c.paid_amount),
      'Outstanding':      parseFloat(c.amount) - parseFloat(c.paid_amount),
      'Status':           c.status,
      'Date':             formatDate(c.created_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contributions');

    const date     = formatDate(new Date());
    const filename = `contributions_${sanitizeFilename(eventName)}_${date}.csv`;
    const csv      = XLSX.utils.sheet_to_csv(ws);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

// ── XLSX (ExcelJS — full cell styling support) ────────────────
async function exportXLSX(req, res, next) {
  try {
    const contributions = await getContributionsForExport(req);
    const eventId = req.query.eventId;
    let eventName = 'all';
    let event = null;
    if (eventId) {
      event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    if (!contributions.length) {
      return res.status(400).json({ success: false, message: 'No contributions to export', errors: [] });
    }

    const generatedBy = await User.findById(req.user.userId);
    const now = new Date();

    // Branding — same one-account resolution as exportPDF, no org inheritance.
    const brandingUserId = event ? event.organization_id : req.user.userId;
    const branding        = await resolveBranding(brandingUserId);
    const brandLogoBuffer = await fetchImageBuffer(branding.logoUrl);

    const wb = new ExcelJS.Workbook();
    wb.creator  = branding.organizationName;
    wb.modified = now;

    const ws = wb.addWorksheet('Contributions', {
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
      views: [{ state: 'frozen', ySplit: 3 }],
    });
    ws.pageSetup.printTitlesRow = '3:3';

    // ── Title row ──────────────────────────────────────────
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value          = `${branding.organizationName} — Contributions Report: ${eventName === 'all' ? 'All Events' : eventName} (${contributions.length} records)`;
    titleCell.font           = { bold: true, size: 13, color: { argb: argb(BRAND.white) }, name: 'Calibri' };
    titleCell.fill           = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
    titleCell.alignment      = { horizontal: 'center', vertical: 'middle' };
    titleCell.border         = { bottom: { style: 'medium', color: { argb: argb(BRAND.green) } } };
    ws.getRow(1).height      = 30;

    // ── Subtitle row — generated date/time/by ──────────────
    ws.mergeCells('A2:I2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value     = `Generated: ${formatDate(now)} ${formatTime(now)}   |   By: ${generatedBy?.name || 'System'}`;
    subtitleCell.font      = { italic: true, size: 9, color: { argb: argb(BRAND.white) }, name: 'Calibri' };
    subtitleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height    = 18;

    // QR verification badge, anchored top-right (image position is
    // independent of cell merges, so this doesn't disturb the merged text)
    try {
      const qrBuffer = await generateQrBuffer(getPortalBaseUrl());
      const qrImageId = wb.addImage({ buffer: qrBuffer, extension: 'png' });
      ws.addImage(qrImageId, { tl: { col: 8.05, row: 0.05 }, ext: { width: 42, height: 42 } });
    } catch (qrErr) {
      console.error('[export] QR embed failed (non-fatal):', qrErr.message);
    }

    // Account logo, anchored top-left, only when branding was actually
    // uploaded — no vector fallback needed here, the title text alone is
    // the existing (unchanged) default appearance.
    if (brandLogoBuffer) {
      try {
        // Uploads are always stored as PNG (see uploadBrandingLogo) so this
        // is safe to hardcode — ExcelJS's addImage doesn't support WEBP.
        const logoImageId = wb.addImage({ buffer: brandLogoBuffer, extension: 'png' });
        ws.addImage(logoImageId, { tl: { col: 0.05, row: 0.05 }, ext: { width: 50, height: 50 } });
      } catch (logoErr) {
        console.error('[export] Logo embed failed (non-fatal):', logoErr.message);
      }
    }

    // ── Header row ──────────────────────────────────────────
    const HEADERS = [
      { header: 'Contributor Name', key: 'name',        width: 24 },
      { header: 'Phone',            key: 'phone',       width: 16 },
      { header: 'Email',            key: 'email',       width: 26 },
      { header: 'Event',            key: 'event',       width: 20 },
      { header: 'Pledge (TZS)',     key: 'pledge',      width: 16 },
      { header: 'Paid (TZS)',       key: 'paid',        width: 15 },
      { header: 'Outstanding',      key: 'outstanding', width: 15 },
      { header: 'Status',           key: 'status',      width: 11 },
      { header: 'Date',             key: 'date',        width: 13 },
    ];

    ws.columns = HEADERS.map(h => ({ key: h.key, width: h.width }));

    const headerRow = ws.getRow(3);
    HEADERS.forEach((h, i) => {
      const cell       = headerRow.getCell(i + 1);
      cell.value       = h.header;
      cell.font        = { bold: true, size: 11, color: { argb: argb(BRAND.white) }, name: 'Calibri' };
      cell.fill        = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
      cell.alignment   = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border      = {
        top:    { style: 'thin',   color: { argb: argb(BRAND.green) } },
        bottom: { style: 'medium', color: { argb: argb(BRAND.green) } },
      };
    });
    headerRow.height = 22;
    ws.autoFilter = 'A3:I3';

    // ── Data rows ───────────────────────────────────────────
    // No red/orange/blue in the approved palette — status is conveyed by
    // weight/color-within-palette rather than a traffic-light hue.
    const statusColors = { paid: argb(BRAND.success), partial: argb(BRAND.navy), pledge: argb(BRAND.muted) };

    contributions.forEach((c, ri) => {
      const pledge      = parseFloat(c.amount)      || 0;
      const paid        = parseFloat(c.paid_amount) || 0;
      const outstanding = pledge - paid;

      const row = ws.addRow({
        name:        c.contributor_name,
        phone:       c.phone  || '—',
        email:       c.email  || '—',
        event:       c.event_name || '—',
        pledge,
        paid,
        outstanding,
        status:      c.status,
        date:        formatDate(c.created_at),
      });

      const isEven  = ri % 2 === 0;
      const rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? argb(BRAND.white) : argb(BRAND.bg) } };
      const baseFont = { size: 10, color: { argb: argb(BRAND.navy) }, name: 'Calibri' };

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = rowFill;
        cell.font      = { ...baseFont };
        cell.border    = {
          bottom: { style: 'hair', color: { argb: argb(BRAND.border) } },
          right:  { style: 'hair', color: { argb: argb(BRAND.border) } },
        };

        // Money columns: 5=pledge, 6=paid, 7=outstanding
        if (colNum === 5) {
          cell.font      = { ...baseFont, color: { argb: argb(BRAND.navy) }, bold: true };
          cell.numFmt    = '"TZS "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 6) {
          cell.font      = { ...baseFont, color: { argb: argb(BRAND.green) }, bold: true };
          cell.numFmt    = '"TZS "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 7) {
          cell.font      = { ...baseFont, color: { argb: argb(BRAND.navy) }, bold: true };
          cell.numFmt    = '"TZS "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 8) {
          // Status cell — colored text
          const sColor   = statusColors[c.status] || argb(BRAND.navy);
          cell.font      = { ...baseFont, color: { argb: sColor }, bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });

      row.height = 18;
    });

    // ── Summary row ─────────────────────────────────────────
    const totalPledge      = contributions.reduce((s, c) => s + (parseFloat(c.amount)      || 0), 0);
    const totalPaid        = contributions.reduce((s, c) => s + (parseFloat(c.paid_amount) || 0), 0);
    const totalOutstanding = totalPledge - totalPaid;

    const sumRow = ws.addRow({
      name:        'TOTAL',
      phone:       '',
      email:       '',
      event:       '',
      pledge:      totalPledge,
      paid:        totalPaid,
      outstanding: totalOutstanding,
      status:      '',
      date:        '',
    });

    sumRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
      cell.border = { top: { style: 'medium', color: { argb: argb(BRAND.green) } } };
      if (colNum === 1) {
        cell.font      = { bold: true, size: 11, color: { argb: argb(BRAND.white) }, name: 'Calibri' };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if ([5, 6, 7].includes(colNum)) {
        const colors   = { 5: argb(BRAND.white), 6: argb(BRAND.accentGreen), 7: argb(BRAND.white) };
        cell.font      = { bold: true, size: 11, color: { argb: colors[colNum] }, name: 'Calibri' };
        cell.numFmt    = '"TZS "#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
    sumRow.height = 22;

    // ── Completion rate line ────────────────────────────────
    const completion = totalPledge > 0 ? (totalPaid / totalPledge) * 100 : 0;
    const compRow = ws.addRow([]);
    ws.mergeCells(`A${compRow.number}:G${compRow.number}`);
    const compLabelCell = ws.getCell(`A${compRow.number}`);
    compLabelCell.value      = 'Completion Rate';
    compLabelCell.font       = { bold: true, size: 11, color: { argb: argb(BRAND.white) }, name: 'Calibri' };
    compLabelCell.alignment  = { horizontal: 'right', vertical: 'middle' };
    compLabelCell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };

    ws.mergeCells(`H${compRow.number}:I${compRow.number}`);
    const compValueCell = ws.getCell(`H${compRow.number}`);
    compValueCell.value      = completion / 100;
    compValueCell.numFmt     = '0.0%';
    compValueCell.font       = { bold: true, size: 11, color: { argb: argb(BRAND.accentGreen) }, name: 'Calibri' };
    compValueCell.alignment  = { horizontal: 'center', vertical: 'middle' };
    compValueCell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
    compRow.height = 22;

    // ── Stream response ─────────────────────────────────────
    const date     = formatDate(new Date());
    const filename = `contributions_${sanitizeFilename(eventName)}_${date}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    next(err);
  }
}

// ── PDF ───────────────────────────────────────────────────────
async function exportPDF(req, res, next) {
  try {
    const contributions = await getContributionsForExport(req);
    const eventId = req.query.eventId;
    let eventName = 'All Events';
    let event = null;
    if (eventId) {
      event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    if (!contributions.length) {
      return res.status(400).json({ success: false, message: 'No contributions to export', errors: [] });
    }

    const generatedBy = await User.findById(req.user.userId);

    // Organization Name (account name) — only shown when it resolves to a
    // single, real organization (a specific event's owner, or the
    // client_user's own account); omitted rather than guessed when the
    // report spans many. Distinct from the "branding" org name below,
    // which is the custom label an account sets for itself.
    let organizationName = null;
    if (event) {
      const org = await User.findById(event.organization_id);
      organizationName = org?.name || null;
    } else if (req.user.role === 'client_user') {
      organizationName = generatedBy?.name || null;
    }

    // Branding — one flat per-account value, no org inheritance. Same
    // account resolution as organizationName above: the event's owner if
    // a specific event is in scope, otherwise the requester themselves.
    const brandingUserId = event ? event.organization_id : req.user.userId;
    const branding        = await resolveBranding(brandingUserId);
    const brandLogoBuffer = await fetchImageBuffer(branding.logoUrl);

    const now      = new Date();
    const date     = formatDate(now);
    const time     = formatTime(now);
    const filename = `report_${sanitizeFilename(eventName)}_${date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape', bufferPages: true });
    doc.pipe(res);

    const qrBuffer = await generateQrBuffer(getPortalBaseUrl());

    const pageW    = doc.page.width;
    const pageH    = doc.page.height;
    const marginX  = 40;
    const contentW = pageW - marginX * 2;

    const paintPageBackground = () => {
      doc.rect(0, 0, pageW, pageH).fill(BRAND.bg);
    };
    paintPageBackground();

    // ── Cover header banner ─────────────────────────────────
    const headerH = 120;
    doc.rect(0, 0, pageW, headerH).fill(BRAND.navy);
    doc.rect(0, headerH - 3, pageW, 3).fill(BRAND.green);

    // Account logo if branding was uploaded, else the default vector badge
    const badgeSize = 46;
    const badgeX    = marginX;
    const badgeY    = 24;
    if (brandLogoBuffer) {
      doc.save();
      doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 11).clip();
      doc.image(brandLogoBuffer, badgeX, badgeY, { fit: [badgeSize, badgeSize], align: 'center', valign: 'center' });
      doc.restore();
    } else {
      doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 11).fill(BRAND.green);
      doc.fillColor(BRAND.white).fontSize(16).font('Helvetica-Bold')
        .text('FH', badgeX, badgeY + badgeSize / 2 - 8, { width: badgeSize, align: 'center' });
    }

    const titleX = badgeX + badgeSize + 14;
    doc.fillColor(BRAND.white).fontSize(19).font('Helvetica-Bold')
      .text(branding.organizationName, titleX, 22);
    doc.fillColor(BRAND.accentGreen).fontSize(12).font('Helvetica-Bold')
      .text('Contribution Report', titleX, 44);

    let metaY = 64;
    doc.fillColor('rgba(255,255,255,0.7)').fontSize(9).font('Helvetica');
    if (organizationName) {
      doc.text(`Organization: ${organizationName}`, titleX, metaY, { width: 380 });
      metaY += 13;
    }
    doc.text(`Event: ${eventName}`, titleX, metaY, { width: 380 });
    metaY += 13;
    doc.text(`Generated: ${date} ${time}   |   By: ${generatedBy?.name || 'System'}`, titleX, metaY, { width: 420 });

    // QR verification, top-right — soft translucent backing plate
    const qrSize = 62;
    const qrPadX = qrSize + 20;
    doc.roundedRect(pageW - marginX - qrPadX, headerH / 2 - qrSize / 2 - 6, qrPadX, qrSize + 12, 8)
      .fill('rgba(255,255,255,0.08)');
    doc.image(qrBuffer, pageW - marginX - qrPadX + 10, headerH / 2 - qrSize / 2, { width: qrSize, height: qrSize });

    doc.y = headerH + 24;

    // ── Summary cards ───────────────────────────────────────
    let totalPledged = 0;
    let totalPaid    = 0;
    contributions.forEach(c => {
      totalPledged += parseFloat(c.amount);
      totalPaid    += parseFloat(c.paid_amount);
    });
    const outstanding = totalPledged - totalPaid;
    const completion  = totalPledged > 0 ? (totalPaid / totalPledged) * 100 : 0;

    const boxW = (contentW - 40) / 5;
    const boxH = 62;
    const summaryItems = [
      { label: 'Total Pledged',  value: `TZS ${totalPledged.toLocaleString('en', { minimumFractionDigits: 2 })}`,   accent: BRAND.navy },
      { label: 'Total Paid',     value: `TZS ${totalPaid.toLocaleString('en', { minimumFractionDigits: 2 })}`,      accent: BRAND.green },
      { label: 'Outstanding',    value: `TZS ${outstanding.toLocaleString('en', { minimumFractionDigits: 2 })}`,    accent: BRAND.muted },
      { label: 'Contributors',   value: String(contributions.length),                                               accent: BRAND.navy },
      { label: 'Completion',     value: `${completion.toFixed(1)}%`,                                                 accent: BRAND.success },
    ];

    summaryItems.forEach((item, i) => {
      const bx = marginX + i * (boxW + 10);
      const by = doc.y;
      drawShadowCard(doc, bx, by, boxW, boxH, 8, BRAND.white);
      doc.roundedRect(bx, by, 4, boxH, 2).fill(item.accent);
      doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica')
        .text(item.label.toUpperCase(), bx + 14, by + 14, { width: boxW - 22 });
      doc.fillColor(BRAND.navy).fontSize(13.5).font('Helvetica-Bold')
        .text(item.value, bx + 14, by + 32, { width: boxW - 22 });
    });

    doc.y += boxH + 22;

    // ── Table setup ────────────────────────────────────────
    const cols = [
      { label: 'Name',    x: marginX,       w: 150 },
      { label: 'Phone',   x: marginX + 150, w: 105 },
      { label: 'Event',   x: marginX + 255, w: 150 },
      { label: 'Pledged', x: marginX + 405, w: 90  },
      { label: 'Paid',    x: marginX + 495, w: 85  },
      { label: 'Balance', x: marginX + 580, w: 85  },
      { label: 'Status',  x: marginX + 665, w: 60  },
    ];
    const rowH        = 24;
    const bottomLimit  = pageH - 70;

    const drawTableHeader = () => {
      const hy = doc.y;
      doc.rect(marginX, hy, contentW, rowH).fill(BRAND.navy);
      cols.forEach(col => {
        const align = ['Pledged', 'Paid', 'Balance'].includes(col.label) ? 'right' : col.label === 'Status' ? 'center' : 'left';
        doc.fillColor(BRAND.white).fontSize(8.5).font('Helvetica-Bold')
          .text(col.label.toUpperCase(), col.x + 8, hy + 8, { width: col.w - 14, align });
      });
      doc.y = hy + rowH;
    };

    drawTableHeader();

    // ── Rows ───────────────────────────────────────────────
    doc.fontSize(8.5).font('Helvetica');
    contributions.forEach((c, idx) => {
      if (doc.y > bottomLimit) {
        doc.addPage();
        paintPageBackground();
        doc.y = 40;
        drawTableHeader();
      }

      const ry      = doc.y;
      const bgColor = idx % 2 === 0 ? BRAND.white : BRAND.bg;
      doc.rect(marginX, ry, contentW, rowH).fill(bgColor);
      doc.moveTo(marginX, ry + rowH).lineTo(marginX + contentW, ry + rowH)
        .lineWidth(0.5).strokeColor(BRAND.border).stroke();

      const pledged = parseFloat(c.amount);
      const paid    = parseFloat(c.paid_amount);
      const balance = pledged - paid;

      const fmtAmt = (n) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const statusColor = c.status === 'paid' ? BRAND.success : c.status === 'partial' ? BRAND.navy : BRAND.muted;

      const cellData = [
        { text: (c.contributor_name || '').substring(0, 28), color: BRAND.navy,  align: 'left'   },
        { text: c.phone || '—',                              color: BRAND.muted, align: 'left'   },
        { text: (c.event_name || '—').substring(0, 24),      color: BRAND.muted, align: 'left'   },
        { text: fmtAmt(pledged),                              color: BRAND.navy,  align: 'right'  },
        { text: fmtAmt(paid),                                 color: BRAND.green, align: 'right'  },
        { text: fmtAmt(balance),                              color: BRAND.navy,  align: 'right'  },
        { text: c.status,                                     color: statusColor, align: 'center' },
      ];

      cellData.forEach((cell, ci) => {
        doc.fillColor(cell.color)
          .text(cell.text, cols[ci].x + 8, ry + 8, { width: cols[ci].w - 14, align: cell.align, lineBreak: false });
      });

      doc.y = ry + rowH;
    });

    // ── Footer + page numbers on every page ─────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const fy = pageH - 42;
      doc.moveTo(marginX, fy).lineTo(pageW - marginX, fy).lineWidth(0.75).strokeColor(BRAND.border).stroke();
      doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica')
        .text(`${COMPANY_NAME}  •  Confidential Report  •  Generated Automatically`, marginX, fy + 10, { width: contentW / 2 });
      doc.fillColor(BRAND.muted).fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${totalPages}`, marginX + contentW / 2, fy + 10, { width: contentW / 2, align: 'right' });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportCSV, exportXLSX, exportPDF };
