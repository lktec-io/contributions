'use strict';

const axios        = require('axios');
const Contribution = require('../models/Contribution');
const { getIsolationFilter, canAccessContribution } = require('../utils/tenantHelpers');

const BEEM_ENDPOINT = 'https://apisms.beem.africa/v1/send';

// ── formatPhone ───────────────────────────────────────────────
// Normalises any Tanzanian number to 255XXXXXXXXX (no + prefix).
// Beem requires the number without a leading +.
function formatPhone(phone) {
  if (!phone) return null;
  let n = phone.replace(/[\s\-().+]/g, '');   // strip spaces, dashes, parens, +
  if (n.startsWith('0'))    n = '255' + n.slice(1);   // 0674... → 255674...
  if (!n.startsWith('255')) n = '255' + n;             // 7XX... → 2557XX...
  return n;
}

// ── formatCurrency ────────────────────────────────────────────
function formatCurrency(amount) {
  return `TZS ${parseFloat(amount || 0).toLocaleString('en-TZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── buildMessage ──────────────────────────────────────────────
// Swahili reminder message for a single contributor.
function buildMessage(name, pledged, paid, balance) {
  return (
    `Habari ${name},\n` +
    `Umechangia ${formatCurrency(paid)}.\n` +
    `Ulichopanga ni ${formatCurrency(pledged)}.\n` +
    `Salio lako ni ${formatCurrency(balance)}.\n` +
    `Tafadhali kamilisha mchango wako. Asante sana 🙏`
  );
}

// ── getBeemCredentials ────────────────────────────────────────
function getBeemCredentials() {
  const apiKey    = process.env.BEEM_API_KEY;
  const secretKey = process.env.BEEM_SECRET_KEY;
  const sender    = process.env.BEEM_SENDER || 'INFO';

  if (!apiKey || !secretKey) {
    const missing = [
      !apiKey    && 'BEEM_API_KEY',
      !secretKey && 'BEEM_SECRET_KEY',
    ].filter(Boolean).join(', ');
    const err = new Error(`SMS service not configured — missing env vars: ${missing}`);
    err.statusCode = 503;
    throw err;
  }

  return { apiKey, secretKey, sender };
}

// ── sendBeemSms ───────────────────────────────────────────────
// Core Beem API call. Throws on HTTP or network error.
async function sendBeemSms(phone, message) {
  const { apiKey, secretKey, sender } = getBeemCredentials();

  const payload = {
    source_addr:   sender,
    schedule_time: '',
    encoding:      0,
    message,
    recipients:    [{ recipient_id: 1, dest_addr: phone }],
  };

  console.log('Sending SMS to:', phone);
  console.log('Message:', message);

  const response = await axios.post(BEEM_ENDPOINT, payload, {
    auth:    { username: apiKey, password: secretKey },
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  console.log('BEEM RESPONSE:', response.data);
  return response.data;
}

// ── extractBeemError ──────────────────────────────────────────
function extractBeemError(err) {
  return err.response?.data?.message
    || err.response?.data
    || err.message
    || 'Failed to send SMS';
}

// ── sendReminder ──────────────────────────────────────────────
// POST /api/sms/reminder/:id
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
      return res.status(400).json({ success: false, message: 'No phone number found for this contributor' });
    }
    if (contribution.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Contributor has already paid in full' });
    }

    const phone   = formatPhone(contribution.phone);
    const pledged = parseFloat(contribution.amount)      || 0;
    const paid    = parseFloat(contribution.paid_amount) || 0;
    const balance = pledged - paid;
    const message = buildMessage(contribution.contributor_name, pledged, paid, balance);

    await sendBeemSms(phone, message);

    return res.json({ success: true, message: 'SMS sent successfully' });
  } catch (err) {
    console.error('BEEM ERROR:', err.response?.data || err.message);
    const status = err.statusCode || err.response?.status || 500;
    return res.status(status).json({ success: false, message: extractBeemError(err) });
  }
}

// ── sendBulkReminders ─────────────────────────────────────────
// POST /api/sms/bulk-reminder  { eventId? }
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
        const phone   = formatPhone(c.phone);
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
      message: `SMS sent successfully`,
      data:    { sent, total: targets.length },
    });
  } catch (err) {
    console.error('BEEM ERROR (bulk):', err.response?.data || err.message);
    const status = err.statusCode || err.response?.status || 500;
    return res.status(status).json({ success: false, message: extractBeemError(err) });
  }
}

module.exports = { sendReminder, sendBulkReminders };
