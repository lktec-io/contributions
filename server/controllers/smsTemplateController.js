'use strict';

const SmsTemplate = require('../models/SmsTemplate');
const { denyUnlessCustomSms } = require('./contributorController');
const Contributor = require('../models/Contributor');
const {
  findUnsupportedVariables, SUPPORTED_VARIABLES,
  measureCustomSms, CUSTOM_SMS_SINGLE_LIMIT,
} = require('../utils/smsFormatter');

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

/*  A saved message is reused for many recipients, so it is measured against
    the WORST CASE the owner actually has: their longest member name and the
    chosen event. That way anything saved is guaranteed to fit one SMS for
    every member — a shorter name can only make the message shorter.        */
async function worstCaseSubject(req) {
  // The placeholder is used ONLY when the owner has no members at all —
  // otherwise the longest real name wins, even if it is shorter than the
  // placeholder, so the count reflects this account's actual worst case.
  let name = '';
  try {
    for (const m of await Contributor.findMembers(req.user.userId)) {
      const n = String(m.name || '');
      if (n.length > name.length) name = n;
    }
  } catch {
    // fall through to the placeholder
  }
  if (!name) name = 'MEMBER';

  let event = '';
  if (req.body.eventId || req.query.eventId) {
    try {
      const Event = require('../models/Event');
      const { getIsolationFilter } = require('../utils/tenantHelpers');
      const ev = await Event.findAccessibleById(
        req.body.eventId || req.query.eventId, getIsolationFilter(req)
      );
      if (ev) event = ev.name || '';
    } catch { /* event is optional context */ }
  }
  return { name, event };
}

// Renders + measures with the same formatter the send path uses.
async function measureFor(req, message) {
  const subject = await worstCaseSubject(req);
  const m = measureCustomSms({ name: subject.name, event: subject.event, message });
  return { ...m, measuredFor: subject.name, event: subject.event };
}

// ── POST /api/sms-templates/preview ─────────────────────────────
// Live counter for the editor. Returns the exact body that would be sent.
async function preview(req, res, next) {
  try {
    if (await denyUnlessCustomSms(req, res)) return;
    const message = String(req.body.message || '');
    const m = await measureFor(req, message);
    return res.json({
      success: true,
      data: {
        preview: m.body,
        chars: m.chars,
        segments: m.segments,
        encoding: m.encoding,
        limit: CUSTOM_SMS_SINGLE_LIMIT,
        withinSingle: m.withinSingle,
        measuredFor: m.measuredFor,
        event: m.event,
      },
    });
  } catch (err) {
    next(err);
  }
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

    // Keep Custom SMS to one SMS. The message is never truncated — the
    // operator is told exactly how far over it is and shortens it themselves.
    const m = await measureFor(req, message);
    if (!m.withinSingle) {
      return res.status(400).json({
        success: false,
        message: `This message renders as ${m.chars} characters (${m.segments} SMS). `
          + `Shorten it to ${CUSTOM_SMS_SINGLE_LIMIT} characters or fewer to keep it to one SMS.`,
        errors: [{
          field: 'message',
          message: `${m.chars} / ${CUSTOM_SMS_SINGLE_LIMIT} characters when sent to "${m.measuredFor}"`,
        }],
        data: { chars: m.chars, segments: m.segments, limit: CUSTOM_SMS_SINGLE_LIMIT, measuredFor: m.measuredFor },
      });
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

    // Keep Custom SMS to one SMS. The message is never truncated — the
    // operator is told exactly how far over it is and shortens it themselves.
    const m = await measureFor(req, message);
    if (!m.withinSingle) {
      return res.status(400).json({
        success: false,
        message: `This message renders as ${m.chars} characters (${m.segments} SMS). `
          + `Shorten it to ${CUSTOM_SMS_SINGLE_LIMIT} characters or fewer to keep it to one SMS.`,
        errors: [{
          field: 'message',
          message: `${m.chars} / ${CUSTOM_SMS_SINGLE_LIMIT} characters when sent to "${m.measuredFor}"`,
        }],
        data: { chars: m.chars, segments: m.segments, limit: CUSTOM_SMS_SINGLE_LIMIT, measuredFor: m.measuredFor },
      });
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

module.exports = { list, create, update, remove, preview };
