'use strict';

const axios        = require('axios');
const pool         = require('../config/db');
const Contribution = require('../models/Contribution');
const { getIsolationFilter, canAccessContribution } = require('../utils/tenantHelpers');

const BEEM_ENDPOINT = 'https://apisms.beem.africa/v1/send';

function formatPhone(phone) {
  if (!phone) return null;
  let n = phone.replace(/\s+/g, '').replace(/^\+/, '');
  if (n.startsWith('0'))    n = '255' + n.substring(1);
  if (!n.startsWith('255')) n = '255' + n;
  return n;
}

function fmtAmt(amount) {
  return parseFloat(amount || 0).toLocaleString('en', { maximumFractionDigits: 0 });
}

function buildMessage(name, pledged, paid, balance, eventName, link) {
  let message = (
    `${(eventName || 'Finance Hub').toUpperCase()}]\n` +
    `Habari ${(name || '').toUpperCase()}, Tunashukuru kwa ahadi yako ya TZS ${fmtAmt(pledged)} umefanikiwa kutoa TZS ${fmtAmt(paid)} Tunakukumbusha kukamilisha mchango wako uliobakia wa TZS ${fmtAmt(balance)}\n` +
    `Asante sana.`
  );
  if (link) {
    message += `\nAngalia taarifa zako za mchango na jinsi ya kulipia hapa:\n${link} karibu!`;
  }
  return message;
}

