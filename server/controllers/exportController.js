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
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Event': c.event_name,
      'Pledge Amount': parseFloat(c.amount),
      'Paid Amount': parseFloat(c.paid_amount),
      'Status': c.status,
      'Date': formatDate(c.created_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contributions');

    const date = formatDate(new Date());
    const filename = `contributions_${sanitizeFilename(eventName)}_${date}.csv`;
    const csv = XLSX.utils.sheet_to_csv(ws);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function exportXLSX(req, res, next) {
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
      'Phone': c.phone || '',
      'Email': c.email || '',
      'Event': c.event_name,
      'Pledge Amount': parseFloat(c.amount),
      'Paid Amount': parseFloat(c.paid_amount),
      'Status': c.status,
      'Date': formatDate(c.created_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] || '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contributions');

    const date = formatDate(new Date());
    const filename = `contributions_${sanitizeFilename(eventName)}_${date}.xlsx`;
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function exportPDF(req, res, next) {
  try {
    const contributions = await getContributionsForExport(req);
    const eventId = req.query.eventId;
    let eventName = 'All Events';
    if (eventId) {
      const event = await Event.findById(eventId);
      if (event) eventName = event.name;
    }

    const date = formatDate(new Date());
    const filename = `report_${sanitizeFilename(eventName)}_${date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('ContribTrack — Contribution Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(13).font('Helvetica').text(`Event: ${eventName}`, { align: 'center' });
    doc.fontSize(11).text(`Generated: ${date}`, { align: 'center' });
    doc.moveDown(1);

    // Table headers
    const colX = [40, 150, 230, 310, 380, 450, 510];
    const headers = ['Name', 'Phone', 'Email', 'Event', 'Pledged', 'Paid', 'Status'];
    const rowHeight = 20;

    doc.rect(40, doc.y, 520, rowHeight).fill('#1B2838');
    const headerY = doc.y + 5;
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], headerY, { width: (colX[i + 1] || 560) - colX[i] - 4 }));
    doc.moveDown(1.2);
    doc.fillColor('#000000').font('Helvetica').fontSize(8);

    let totalPledged = 0;
    let totalPaid = 0;

    contributions.forEach((c, idx) => {
      if (doc.y > 720) {
        doc.addPage();
      }
      const rowY = doc.y;
      if (idx % 2 === 0) {
        doc.rect(40, rowY - 2, 520, rowHeight).fill('#F5F7FA');
        doc.fillColor('#000000');
      }
      const pledged = parseFloat(c.amount);
      const paid = parseFloat(c.paid_amount);
      totalPledged += pledged;
      totalPaid += paid;

      const cells = [
        c.contributor_name.substring(0, 15),
        c.phone || '—',
        (c.email || '—').substring(0, 18),
        (c.event_name || '—').substring(0, 12),
        pledged.toFixed(2),
        paid.toFixed(2),
        c.status,
      ];

      cells.forEach((cell, i) => {
        doc.text(String(cell), colX[i], rowY + 2, { width: (colX[i + 1] || 560) - colX[i] - 4 });
      });
      doc.moveDown(1.1);
    });

    // Summary
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(560, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica-Bold');
    doc.text(`Total Pledged: ${totalPledged.toFixed(2)}`);
    doc.text(`Total Paid: ${totalPaid.toFixed(2)}`);
    doc.text(`Outstanding: ${(totalPledged - totalPaid).toFixed(2)}`);

    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { exportCSV, exportXLSX, exportPDF };
