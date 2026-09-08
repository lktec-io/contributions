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

function validateMember(body) {
  const name  = (body.name  || '').trim();
  const phone = (body.phone || '').trim();
  const errors = [];
  if (!name)  errors.push({ field: 'name',  message: 'Name is required' });
  if (!phone) errors.push({ field: 'phone', message: 'Phone is required' });
  else if (phone.replace(/\D/g, '').length < 9) {
    errors.push({ field: 'phone', message: 'Enter a valid phone number' });
  }
  return { name, phone, errors };
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
    const rows = await Contributor.findMembers(req.user.userId);
    return res.json({ success: true, data: { members: decorateCooldown(rows), total: rows.length } });
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

module.exports = {
  search, getAll,
  listMembers, createMember, updateMember, deleteMember,
  // shared with smsController so the member SMS path enforces the same rules
  denyUnlessCustomSms, loadOwnedMember, MEMBER_COOLDOWN_DAYS,
};
