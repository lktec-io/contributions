'use strict';

const axios        = require('axios');
const Contribution = require('../models/Contribution');
const { getIsolationFilter, canAccessContribution } = require('../utils/tenantHelpers');

const BEEM_ENDPOINT = 'https://apisms.beem.africa/v1/send';

// ── formatPhone ───────────────────────────────────────────────
function formatPhone(phone) {
  if (!phone) return null;

  let cleaned = phone.replace(/\s+/g, '').replace(/^\+/, ''); // remove spaces and leading +

  if (cleaned.startsWith('0'))    return '255' + cleaned.substring(1);  // 0674→255674
  if (!cleaned.startsWith('255')) return '255' + cleaned;               // 7XX→2557XX

  return cleaned;
}

// ── formatCurrency ────────────────────────────────────────────
function formatCurrency(amount) {
  return `TZS ${parseFloat(amount || 0).toLocaleString('en-TZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── buildMessage ──────────────────────────────────────────────
function buildMessage(name, pledged, paid, balance) {
  return (
    `Habari ${name},\n` +
    `Umechangia ${formatCurrency(paid)}.\n` +
    `Ulichopanga ni ${formatCurrency(pledged)}.\n` +
    `Salio lako ni ${formatCurrency(balance)}.\n` +
    `Tafadhali kamilisha mchango wako. Asante sana.`
  );
}

// ── sendBeemSms ───────────────────────────────────────────────
async function sendBeemSms(phone, message) {
  const apiKey    = process.env.BEEM_API_KEY;
  const secretKey = process.env.BEEM_SECRET_KEY;
  const sender    = (process.env.BEEM_SENDER || 'INFO').trim() || 'INFO';

  if (!apiKey || !secretKey) {
    const missing = [!apiKey && 'BEEM_API_KEY', !secretKey && 'BEEM_SECRET_KEY']
      .filter(Boolean).join(', ');
    const err = new Error(`SMS service not configured — missing: ${missing}`);
    err.statusCode = 503;
    throw err;
  }

  // Build Basic Auth header manually — most reliable across all HTTP clients
  const token = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

  // Exact payload Beem accepts — no extra fields
  const payload = {
    source_addr: sender,
    message,
    recipients: [{ recipient_id: 1, dest_addr: phone }],
  };

  console.log('====== SMS DEBUG ======');
  console.log('PHONE:',   phone);
  console.log('SENDER:',  sender);
  console.log('MESSAGE:', message);
  console.log('PAYLOAD:', JSON.stringify(payload, null, 2));
  console.log('=======================');

  const response = await axios.post(BEEM_ENDPOINT, payload, {
    headers: {
      'Authorization': `Basic ${token}`,
      'Content-Type':  'application/json',
    },
    timeout: 20000,
  });

  console.log('BEEM RESPONSE:', response.data);
  return response.data;
}

// ── sendReminder ──────────────────────────────────────────────
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

    const phone   = formatPhone(contribution.phone);
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    const pledged = parseFloat(contribution.amount)      || 0;
    const paid    = parseFloat(contribution.paid_amount) || 0;
    const balance = pledged - paid;
    const message = buildMessage(contribution.contributor_name, pledged, paid, balance);

    await sendBeemSms(phone, message);

    return res.json({ success: true, message: 'SMS sent successfully' });
  } catch (err) {
    console.error('BEEM ERROR FULL:', err.response?.data || err.message);
    const status = err.statusCode || err.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: err.response?.data?.message || err.message || 'Failed to send SMS',
    });
  }
}

// ── sendBulkReminders ─────────────────────────────────────────
async function sendBulkReminders(req, res) {
  try {
    const { eventId } = req.body;
    const filter = getIsolationFilter(req);
    if (eventId) filter.eventId = eventId;

    const all     = await Contribution.findAll(filter);
    const targets = all.filter(c => c.status !== 'paid' && c.phone);

    if (!targets.length) {
      return res.status(400).json({ success: false, message: 'No unpaid contributors with a phone number found' });
    }

    let sent = 0;

    for (const c of targets) {
      try {
        const phone = formatPhone(c.phone);
        if (!phone) continue;

        const pledged = parseFloat(c.amount)      || 0;
        const paid    = parseFloat(c.paid_amount) || 0;
        const balance = pledged - paid;
        const message = buildMessage(c.contributor_name, pledged, paid, balance);

        await sendBeemSms(phone, message);
        sent++;
      } catch (err) {
        console.error('BEEM ERROR (bulk, skipped):', err.response?.data || err.message);
      }
    }

    return res.json({
      success: true,
      message: 'SMS sent successfully',
      data:    { sent, total: targets.length },
    });
  } catch (err) {
    console.error('BEEM ERROR FULL (bulk):', err.response?.data || err.message);
    const status = err.statusCode || err.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: err.response?.data?.message || err.message || 'Bulk SMS failed',
    });
  }
}

module.exports = { sendReminder, sendBulkReminders };
