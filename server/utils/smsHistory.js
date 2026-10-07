'use strict';

const pool = require('../config/db');

/*  Best-effort message-level logging for the SMS Logs report.

    This is additive only. It never throws, never changes a send outcome, and
    never writes to sms_logs — that table remains the cooldown / duplicate
    ledger and its behaviour is untouched.                                   */

const SENT   = 'sent';
const FAILED = 'failed';

/**
 * Records one SMS attempt. Fire-and-forget: any error is swallowed and logged
 * to the console, exactly like the existing sms_logs writes.
 *
 * @param {object} entry
 * @param {number} entry.userId        sender (owns the row)
 * @param {number|null} [entry.recipientId]
 * @param {string} [entry.recipientName]
 * @param {string} [entry.phone]
 * @param {string} [entry.eventName]
 * @param {string} entry.type          same vocabulary as sms_logs.type
 * @param {string} entry.status        'sent' | 'failed'
 * @param {string} [entry.message]     the final rendered body
 * @param {string} [entry.errorText]   provider/API error, failures only
 */
async function recordSmsHistory(entry) {
  try {
    await pool.query(
      `INSERT INTO sms_history
         (user_id, recipient_id, recipient_name, phone, event_name, type, status, message, error_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.recipientId ?? null,
        entry.recipientName ? String(entry.recipientName).slice(0, 255) : null,
        entry.phone ? String(entry.phone).slice(0, 32) : null,
        entry.eventName ? String(entry.eventName).slice(0, 255) : null,
        entry.type,
        entry.status === FAILED ? FAILED : SENT,
        entry.message ?? null,
        entry.errorText ? String(entry.errorText).slice(0, 2000) : null,
      ],
    );
  } catch (err) {
    console.error('[sms-history] Failed to record attempt:', err.message);
  }
}

/** Normalises whatever a provider/axios error carries into readable text. */
function describeSmsError(err) {
  const data = err?.response?.data;
  if (data) {
    if (typeof data === 'string') return data.slice(0, 2000);
    try { return JSON.stringify(data).slice(0, 2000); } catch { /* fall through */ }
  }
  return String(err?.message || 'Unknown error').slice(0, 2000);
}

module.exports = { recordSmsHistory, describeSmsError, SENT, FAILED };
