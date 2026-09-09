'use strict';

const SmsTemplate = require('../models/SmsTemplate');
const { denyUnlessCustomSms } = require('./contributorController');
const { findUnsupportedVariables, SUPPORTED_VARIABLES } = require('../utils/smsFormatter');

const MAX_TITLE   = 120;
const MAX_MESSAGE = 1600;

function validate(body) {
  const title   = String(body.title   || '').trim();
  const message = String(body.message || '').trim();
  const errors  = [];

  if (!title)   errors.push({ field: 'title',   message: 'Title is required' });
  else if (title.length > MAX_TITLE) errors.push({ field: 'title', message: `Title must be ${MAX_TITLE} characters or fewer` });

  if (!message) errors.push({ field: 'message', message: 'Message is required' });
  else if (message.length > MAX_MESSAGE) errors.push({ field: 'message', message: `Message must be ${MAX_MESSAGE} characters or fewer` });

  // Unknown placeholders are reported rather than silently sent to a handset.
  const unsupported = findUnsupportedVariables(message);
  if (unsupported.length) {
    errors.push({
      field: 'message',
      message: `Unsupported variable(s): ${unsupported.map(v => `{{${v}}}`).join(', ')}. `
        + `Supported: ${SUPPORTED_VARIABLES.map(v => `{{${v}}}`).join(', ')}`,
    });
  }

  return { title, message, errors };
}

// ── GET /api/sms-templates ──────────────────────────────────────
async function list(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    const templates = await SmsTemplate.findAllByUser(req.user.userId);
    return res.json({ success: true, data: { templates, total: templates.length } });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/sms-templates ─────────────────────────────────────
async function create(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    const { title, message, errors } = validate(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    const id = await SmsTemplate.create({ userId: req.user.userId, title, message });
    return res.status(201).json({ success: true, data: { id, title, message } });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/sms-templates/:id ──────────────────────────────────
async function update(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    const { title, message, errors } = validate(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }
    // Scoped update: another user's id affects no rows and 404s.
    const ok = await SmsTemplate.update(req.params.id, req.user.userId, { title, message });
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Saved message not found', errors: [] });
    }
    return res.json({ success: true, data: { id: Number(req.params.id), title, message } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/sms-templates/:id ───────────────────────────────
async function remove(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    const ok = await SmsTemplate.remove(req.params.id, req.user.userId);
    if (!ok) {
      return res.status(404).json({ success: false, message: 'Saved message not found', errors: [] });
    }
    return res.json({ success: true, data: { message: 'Saved message deleted' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
