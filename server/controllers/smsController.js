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

function buildMessage(name, pledged, paid, balance, eventName) {
  return (
    `[${(eventName || 'Finance Hub').toUpperCase()}]\n` +
    `Habari ${(name || '').toUpperCase()}, Hatua uliyopiga ni kubwa, tayari umechangia TZS ${fmtAmt(paid)}.\n` +
    `Lengo ni TZS ${fmtAmt(pledged)}, kiasi kilichobaki ni TZS ${fmtAmt(balance)} tu kumaliza.\n` +
    `Tafadhali kamilisha mchango wako. Asante sana!`
  );
}

async function checkBulkLimit(userId) {
  try {
    const [rows] = await pool.query(
      'SELECT sent_at FROM sms_logs WHERE user_id = ? AND type = ? ORDER BY sent_at DESC LIMIT 1',
      [userId, 'bulk']
    );
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

async function getBulkStatus(req, res, next) {
  try {
    const status = await checkBulkLimit(req.user.userId);
    return res.json({ success: true, data: status });
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
    if (!canAccessContribution(req, contribution)) {
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
    const message = buildMessage(contribution.contributor_name, pledged, paid, balance, contribution.event_name);

    await sendBeemSms(phone, message);

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
    const limit = await checkBulkLimit(req.user.userId);
    if (!limit.canSend) {
      return res.status(429).json({
        success: false,
        message: `You can send bulk SMS once per week. Try again in ${limit.daysRemaining} day(s).`,
        data:    { daysRemaining: limit.daysRemaining },
        errors:  [],
      });
    }

    const { eventId } = req.body;
    const filter = getIsolationFilter(req);
    if (eventId) filter.eventId = eventId;

    const all     = await Contribution.findAll(filter);
    const targets = all.filter(c => c.status !== 'paid' && c.phone);

    if (!targets.length) {
      return res.status(400).json({ success: false, message: 'No unpaid contributors with a phone number found', errors: [] });
    }

    let sent = 0;

    for (const c of targets) {
      try {
        const phone = formatPhone(c.phone);
        if (!phone || phone.length < 12) continue;

        const pledged = parseFloat(c.amount)      || 0;
        const paid    = parseFloat(c.paid_amount) || 0;
        const balance = pledged - paid;
        const message = buildMessage(c.contributor_name, pledged, paid, balance, c.event_name);

        await sendBeemSms(phone, message);
        await new Promise(r => setTimeout(r, 300));
        sent++;
      } catch (err) {
        console.error('BEEM ERROR FULL:', err.response?.data || err.message);
      }
    }

    // Log the bulk dispatch so the weekly limit resets from now
    try {
      await pool.query('INSERT INTO sms_logs (user_id, type) VALUES (?, ?)', [req.user.userId, 'bulk']);
    } catch (err) {
      console.error('[sms] Failed to log bulk send:', err.message);
    }

    return res.json({
      success: true,
      message: `SMS dispatched to ${sent} of ${targets.length} contributor(s)`,
      data:    { sent, total: targets.length },
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

module.exports = { sendReminder, sendBulkReminders, getBulkStatus };
