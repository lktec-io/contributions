'use strict';

const Contributor = require('../models/Contributor');
const { getIsolationFilter } = require('../utils/tenantHelpers');

async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: [] });

    const filter  = getIsolationFilter(req);
    const results = await Contributor.search(q, filter);
    return res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const filter       = getIsolationFilter(req);
    const contributors = await Contributor.findAll(filter);
    return res.json({ success: true, data: { contributors, total: contributors.length } });
  } catch (err) {
    next(err);
  }
}

// ── Custom SMS members ──────────────────────────────────────────
// Members reuse the existing `contributors` table: a row owned by the caller
// (created_by) with name + phone only. No contribution/financial data is read
// or written here, so a Custom SMS user never touches the money workflow.

const MEMBER_COOLDOWN_DAYS = 7;

// Every member endpoint requires sms_mode = 'custom'. super_admin is exempt so
// administration keeps working. Returns null when allowed, or sends the 403.
async function denyUnlessCustomSms(req, res) {
  if (req.user.role === 'super_admin') return null;
  const pool = require('../config/db');
  let mode = 'dispatch_all';
  try {
    const [rows] = await pool.query('SELECT sms_mode FROM users WHERE id = ? LIMIT 1', [req.user.userId]);
    if (rows[0] && rows[0].sms_mode) mode = rows[0].sms_mode;
  } catch {
    // column missing — treat as the pre-existing capability, which is not custom
  }
  if (mode !== 'custom') {
    res.status(403).json({ success: false, message: 'Your account is not authorised to manage Custom SMS members.', errors: [] });
    return true;
  }
  return null;
}

// Loads a member and confirms the caller owns it. Sends 404/403 when not.
async function loadOwnedMember(req, res) {
  const member = await Contributor.findMemberById(req.params.id);
  if (!member) {
    res.status(404).json({ success: false, message: 'Member not found', errors: [] });
    return null;
  }
  if (req.user.role !== 'super_admin' && member.created_by !== req.user.userId) {
    res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    return null;
  }
  return member;
}

// Comparison key for member identity: case- and spacing-insensitive. Used only
// to detect duplicates — the stored display name keeps its original spelling.
function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// A phone number is optional. A member with no number is a real member who
// simply has no number yet; validation applies only when one is supplied.
function validateMember(body) {
  const name  = (body.name  || '').trim();
  const phone = (body.phone || '').trim();
  const errors = [];
  if (!name) errors.push({ field: 'name', message: 'Name is required' });
  if (phone && phone.replace(/\D/g, '').length < 9) {
    errors.push({ field: 'phone', message: 'Enter a valid phone number' });
  }
  return { name, phone: phone || null, errors };
}

// Adds the per-member cooldown to each row, computed from that member's own
// last send — never from any other member's.
function decorateCooldown(rows) {
  return rows.map(m => {
    let canSend = true;
    let daysRemaining = 0;
    if (m.last_sms_at) {
      const diff = (Date.now() - new Date(m.last_sms_at).getTime()) / 86400000;
      if (diff < MEMBER_COOLDOWN_DAYS) {
        canSend = false;
        daysRemaining = Math.ceil(MEMBER_COOLDOWN_DAYS - diff);
      }
    }
    return { id: m.id, name: m.name, phone: m.phone, created_at: m.created_at, canSend, daysRemaining };
  });
}

