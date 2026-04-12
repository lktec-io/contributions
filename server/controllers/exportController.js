const XLSX = require('xlsx');
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

// ── XLSX ──────────────────────────────────────────────────────
async function exportXLSX(req, res, next) {
  try {
    const contributions = await getContributionsForExport(req);
    const eventId = req.query.eventId;
    let eventName = 'all';
    if (eventId) {
      const event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    const headers = ['Contributor Name', 'Phone', 'Email', 'Event', 'Pledge Amount', 'Paid Amount', 'Outstanding', 'Status', 'Date'];

    const rows = contributions.map(c => [
      c.contributor_name,
      c.phone || '',
      c.email || '',
      c.event_name,
      parseFloat(c.amount),
      parseFloat(c.paid_amount),
      parseFloat(c.amount) - parseFloat(c.paid_amount),
      c.status,
      formatDate(c.created_at),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // ── Column widths ───────────────────────────────────────
    ws['!cols'] = [
      { wch: 22 }, // Contributor Name
      { wch: 14 }, // Phone
      { wch: 24 }, // Email
      { wch: 18 }, // Event
      { wch: 14 }, // Pledge Amount
      { wch: 13 }, // Paid Amount
      { wch: 13 }, // Outstanding
      { wch: 10 }, // Status
      { wch: 12 }, // Date
    ];

    // ── Header row styling (dark navy + white bold text) ────
    const headerFill   = { patternType: 'solid', fgColor: { rgb: '0D1B2A' } };
    const headerFont   = { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 };
    const headerBorder = {
      top:    { style: 'thin', color: { rgb: '00B894' } },
      bottom: { style: 'thin', color: { rgb: '00B894' } },
      left:   { style: 'thin', color: { rgb: '1B2838' } },
      right:  { style: 'thin', color: { rgb: '1B2838' } },
    };

    headers.forEach((_, ci) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (!ws[ref]) return;
      ws[ref].s = { fill: headerFill, font: headerFont, border: headerBorder, alignment: { horizontal: 'center' } };
    });

    // ── Data rows: alternating rows + money formatting ──────
    const fillEven = { patternType: 'solid', fgColor: { rgb: '162232' } };
    const fillOdd  = { patternType: 'solid', fgColor: { rgb: '1B2838' } };
    const dataFont = { color: { rgb: 'FFFFFF' }, sz: 10 };
    const moneyFmt = '#,##0.00';

    rows.forEach((row, ri) => {
      const fill = ri % 2 === 0 ? fillEven : fillOdd;
      row.forEach((_, ci) => {
        const ref = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (!ws[ref]) return;
        const isMoneyCol = ci >= 4 && ci <= 6;
        ws[ref].s = {
          fill,
          font:      isMoneyCol ? { ...dataFont, color: { rgb: ci === 4 ? 'FFA500' : ci === 5 ? '00B894' : 'FF4C4C' } } : dataFont,
          alignment: { horizontal: isMoneyCol ? 'right' : 'left', vertical: 'center' },
        };
        if (isMoneyCol) ws[ref].z = moneyFmt;
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contributions');

    const date     = formatDate(new Date());
    const filename = `contributions_${sanitizeFilename(eventName)}_${date}.xlsx`;
    const buffer   = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
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
      { label: 'Total Pledged',  value: `KES ${totalPledged.toLocaleString('en', { minimumFractionDigits: 2 })}`,   color: '#FFA500' },
      { label: 'Total Paid',     value: `KES ${totalPaid.toLocaleString('en', { minimumFractionDigits: 2 })}`,      color: '#00B894' },
      { label: 'Outstanding',    value: `KES ${outstanding.toLocaleString('en', { minimumFractionDigits: 2 })}`,    color: '#FF4C4C' },
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
