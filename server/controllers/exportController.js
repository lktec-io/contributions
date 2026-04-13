const ExcelJS   = require('exceljs');
const XLSX       = require('xlsx');   // still used by CSV
const PDFDocument = require('pdfkit');
const Contribution = require('../models/Contribution');
const Event = require('../models/Event');
const { formatDate } = require('../utils/helpers');

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function getContributionsForExport(req) {
  const { eventId } = req.query;
  const organizationId = req.user.role === 'client_user' ? req.user.userId : null;
  return Contribution.findAll({ eventId: eventId || undefined, organizationId });
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

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'CardHub Digital';
    wb.modified = new Date();

    const ws = wb.addWorksheet('Contributions', {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true },
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    // ── Title row ──────────────────────────────────────────
    ws.mergeCells('A1:I1');
    const titleCell = ws.getCell('A1');
    titleCell.value          = `Contributions Report — ${eventName === 'all' ? 'All Events' : eventName}`;
    titleCell.font           = { bold: true, size: 13, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
    titleCell.fill           = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } };
    titleCell.alignment      = { horizontal: 'center', vertical: 'middle' };
    titleCell.border         = { bottom: { style: 'medium', color: { argb: 'FF00B894' } } };
    ws.getRow(1).height      = 32;

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

    const headerRow = ws.getRow(2);
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
          cell.numFmt    = '#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 6) {
          cell.font      = { ...baseFont, color: { argb: 'FF00B894' }, bold: true };
          cell.numFmt    = '#,##0.00';
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 7) {
          const color    = outstanding > 0 ? 'FFFF4C4C' : 'FF00B894';
          cell.font      = { ...baseFont, color: { argb: color }, bold: true };
          cell.numFmt    = '#,##0.00';
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

    const date     = formatDate(new Date());
    const filename = `report_${sanitizeFilename(eventName)}_${date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const pageW    = doc.page.width;
    const marginX  = 40;
    const contentW = pageW - marginX * 2;

    // ── Header banner ──────────────────────────────────────
    doc.rect(0, 0, pageW, 90).fill('#0D1B2A');

    // Green accent line at bottom of banner
    doc.rect(0, 88, pageW, 2).fill('#00B894');

    doc.fillColor('#00B894')
      .fontSize(20).font('Helvetica-Bold')
      .text('ContribTrack', marginX, 22, { continued: true })
      .fillColor('#FFFFFF')
      .text(' — Contributions Report', { continued: false });

    doc.fillColor('rgba(255,255,255,0.65)').fontSize(10).font('Helvetica')
      .text(`Event: ${eventName}   |   Generated: ${date}   |   Total records: ${contributions.length}`, marginX, 52);

    doc.y = 110;

    // ── Summary boxes ──────────────────────────────────────
    let totalPledged = 0;
    let totalPaid    = 0;
    contributions.forEach(c => {
      totalPledged += parseFloat(c.amount);
      totalPaid    += parseFloat(c.paid_amount);
    });
    const outstanding = totalPledged - totalPaid;

    const boxW = (contentW - 20) / 3;
    const summaryItems = [
      { label: 'Total Pledged',  value: `TZS ${totalPledged.toLocaleString('en', { minimumFractionDigits: 2 })}`,   color: '#FFA500' },
      { label: 'Total Paid',     value: `TZS ${totalPaid.toLocaleString('en', { minimumFractionDigits: 2 })}`,      color: '#00B894' },
      { label: 'Outstanding',    value: `TZS ${outstanding.toLocaleString('en', { minimumFractionDigits: 2 })}`,    color: '#FF4C4C' },
    ];

    summaryItems.forEach((item, i) => {
      const bx = marginX + i * (boxW + 10);
      const by = doc.y;
      doc.roundedRect(bx, by, boxW, 52, 6).fill('#162232');
      doc.rect(bx, by, 3, 52).fill(item.color);
      doc.fillColor('rgba(255,255,255,0.55)').fontSize(8).font('Helvetica')
        .text(item.label.toUpperCase(), bx + 12, by + 10, { width: boxW - 16 });
      doc.fillColor(item.color).fontSize(13).font('Helvetica-Bold')
        .text(item.value, bx + 12, by + 25, { width: boxW - 16 });
    });

    doc.y += 62;

    // ── Table setup ────────────────────────────────────────
    const cols = [
      { label: 'Name',    x: marginX,       w: 100 },
      { label: 'Phone',   x: marginX + 100, w: 76  },
      { label: 'Event',   x: marginX + 176, w: 90  },
      { label: 'Pledged', x: marginX + 266, w: 65  },
      { label: 'Paid',    x: marginX + 331, w: 60  },
      { label: 'Balance', x: marginX + 391, w: 60  },
      { label: 'Status',  x: marginX + 451, w: 50  },
    ];
    const rowH = 22;

    const drawTableHeader = () => {
      const hy = doc.y;
      doc.rect(marginX, hy, contentW, rowH).fill('#1B2838');
      doc.rect(marginX, hy + rowH - 1, contentW, 1).fill('#00B894');

      doc.fillColor('#8892A0').fontSize(8).font('Helvetica-Bold');
      cols.forEach(col => {
        doc.text(col.label.toUpperCase(), col.x + 4, hy + 7, { width: col.w - 6 });
      });
      doc.y = hy + rowH;
    };

    drawTableHeader();

    // ── Rows ───────────────────────────────────────────────
    doc.fontSize(8).font('Helvetica');
    contributions.forEach((c, idx) => {
      if (doc.y > 760) {
        doc.addPage();
        doc.y = 40;
        drawTableHeader();
      }

      const ry      = doc.y;
      const bgColor = idx % 2 === 0 ? '#0F1B28' : '#162232';
      doc.rect(marginX, ry, contentW, rowH).fill(bgColor);

      const pledged = parseFloat(c.amount);
      const paid    = parseFloat(c.paid_amount);
      const balance = pledged - paid;

      const fmtAmt = (n) => n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const cellData = [
        { text: (c.contributor_name || '').substring(0, 18), color: '#FFFFFF' },
        { text: c.phone || '—',                              color: '#8892A0' },
        { text: (c.event_name || '—').substring(0, 14),      color: '#8892A0' },
        { text: fmtAmt(pledged),                              color: '#FFA500' },
        { text: fmtAmt(paid),                                 color: '#00B894' },
        { text: fmtAmt(balance),                              color: balance > 0 ? '#FF4C4C' : '#00B894' },
        { text: c.status,                                     color: c.status === 'paid' ? '#00B894' : c.status === 'partial' ? '#3B82F6' : '#FFA500' },
      ];

      cellData.forEach((cell, ci) => {
        doc.fillColor(cell.color)
          .text(cell.text, cols[ci].x + 4, ry + 7, { width: cols[ci].w - 6, lineBreak: false });
      });

      doc.y = ry + rowH;
    });

    // ── Footer ─────────────────────────────────────────────
    doc.moveDown(1.5);
    doc.rect(marginX, doc.y, contentW, 1).fill('#1B2838');
    doc.moveDown(0.6);
    doc.fillColor('#5A6577').fontSize(8).font('Helvetica')
      .text('Generated by ContribTrack  •  Confidential', { align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportCSV, exportXLSX, exportPDF };