// ── GET /api/contributors/members ───────────────────────────────
async function listMembers(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;

    // findMembers already returns the caller's members sorted A-Z
    // (case-insensitive) in SQL. Counts below are over the WHOLE list so the
    // dashboard totals stay correct regardless of which page is requested.
    const rows    = await Contributor.findMembers(req.user.userId);
    const all     = decorateCooldown(rows);
    const total   = all.length;
    const smsSent = all.filter(m => !m.canSend).length;

    const q = String(req.query.search || '').trim().toLowerCase();
    const filtered = q
      ? all.filter(m => (m.name || '').toLowerCase().includes(q) || (m.phone || '').includes(q))
      : all;

    // Pagination is opt-in: without a limit the full list is returned, so every
    // existing caller (dashboard, reports, campaigns) is unaffected.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 0), 200);
    let members = filtered;
    let page = 1;
    let pages = 1;

    if (limit > 0) {
      pages = Math.max(1, Math.ceil(filtered.length / limit));
      page  = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages);
      members = filtered.slice((page - 1) * limit, page * limit);
    }

    // Campaign window travels with the list so the dashboard needs no extra call.
    const { checkCustomCampaignLimit } = require('./smsController');
    const campaign = await checkCustomCampaignLimit(req.user.userId);

    return res.json({
      success: true,
      data: {
        members,
        total,                       // every member the caller owns
        matched: filtered.length,    // after the search filter
        page,
        pages,
        limit,
        campaign,
        smsSent,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/contributors/members ──────────────────────────────
async function createMember(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    const { name, phone, errors } = validateMember(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    // Same name identity rule as the Excel import, scoped to this owner only.
    const existing = await Contributor.findMembers(req.user.userId);
    const key = normalizeName(name);
    if (existing.some(m => normalizeName(m.name) === key)) {
      return res.status(409).json({
        success: false,
        message: `"${name}" is already in your member list.`,
        errors: [{ field: 'name', message: 'A member with this name already exists' }],
      });
    }

    const id = await Contributor.createMember({ name, phone, created_by: req.user.userId });
    return res.status(201).json({ success: true, data: { id, name, phone } });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/contributors/members/:id ───────────────────────────
async function updateMember(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    if (!(await loadOwnedMember(req, res))) return;
    const { name, phone, errors } = validateMember(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    // Renaming onto another existing member's name would create a duplicate.
    // Editing a member and keeping its own name is always allowed.
    const id  = Number(req.params.id);
    const key = normalizeName(name);
    const existing = await Contributor.findMembers(req.user.userId);
    if (existing.some(m => m.id !== id && normalizeName(m.name) === key)) {
      return res.status(409).json({
        success: false,
        message: `"${name}" is already in your member list.`,
        errors: [{ field: 'name', message: 'A member with this name already exists' }],
      });
    }

    await Contributor.updateMember(req.params.id, { name, phone });
    return res.json({ success: true, data: { id: Number(req.params.id), name, phone } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/contributors/members/:id ────────────────────────
async function deleteMember(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    if (!(await loadOwnedMember(req, res))) return;

    // Refuse to remove anyone still attached to contribution records.
    const linked = await Contributor.countContributions(req.params.id);
    if (linked > 0) {
      return res.status(409).json({
        success: false,
        message: 'This person has contribution records and cannot be deleted here.',
        errors:  [],
      });
    }

    await Contributor.deleteMember(req.params.id);
    return res.json({ success: true, data: { message: 'Member deleted' } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/contributors/members ────────────────────────────
// Hard-deletes the AUTHENTICATED USER'S members only. Rows still referenced by
// contribution records are kept, so no financial history can be destroyed here.
// sms_logs is deliberately left untouched: the request is to delete members,
// not campaign history, and there is no FK cascade on that table.
async function deleteAllMembers(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;

    const members = await Contributor.findMembers(req.user.userId);
    if (!members.length) {
      return res.json({ success: true, data: { deleted: 0, kept: 0, message: 'No members to delete' } });
    }

    let deleted = 0;
    let kept    = 0;

    for (const m of members) {
      // Ownership was established by findMembers (created_by = caller); this
      // only protects contribution-linked people from being removed.
      const linked = await Contributor.countContributions(m.id);
      if (linked > 0) { kept++; continue; }
      try {
        await Contributor.deleteMember(m.id);
        deleted++;
      } catch (err) {
        console.error('[members] Failed to delete member:', err.message);
        kept++;
      }
    }

    return res.json({
      success: true,
      message: `${deleted} member${deleted !== 1 ? 's' : ''} deleted successfully.`,
      data: { deleted, kept },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  search, getAll,
  listMembers, createMember, updateMember, deleteMember, deleteAllMembers,
  // shared with smsController so the member SMS path enforces the same rules
  denyUnlessCustomSms, loadOwnedMember, MEMBER_COOLDOWN_DAYS,
};
