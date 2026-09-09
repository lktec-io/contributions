'use strict';

/*  Custom SMS member reports and Excel import.
    Communication-only by construction: every query here is scoped to the
    caller's own members and reads name / phone / SMS history exclusively.
    No contribution, pledge, payment or balance data is touched.            */

const ExcelJS     = require('exceljs');
const XLSX        = require('xlsx');
const PDFDocument = require('pdfkit');
const pool        = require('../config/db');
const Contributor = require('../models/Contributor');
const User        = require('../models/User');
const { BRAND, COMPANY_NAME, argb, resolveBranding } = require('../utils/reportBranding');
const { denyUnlessCustomSms } = require('./contributorController');

const COOLDOWN_DAYS = 7;

function sanitizeFilename(str) {
  return String(str || 'members').replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Comparison key for member identity: case- and spacing-insensitive.
// Used only to detect duplicates — the stored display name keeps its spelling.
function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Shared shape for both report formats. Ownership is enforced by findMembers,
// which filters on created_by = the authenticated user.
async function loadMemberRows(userId) {
  const rows = await Contributor.findMembers(userId);
  return rows.map((m, i) => {
    let status = 'Available';
    let days   = 0;
    if (m.last_sms_at) {
      const diff = (Date.now() - new Date(m.last_sms_at).getTime()) / 86400000;
      if (diff < COOLDOWN_DAYS) { status = 'Cooldown'; days = Math.ceil(COOLDOWN_DAYS - diff); }
    }
    return {
      no: i + 1,
      name: m.name || '',
      phone: m.phone || '',
      status,
      daysRemaining: days,
      lastSms: m.last_sms_at ? fmtDate(m.last_sms_at) : 'Never',
      createdAt: fmtDate(m.created_at),
    };
  });
}

function summarize(rows) {
  const cooldown = rows.filter(r => r.status === 'Cooldown').length;
  return {
    total: rows.length,
    smsSent: rows.filter(r => r.lastSms !== 'Never').length,
    available: rows.length - cooldown,
    cooldown,
  };
}

// Resolves an optional event for report context. Uses the existing isolation
// lookup, so an event the caller cannot access is simply omitted — and only
// the name is ever read, never a target amount.
async function resolveEventName(req) {
  if (!req.query.eventId) return '';
  try {
    const Event = require('../models/Event');
    const { getIsolationFilter } = require('../utils/tenantHelpers');
    const event = await Event.findAccessibleById(req.query.eventId, getIsolationFilter(req));
    return event ? (event.name || '') : '';
  } catch {
    return '';
  }
}

// ── GET /api/contributors/members/export/xlsx ───────────────────
async function exportMembersXLSX(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;

    const rows      = await loadMemberRows(req.user.userId);
    const summary   = summarize(rows);
    const eventName = await resolveEventName(req);
    const branding  = await resolveBranding(req.user.userId);
    const me        = await User.findById(req.user.userId);

    const wb = new ExcelJS.Workbook();
    wb.creator = branding.organizationName || COMPANY_NAME;
    const ws = wb.addWorksheet('Members');

    const headers = ['No.', 'Name', 'Phone', 'SMS Status', 'Last SMS', 'Created At'];
    if (eventName) headers.push('Event');

    ws.mergeCells(1, 1, 1, headers.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = `${branding.organizationName || COMPANY_NAME} — Custom SMS Member Report`;
    titleCell.font = { bold: true, size: 14, color: { argb: argb(BRAND.white) } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.navy) } };
    ws.getRow(1).height = 26;

    ws.mergeCells(2, 1, 2, headers.length);
    const metaCell = ws.getCell(2, 1);
    metaCell.value = `User: ${me?.name || '—'}   |   Generated: ${fmtDate(new Date())}`
      + (eventName ? `   |   Event: ${eventName}` : '');
    metaCell.font = { size: 10, color: { argb: argb(BRAND.muted) } };
    ws.getRow(3).height = 6;

    const headerRow = ws.getRow(4);
    headerRow.values = headers;
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: argb(BRAND.white) } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BRAND.green) } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    headerRow.height = 20;

    rows.forEach(r => {
      const values = [r.no, r.name, r.phone, r.status, r.lastSms, r.createdAt];
      if (eventName) values.push(eventName);
      const row = ws.addRow(values);
      row.getCell(4).font = {
        color: { argb: argb(r.status === 'Cooldown' ? BRAND.muted : BRAND.success) },
        bold: true,
      };
    });

    ws.addRow([]);
    const sum = ws.addRow(['Summary', `Total: ${summary.total}`, `SMS Sent: ${summary.smsSent}`,
      `Available: ${summary.available}`, `Cooldown: ${summary.cooldown}`]);
    sum.font = { bold: true, color: { argb: argb(BRAND.navy) } };

    ws.columns = [
      { width: 6 }, { width: 28 }, { width: 20 }, { width: 14 }, { width: 16 }, { width: 16 },
      ...(eventName ? [{ width: 26 }] : []),
    ];

    const filename = `custom_sms_members_${sanitizeFilename(me?.name)}_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    next(err);
  }
}

// ── GET /api/contributors/members/export/pdf ────────────────────
async function exportMembersPDF(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;

    const rows      = await loadMemberRows(req.user.userId);
    const summary   = summarize(rows);
    const eventName = await resolveEventName(req);
    const branding  = await resolveBranding(req.user.userId);
    const me        = await User.findById(req.user.userId);
    const orgName   = branding.organizationName || COMPANY_NAME;

    const filename = `custom_sms_members_${sanitizeFilename(me?.name)}_${new Date().toISOString().split('T')[0]}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    doc.pipe(res);

    const pageW = doc.page.width;
    const left  = 40;
    const right = pageW - 40;
    const usable = right - left;

    // Header band
    doc.rect(0, 0, pageW, 88).fill(BRAND.navy);
    doc.fillColor(BRAND.white).fontSize(18).font('Helvetica-Bold')
       .text(orgName, left, 26, { width: usable });
    doc.fontSize(11).font('Helvetica')
       .text('Custom SMS Member Report', left, 52, { width: usable });

    let y = 108;
    doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica');
    doc.text(`User: ${me?.name || '—'}`, left, y);
    doc.text(`Generated: ${fmtDate(new Date())}`, left + usable / 2, y);
    y += 14;
    if (eventName) {
      doc.text(`Event: ${eventName}`, left, y);
      y += 14;
    }

    y += 8;
    // Summary cards
    const cards = [
      ['Total Members', String(summary.total)],
      ['SMS Sent',      String(summary.smsSent)],
      ['Available',     String(summary.available)],
      ['In Cooldown',   String(summary.cooldown)],
    ];
    const cardW = (usable - 3 * 8) / 4;
    cards.forEach(([label, value], i) => {
      const x = left + i * (cardW + 8);
      doc.roundedRect(x, y, cardW, 44, 4).fillAndStroke(BRAND.bg, BRAND.border);
      doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica')
         .text(label.toUpperCase(), x + 8, y + 9, { width: cardW - 16 });
      doc.fillColor(BRAND.navy).fontSize(15).font('Helvetica-Bold')
         .text(value, x + 8, y + 21, { width: cardW - 16 });
    });
    y += 62;

    // Table
    const cols = [
      { key: 'no',      label: 'No.',        w: 34 },
      { key: 'name',    label: 'Name',       w: usable - 34 - 110 - 76 - 80 },
      { key: 'phone',   label: 'Phone',      w: 110 },
      { key: 'status',  label: 'SMS Status', w: 76 },
      { key: 'lastSms', label: 'Last SMS',   w: 80 },
    ];

    const drawHeader = () => {
      doc.rect(left, y, usable, 22).fill(BRAND.green);
      let x = left;
      doc.fillColor(BRAND.white).fontSize(8.5).font('Helvetica-Bold');
      cols.forEach(c => { doc.text(c.label, x + 6, y + 7, { width: c.w - 12 }); x += c.w; });
      y += 22;
    };

    drawHeader();

    if (!rows.length) {
      doc.fillColor(BRAND.muted).fontSize(9).font('Helvetica')
         .text('No members yet.', left + 6, y + 10);
    }

    rows.forEach((r, i) => {
      if (y > doc.page.height - 70) {
        doc.addPage();
        y = 50;
        drawHeader();
      }
      if (i % 2 === 0) doc.rect(left, y, usable, 20).fill(BRAND.bg);
      let x = left;
      doc.fontSize(8.5).font('Helvetica');
      cols.forEach(c => {
        const isStatus = c.key === 'status';
        doc.fillColor(isStatus
          ? (r.status === 'Cooldown' ? BRAND.muted : BRAND.success)
          : BRAND.navy);
        doc.text(String(r[c.key]), x + 6, y + 6, { width: c.w - 12, ellipsis: true, lineBreak: false });
        x += c.w;
      });
      y += 20;
    });

    doc.fillColor(BRAND.muted).fontSize(7.5).font('Helvetica')
       .text(`${orgName} · Custom SMS Member Report`, left, doc.page.height - 44, { width: usable, align: 'center' });

    doc.end();
  } catch (err) {
    next(err);
  }
}

