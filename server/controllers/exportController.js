const ExcelJS   = require('exceljs');
const XLSX       = require('xlsx');   // still used by CSV
const PDFDocument = require('pdfkit');
const Contribution = require('../models/Contribution');
const Event = require('../models/Event');
const User = require('../models/User');
const { formatDate } = require('../utils/helpers');
const { BRAND, COMPANY_NAME, generateQrBuffer, getPortalBaseUrl, formatTime } = require('../utils/reportBranding');

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
    if (eventId) {
      const event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    if (!contributions.length) {
      return res.status(400).json({ success: false, message: 'No contributions to export', errors: [] });
    }

    const generatedBy = await User.findById(req.user.userId);
    const now = new Date();

    const wb = new ExcelJS.Workbook();
    wb.creator  = COMPANY_NAME;
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
    titleCell.value          = `${COMPANY_NAME} — Contributions Report: ${eventName === 'all' ? 'All Events' : eventName} (${contributions.length} records)`;
    titleCell.font           = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    titleCell.fill           = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } };
    titleCell.alignment      = { horizontal: 'center', vertical: 'middle' };
    titleCell.border         = { bottom: { style: 'medium', color: { argb: 'FF00B894' } } };
    ws.getRow(1).height      = 30;

    // ── Subtitle row — generated date/time/by ──────────────
    ws.mergeCells('A2:I2');
    const subtitleCell = ws.getCell('A2');
    subtitleCell.value     = `Generated: ${formatDate(now)} ${formatTime(now)}   |   By: ${generatedBy?.name || 'System'}`;
    subtitleCell.font      = { italic: true, size: 9, color: { argb: 'FFD4DCE8' }, name: 'Calibri' };
    subtitleCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } };
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
      cell.font        = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      cell.fill        = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };
      cell.alignment   = { horizontal: 'center', vertical: 'middle', wrapText: false };
      cell.border      = {
        top:    { style: 'thin',   color: { argb: 'FF00B894' } },
        bottom: { style: 'medium', color: { argb: 'FF00B894' } },
        left:   { style: 'thin',   color: { argb: 'FF1B2838' } },
        right:  { style: 'thin',   color: { argb: 'FF1B2838' } },
      };
    });
    headerRow.height = 22;
    ws.autoFilter = 'A3:I3';

    // ── Data rows ───────────────────────────────────────────
    const statusColors = { paid: 'FF00B894', partial: 'FFFFA500', pledge: 'FF3B82F6' };

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
      const rowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FF0F1E2E' : 'FF162232' } };
      const baseFont = { size: 10, color: { argb: 'FFD4DCE8' }, name: 'Calibri' };

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = rowFill;
        cell.font      = { ...baseFont };
        cell.border    = {
          bottom: { style: 'hair', color: { argb: 'FF1E3048' } },
          right:  { style: 'hair', color: { argb: 'FF1E3048' } },
        };

        // Money columns: 5=pledge, 6=paid, 7=outstanding
        if (colNum === 5) {
          cell.font      = { ...baseFont, color: { argb: 'FFFFA500' }, bold: true };
          cell.numFmt    = '"TZS "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 6) {
          cell.font      = { ...baseFont, color: { argb: 'FF00B894' }, bold: true };
          cell.numFmt    = '"TZS "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 7) {
          const color    = outstanding > 0 ? 'FFFF4C4C' : 'FF00B894';
          cell.font      = { ...baseFont, color: { argb: color }, bold: true };
          cell.numFmt    = '"TZS "#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 8) {
          // Status cell — colored text
          const sColor   = statusColors[c.status] || 'FFD4DCE8';
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
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };
      cell.border = { top: { style: 'medium', color: { argb: 'FF00B894' } } };
      if (colNum === 1) {
        cell.font      = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else if ([5, 6, 7].includes(colNum)) {
        const colors   = { 5: 'FFFFA500', 6: 'FF00B894', 7: totalOutstanding > 0 ? 'FFFF4C4C' : 'FF00B894' };
        cell.font      = { bold: true, size: 11, color: { argb: colors[colNum] }, name: 'Calibri' };
        cell.numFmt    = '#,##0.00';
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
    compLabelCell.font       = { bold: true, size: 11, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    compLabelCell.alignment  = { horizontal: 'right', vertical: 'middle' };
    compLabelCell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };

    ws.mergeCells(`H${compRow.number}:I${compRow.number}`);
    const compValueCell = ws.getCell(`H${compRow.number}`);
    compValueCell.value      = completion / 100;
    compValueCell.numFmt     = '0.0%';
    compValueCell.font       = { bold: true, size: 11, color: { argb: 'FF00B894' }, name: 'Calibri' };
    compValueCell.alignment  = { horizontal: 'center', vertical: 'middle' };
    compValueCell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } };
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
    if (eventId) {
      const event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    if (!contributions.length) {
      return res.status(400).json({ success: false, message: 'No contributions to export', errors: [] });
    }

    const generatedBy = await User.findById(req.user.userId);
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

    // ── Cover header banner ─────────────────────────────────
    const headerH = 108;
    doc.rect(0, 0, pageW, headerH).fill(BRAND.navy);
    doc.rect(0, headerH - 2, pageW, 2).fill(BRAND.green);

    // FH badge (vector — no logo image file exists in the repo)
    const badgeSize = 34;
    const badgeX    = marginX;
    const badgeY    = 22;
    doc.roundedRect(badgeX, badgeY, badgeSize, badgeSize, 8).fill(BRAND.green);
    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold')
      .text('FH', badgeX, badgeY + badgeSize / 2 - 7, { width: badgeSize, align: 'center' });

    const titleX = badgeX + badgeSize + 12;
    doc.fillColor(BRAND.green).fontSize(18).font('Helvetica-Bold')
      .text(COMPANY_NAME, titleX, 22);
    doc.fillColor('#FFFFFF').fontSize(13).font('Helvetica-Bold')
      .text('Contribution Report', titleX, 42);

    doc.fillColor('rgba(255,255,255,0.65)').fontSize(9).font('Helvetica')
      .text(`Event: ${eventName}`, titleX, 64)
      .text(`Generated: ${date} ${time}   |   By: ${generatedBy?.name || 'System'}   |   Total records: ${contributions.length}`, titleX, 78);

    // QR verification badge, top-right
    const qrSize = 60;
    doc.image(qrBuffer, pageW - marginX - qrSize, headerH / 2 - qrSize / 2, { width: qrSize, height: qrSize });

    doc.y = headerH + 20;

    // ── Summary boxes ──────────────────────────────────────
    let totalPledged = 0;
    let totalPaid    = 0;
    contributions.forEach(c => {
      totalPledged += parseFloat(c.amount);
      totalPaid    += parseFloat(c.paid_amount);
    });
    const outstanding = totalPledged - totalPaid;
    const completion  = totalPledged > 0 ? (totalPaid / totalPledged) * 100 : 0;

    const boxW = (contentW - 40) / 5;
    const summaryItems = [
      { label: 'Total Pledged',  value: `TZS ${totalPledged.toLocaleString('en', { minimumFractionDigits: 2 })}`,   color: BRAND.orange },
      { label: 'Total Paid',     value: `TZS ${totalPaid.toLocaleString('en', { minimumFractionDigits: 2 })}`,      color: BRAND.green },
      { label: 'Outstanding',    value: `TZS ${outstanding.toLocaleString('en', { minimumFractionDigits: 2 })}`,    color: BRAND.red },
      { label: 'Contributors',   value: String(contributions.length),                                               color: BRAND.blue },
      { label: 'Completion',     value: `${completion.toFixed(1)}%`,                                                 color: BRAND.green },
    ];

    summaryItems.forEach((item, i) => {
      const bx = marginX + i * (boxW + 10);
      const by = doc.y;
      doc.roundedRect(bx, by, boxW, 52, 6).fill(BRAND.card);
      doc.rect(bx, by, 3, 52).fill(item.color);
      doc.fillColor('rgba(255,255,255,0.55)').fontSize(8).font('Helvetica')
        .text(item.label.toUpperCase(), bx + 12, by + 10, { width: boxW - 16 });
      doc.fillColor(item.color).fontSize(13).font('Helvetica-Bold')
        .text(item.value, bx + 12, by + 25, { width: boxW - 16 });
    });

    doc.y += 62;

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
    const rowH        = 22;
    const bottomLimit  = pageH - 60;

    const drawTableHeader = () => {
      const hy = doc.y;
      doc.rect(marginX, hy, contentW, rowH).fill(BRAND.navyLight);
      doc.rect(marginX, hy + rowH - 1, contentW, 1).fill(BRAND.green);

      doc.fillColor(BRAND.textMuted).fontSize(8).font('Helvetica-Bold');
      cols.forEach(col => {
        doc.text(col.label.toUpperCase(), col.x + 4, hy + 7, { width: col.w - 6 });
      });
      doc.y = hy + rowH;
    };

    drawTableHeader();

    // ── Rows ───────────────────────────────────────────────
    doc.fontSize(8).font('Helvetica');
    contributions.forEach((c, idx) => {
      if (doc.y > bottomLimit) {
        doc.addPage();
        doc.y = 40;
        drawTableHeader();
      }

      const ry      = doc.y;
      const bgColor = idx % 2 === 0 ? '#0F1B28' : BRAND.card;
      doc.rect(marginX, ry, contentW, rowH).fill(bgColor);

      const pledged = parseFloat(c.amount);
      const paid    = parseFloat(c.paid_amount);
      const balance = pledged - paid;

      const fmtAmt = (n) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const cellData = [
        { text: (c.contributor_name || '').substring(0, 28), color: '#FFFFFF' },
        { text: c.phone || '—',                              color: BRAND.textMuted },
        { text: (c.event_name || '—').substring(0, 24),      color: BRAND.textMuted },
        { text: fmtAmt(pledged),                              color: BRAND.orange },
        { text: fmtAmt(paid),                                 color: BRAND.green },
        { text: fmtAmt(balance),                              color: balance > 0 ? BRAND.red : BRAND.green },
        { text: c.status,                                     color: c.status === 'paid' ? BRAND.green : c.status === 'partial' ? BRAND.blue : BRAND.orange },
      ];

      cellData.forEach((cell, ci) => {
        doc.fillColor(cell.color)
          .text(cell.text, cols[ci].x + 4, ry + 7, { width: cols[ci].w - 6, lineBreak: false });
      });

      doc.y = ry + rowH;
    });

    // ── Footer + page numbers on every page ─────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      const fy = pageH - 34;
      doc.rect(marginX, fy, contentW, 1).fill(BRAND.navyLight);
      doc.fillColor(BRAND.textDim).fontSize(8).font('Helvetica')
        .text(`Generated by ${COMPANY_NAME}  •  Confidential`, marginX, fy + 8, { width: contentW / 2 });
      doc.fillColor(BRAND.textDim).fontSize(8).font('Helvetica')
        .text(`Page ${i + 1} of ${totalPages}`, marginX + contentW / 2, fy + 8, { width: contentW / 2, align: 'right' });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportCSV, exportXLSX, exportPDF };