// Collapses accidental whitespace without destroying intentional paragraphs:
// CRLF -> LF, trailing spaces dropped, 3+ newlines become a single blank line.
function normalizeMessageBody(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Custom SMS: greeting + event context + the operator's own body.
// Carries no amounts, no payment instructions and no portal link, and appends
// no brand signature — the sender ID already identifies the service.
function buildCustomMessage(name, eventName, body) {
  const sections = [`Hello ${String(name || '').trim()},`];
  const event = String(eventName || '').trim();
  if (event) sections.push(`Event: ${event}`);
  sections.push(normalizeMessageBody(body));
  return sections.join('\n\n');
}

function buildPortalLink(contribution) {
  if (!contribution.public_token) return null;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/pay/${contribution.public_token}`;
}

// One SMS campaign per user per 7 days, shared across BOTH SMS modes: the most
// recent campaign of any type opens the window. `type` is still recorded on each
// row for auditing, but it no longer scopes the limit.
async function checkBulkLimit(userId) {
  try {
    // recipient_id IS NULL keeps this to campaign rows only. Individual member
    // sends carry a recipient_id and must never consume the campaign window.
    let rows;
    try {
      // 'custom_campaign' is the Custom SMS to All window and is tracked
      // separately, so it never consumes the Dispatch to All allowance.
      [rows] = await pool.query(
        "SELECT sent_at FROM sms_logs WHERE user_id = ? AND recipient_id IS NULL AND type <> 'custom_campaign' ORDER BY sent_at DESC LIMIT 1",
        [userId]
      );
    } catch (err) {
      if (err.errno !== 1054) throw err; // 1054 = column not migrated yet
      [rows] = await pool.query(
        'SELECT sent_at FROM sms_logs WHERE user_id = ? ORDER BY sent_at DESC LIMIT 1',
        [userId]
      );
    }
    if (!rows.length) return { canSend: true, daysRemaining: 0 };
    const diffDays = (Date.now() - new Date(rows[0].sent_at).getTime()) / 86400000;
    if (diffDays < 7) {
      return { canSend: false, daysRemaining: Math.ceil(7 - diffDays) };
    }
    return { canSend: true, daysRemaining: 0 };
  } catch {
    // sms_logs table may not exist yet — allow sending
    return { canSend: true, daysRemaining: 0 };
  }
}

// Valid SMS mode assignments. Kept in sync with userController.
const SMS_MODES = ['custom', 'dispatch_all'];

// Resolves the account's assigned SMS mode. Falls back to 'dispatch_all' — the
// capability every account had before sms_mode existed — so a pending migration
// or an unreadable value can never silently grant a mode the user wasn't given.
async function getUserSmsMode(userId) {
  try {
    const [rows] = await pool.query('SELECT sms_mode FROM users WHERE id = ? LIMIT 1', [userId]);
    const mode = rows[0] && rows[0].sms_mode;
    return SMS_MODES.includes(mode) ? mode : 'dispatch_all';
  } catch {
    return 'dispatch_all';
  }
}

async function getBulkStatus(req, res, next) {
  try {
    const status  = await checkBulkLimit(req.user.userId);
    const smsMode = await getUserSmsMode(req.user.userId);
    // smsMode is additive; canSend/daysRemaining keep their existing shape.
    return res.json({ success: true, data: { ...status, smsMode, role: req.user.role } });
  } catch (err) {
    next(err);
  }
}

async function sendBeemSms(phone, message) {
  if (!process.env.BEEM_SENDER) {
    throw new Error('BEEM_SENDER is not set in environment variables');
  }

  const payload = {
    source_addr: process.env.BEEM_SENDER,
    message,
    encoding:    0,
    recipients:  [{ recipient_id: 1, dest_addr: phone }],
  };

  const response = await axios.post(BEEM_ENDPOINT, payload, {
    auth: {
      username: process.env.BEEM_API_KEY,
      password: process.env.BEEM_SECRET_KEY,
    },
    headers: { 'Content-Type': 'application/json' },
    timeout: 20000,
  });

  console.log('SMS SENT SUCCESSFULLY:', response.data);
  return response.data;
}

async function sendReminder(req, res) {
  try {
    const contribution = await Contribution.findById(req.params.id);

    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contributor not found' });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (!contribution.phone) {
      return res.status(400).json({ success: false, message: 'This contributor has no phone number' });
    }
    if (contribution.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Contributor has already paid in full' });
    }

    const phone = formatPhone(contribution.phone);
    if (!phone || phone.length < 12) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    const pledged = parseFloat(contribution.amount)      || 0;
    const paid    = parseFloat(contribution.paid_amount) || 0;
    const balance = pledged - paid;
    const message = buildMessage(contribution.contributor_name, pledged, paid, balance, contribution.event_name, buildPortalLink(contribution));

    await sendBeemSms(phone, message);

    // Persist the sent state so the UI can disable the button permanently
    try {
      await pool.query(
        'UPDATE contributions SET sms_sent = TRUE, sms_sent_at = NOW() WHERE id = ?',
        [contribution.id]
      );
    } catch (dbErr) {
      console.error('[sms] Failed to persist sms_sent flag:', dbErr.message);
    }

    return res.json({ success: true, message: 'SMS sent successfully' });
  } catch (err) {
    console.error('BEEM ERROR FULL:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error:   err.response?.data || err.message,
    });
  }
}

async function sendBulkReminders(req, res) {
  try {
    const { eventId, customMessage } = req.body;

    // A non-empty customMessage switches this dispatch onto the Custom SMS
    // path. Without it every line below behaves exactly as it always has.
    const customBody = typeof customMessage === 'string' ? customMessage.trim() : '';
    const isCustom   = customBody.length > 0;

    // Authorisation: the account must hold the SMS mode it is trying to use.
    // Enforced server-side so hiding the button in the UI is not the only guard.
    // super_admin is exempt — it administers both modes.
    const requestedMode = isCustom ? 'custom' : 'dispatch_all';
    if (req.user.role !== 'super_admin') {
      const assignedMode = await getUserSmsMode(req.user.userId);
      if (assignedMode !== requestedMode) {
        return res.status(403).json({
          success: false,
          message: 'Your account is not authorised to use this SMS mode.',
          errors:  [],
        });
      }
    }

    const limit = await checkBulkLimit(req.user.userId);
    if (!limit.canSend) {
      return res.status(429).json({
        success: false,
        message: `You can send one SMS campaign per week. You can send your next SMS in ${limit.daysRemaining} day(s).`,
        data:    { daysRemaining: limit.daysRemaining },
        errors:  [],
      });
    }

    const filter = getIsolationFilter(req);
    if (eventId) filter.eventId = eventId;

    const all     = await Contribution.findAll(filter);
    const targets = all.filter(c => c.status !== 'paid' && c.phone);

    if (!targets.length) {
      return res.status(400).json({ success: false, message: 'No unpaid contributors with a phone number found', errors: [] });
    }

    let sent = 0;
    const sentIds = [];

    for (const c of targets) {
      try {
        const phone = formatPhone(c.phone);
        if (!phone || phone.length < 12) continue;

        let message;
        if (isCustom) {
          message = buildCustomMessage(c.contributor_name, c.event_name, customBody);
        } else {
          const pledged = parseFloat(c.amount)      || 0;
          const paid    = parseFloat(c.paid_amount) || 0;
          const balance = pledged - paid;
          message = buildMessage(c.contributor_name, pledged, paid, balance, c.event_name, buildPortalLink(c));
        }

        await sendBeemSms(phone, message);

        // Persist sent state immediately so UI can reflect it on next load.
        // Custom dispatches skip this on purpose: sms_sent marks "payment reminder
        // sent" and disables the per-row reminder button, which an announcement
        // must not consume.
        if (!isCustom) {
          try {
            await pool.query(
              'UPDATE contributions SET sms_sent = TRUE, sms_sent_at = NOW() WHERE id = ?',
              [c.id]
            );
          } catch (dbErr) {
            console.error('[sms] Failed to persist sms_sent flag:', dbErr.message);
          }
        }

        await new Promise(r => setTimeout(r, 300));
        sent++;
        sentIds.push(c.id);
      } catch (err) {
        console.error('BEEM ERROR FULL:', err.response?.data || err.message);
      }
    }

    // Log the dispatch so the weekly limit resets from now, under its own type
    try {
      await pool.query('INSERT INTO sms_logs (user_id, type) VALUES (?, ?)', [req.user.userId, isCustom ? 'custom' : 'bulk']);
    } catch (err) {
      console.error('[sms] Failed to log bulk send:', err.message);
    }

    return res.json({
      success: true,
      message: `SMS dispatched to ${sent} of ${targets.length} contributor(s)`,
      data:    { sent, total: targets.length, sentIds },
    });
  } catch (err) {
    console.error('BEEM ERROR FULL:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error:   err.response?.data || err.message,
      errors:  [],
    });
  }
}

// ── Individual Custom SMS to one member ─────────────────────────
// Cooldown here is per RECIPIENT: contacting one member never disables any
// other member, and never touches the Dispatch-to-All campaign window.

const MEMBER_COOLDOWN_DAYS = 7;

async function checkMemberLimit(userId, memberId) {
  try {
    const [rows] = await pool.query(
      'SELECT sent_at FROM sms_logs WHERE user_id = ? AND recipient_id = ? ORDER BY sent_at DESC LIMIT 1',
      [userId, memberId]
    );
    if (!rows.length) return { canSend: true, daysRemaining: 0 };
    const diff = (Date.now() - new Date(rows[0].sent_at).getTime()) / 86400000;
    if (diff < MEMBER_COOLDOWN_DAYS) {
      return { canSend: false, daysRemaining: Math.ceil(MEMBER_COOLDOWN_DAYS - diff) };
    }
    return { canSend: true, daysRemaining: 0 };
  } catch {
    // recipient_id not migrated yet — don't block sending
    return { canSend: true, daysRemaining: 0 };
  }
}

async function sendMemberSms(req, res) {
  try {
    const { denyUnlessCustomSms, loadOwnedMember } = require('./contributorController');

    if (await denyUnlessCustomSms(req, res)) return;
    const member = await loadOwnedMember(req, res);
    if (!member) return;

    const body = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!body) {
      return res.status(400).json({
        success: false, message: 'Tafadhali andika ujumbe kwanza.',
        errors: [{ field: 'message', message: 'Message is required' }],
      });
    }

    const phone = formatPhone(member.phone);
    if (!phone || phone.length < 12) {
      return res.status(400).json({ success: false, message: 'This member has an invalid phone number', errors: [] });
    }

    // Per-member window. Also the server-side guard against a double-click
    // landing as two real SMS.
    const limit = await checkMemberLimit(req.user.userId, member.id);
    if (!limit.canSend) {
      return res.status(429).json({
        success: false,
        message: `You can send to this member again in ${limit.daysRemaining} day(s).`,
        data:    { daysRemaining: limit.daysRemaining },
        errors:  [],
      });
    }

    // The event NAME is never taken from the client. An eventId is resolved
    // through the existing tenant-isolation lookup, so a user can only stamp an
    // event they actually have access to — and only its name is read, never any
    // target/pledge amount.
    let eventName = '';
    if (req.body.eventId) {
      const Event = require('../models/Event');
      const event = await Event.findAccessibleById(req.body.eventId, getIsolationFilter(req));
      if (!event) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to the selected event.',
          errors:  [],
        });
      }
      eventName = event.name || '';
    }

    const message = buildCustomMessage(member.name, eventName, body);

    await sendBeemSms(phone, message);

    try {
      await pool.query(
        'INSERT INTO sms_logs (user_id, type, recipient_id) VALUES (?, ?, ?)',
        [req.user.userId, 'custom_member', member.id]
      );
    } catch (err) {
      console.error('[sms] Failed to log member send:', err.message);
    }

    return res.json({
      success: true,
      message: 'SMS sent successfully',
      data:    { memberId: member.id, canSend: false, daysRemaining: MEMBER_COOLDOWN_DAYS },
    });
  } catch (err) {
    console.error('BEEM ERROR FULL:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Failed to send SMS', errors: [] });
  }
}

// ── Custom SMS to All (campaign) ────────────────────────────────
// Campaign-level 7-day window, tracked as recipient_id IS NULL with its own
// type. Deliberately does NOT write per-member rows, so individual member
// cooldowns are left exactly as they were.

async function checkCustomCampaignLimit(userId) {
  try {
    const [rows] = await pool.query(
      "SELECT sent_at FROM sms_logs WHERE user_id = ? AND recipient_id IS NULL AND type = 'custom_campaign' ORDER BY sent_at DESC LIMIT 1",
      [userId]
    );
    if (!rows.length) return { canSend: true, daysRemaining: 0 };
    const diff = (Date.now() - new Date(rows[0].sent_at).getTime()) / 86400000;
    if (diff < 7) return { canSend: false, daysRemaining: Math.ceil(7 - diff) };
    return { canSend: true, daysRemaining: 0 };
  } catch {
    return { canSend: true, daysRemaining: 0 };
  }
}

async function sendCustomCampaign(req, res) {
  try {
    const { denyUnlessCustomSms } = require('./contributorController');
    if (await denyUnlessCustomSms(req, res)) return;

    const body = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!body) {
      return res.status(400).json({
        success: false, message: 'Tafadhali andika ujumbe kwanza.',
        errors: [{ field: 'message', message: 'Message is required' }],
      });
    }

    const limit = await checkCustomCampaignLimit(req.user.userId);
    if (!limit.canSend) {
      return res.status(429).json({
        success: false,
        message: `SMS campaign is currently unavailable. Next campaign can be sent in ${limit.daysRemaining} day(s).`,
        data:    { daysRemaining: limit.daysRemaining },
        errors:  [],
      });
    }

    // Recipients come from ownership, never from the request body.
    const Contributor = require('../models/Contributor');
    const members = await Contributor.findMembers(req.user.userId);
    if (!members.length) {
      return res.status(400).json({ success: false, message: 'No members available.', errors: [] });
    }

    // Event name is resolved server-side through the existing isolation check.
    let eventName = '';
    if (req.body.eventId) {
      const Event = require('../models/Event');
      const event = await Event.findAccessibleById(req.body.eventId, getIsolationFilter(req));
      if (!event) {
        return res.status(403).json({ success: false, message: 'You do not have access to the selected event.', errors: [] });
      }
      eventName = event.name || '';
    }

    // Log the campaign BEFORE sending so a duplicate request that arrives while
    // this one is still in flight is rejected by the cooldown.
    try {
      await pool.query(
        "INSERT INTO sms_logs (user_id, type, recipient_id) VALUES (?, 'custom_campaign', NULL)",
        [req.user.userId]
      );
    } catch (err) {
      console.error('[sms] Failed to log custom campaign:', err.message);
    }

    let sent = 0;
    for (const m of members) {
      try {
        const phone = formatPhone(m.phone);
        if (!phone || phone.length < 12) continue;
        // Name is read from the member record, never from the client.
        await sendBeemSms(phone, buildCustomMessage(m.name, eventName, body));
        await new Promise(r => setTimeout(r, 300));
        sent++;
      } catch (err) {
        console.error('BEEM ERROR FULL:', err.response?.data || err.message);
      }
    }

    return res.json({
      success: true,
      message: `SMS sent to ${sent} of ${members.length} member(s)`,
      data:    { sent, total: members.length, daysRemaining: 7 },
    });
  } catch (err) {
    console.error('BEEM ERROR FULL:', err.response?.data || err.message);
    return res.status(500).json({ success: false, message: 'Failed to send SMS', errors: [] });
  }
}

module.exports = {
  sendReminder, sendBulkReminders, getBulkStatus, sendMemberSms,
  sendCustomCampaign, checkCustomCampaignLimit,
};