// ── POST /api/contributors/members/import ───────────────────────
// Accepts .xlsx/.xls with Name + Phone columns. Ownership is always the
// authenticated user; any owner column in the sheet is ignored.
async function importMembers(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file was uploaded', errors: [] });
    }

    let sheetRows;
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const first = wb.SheetNames[0];
      if (!first) throw new Error('empty workbook');
      sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[first], { defval: '' });
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Could not read that file. Please upload a valid .xlsx or .xls workbook.',
        errors: [],
      });
    }

    // A file that yields no rows at all is almost always the wrong file or a
    // corrupt upload — say so plainly rather than reporting "0 imported".
    if (!Array.isArray(sheetRows) || sheetRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No rows were found in that file. Make sure the first sheet has Name and Phone columns.',
        errors: [],
      });
    }

    const pick = (row, names) => {
      const key = Object.keys(row).find(k => names.includes(k.trim().toLowerCase()));
      return key ? String(row[key] ?? '').trim() : '';
    };

    // Identity is the member NAME, normalised for comparison only (the stored
    // display name keeps the spelling from the sheet). Scoped to THIS user's
    // members, so another owner's list neither blocks nor is visible here.
    const existing = await Contributor.findMembers(req.user.userId);
    const seenNames = new Set(existing.map(m => normalizeName(m.name)));

    const valid = [];
    const skipped = {
      missingName: 0, invalidPhone: 0, alreadyExists: 0, duplicateInFile: 0, empty: 0,
      notSaved: 0,
    };

    for (const row of sheetRows) {
      const name  = pick(row, ['name', 'full name', 'member', 'member name', 'jina']);
      const phone = pick(row, ['phone', 'phone number', 'mobile', 'simu', 'namba']);

      if (!name && !phone) { skipped.empty++; continue; }
      if (!name) { skipped.missingName++; continue; }

      // A blank phone is not an error — the member is imported without one and
      // can be given a number later. Validation applies only when one is given.
      let storedPhone = null;
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 15) { skipped.invalidPhone++; continue; }
        storedPhone = phone.slice(0, 50);
      }

      const key = normalizeName(name);
      if (seenNames.has(key)) {
        // Distinguish "already in your list" from "repeated inside this file"
        if (existing.some(m => normalizeName(m.name) === key)) skipped.alreadyExists++;
        else skipped.duplicateInFile++;
        continue;
      }

      seenNames.add(key);
      valid.push({ name: name.slice(0, 255), phone: storedPhone });
    }

    let imported = 0;
    for (const m of valid) {
      try {
        // created_by always comes from the session, never from the sheet.
        await Contributor.createMember({ name: m.name, phone: m.phone, created_by: req.user.userId });
        imported++;
      } catch (err) {
        // A write failure is not a phone problem — count it separately so the
        // summary never blames a valid row's phone number.
        console.error('[import] Failed to insert member:', err.message);
        skipped.notSaved++;
      }
    }

    const reasons = [];
    if (skipped.alreadyExists)   reasons.push(`${skipped.alreadyExists} already in your list`);
    if (skipped.duplicateInFile) reasons.push(`${skipped.duplicateInFile} repeated inside the file`);
    if (skipped.invalidPhone)    reasons.push(`${skipped.invalidPhone} invalid phone number(s)`);
    if (skipped.missingName)     reasons.push(`${skipped.missingName} missing name(s)`);
    if (skipped.empty)           reasons.push(`${skipped.empty} empty row(s)`);
    if (skipped.notSaved)        reasons.push(`${skipped.notSaved} could not be saved`);

    const totalSkipped = Object.values(skipped).reduce((a, b) => a + b, 0);

    return res.json({
      success: true,
      message: `Import completed. Added ${imported}, skipped ${totalSkipped}.`,
      data: {
        rows: sheetRows.length,
        imported,
        skipped: totalSkipped,
        withoutPhone: valid.filter(v => !v.phone).length,
        reasons,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { exportMembersXLSX, exportMembersPDF, importMembers };
