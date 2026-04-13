const Contribution = require('../models/Contribution');

// ======================================================
// Africa's Talking SMS Setup
// Validates credentials BEFORE calling AfricasTalking()
// so a missing .env produces a 503, not a crash 500.
// ======================================================
function getATSms() {
  const apiKey  = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    const missing = [!apiKey && 'AT_API_KEY', !username && 'AT_USERNAME']
      .filter(Boolean).join(', ');
    const err = new Error(`SMS service not configured — missing env vars: ${missing}`);
    err.statusCode = 503;
    throw err;
  }

  const AfricasTalking = require('africastalking');
  const at = AfricasTalking({ apiKey, username });
  return at.SMS;
}

// ======================================================
// FORMAT PHONE — E.164 with + prefix (required by AT SDK)
// google-libphonenumber rejects numbers without leading +
// ======================================================
function formatPhone(phone) {
  if (!phone) return null;

  // Strip whitespace and non-digit/+ chars
  let cleaned = phone.replace(/[\s\-().]/g, '');

  // Already E.164
  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Has country code but missing +  e.g. 255712345678
  if (cleaned.startsWith('255') && cleaned.length >= 12) {
    return '+' + cleaned;
  }

  // Local TZ format e.g. 0712345678
  if (cleaned.startsWith('0')) {
    return '+255' + cleaned.substring(1);
  }

  // Bare number — assume TZ
  return '+255' + cleaned;
}

// ======================================================
// EXTRACT A READABLE MESSAGE FROM ANY THROW VALUE
// AT SDK can reject with Error instances, plain objects,
// or raw strings — this handles all three.
// ======================================================
function extractError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  // Plain object from AT API (e.g. { SMSMessageData: {...} })
  if (typeof err === 'object') {
    return err.message
      || err.errorMessage
      || err.description
      || JSON.stringify(err);
  }
  return String(err);
}

// ======================================================
// FORMAT MONEY
// ======================================================
function formatCurrency(amount) {
  return `TZS ${parseFloat(amount || 0).toLocaleString('en-TZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ======================================================
// SEND SINGLE REMINDER
// ======================================================
async function sendReminder(req, res) {
  try {
    const { id } = req.params;

    const contribution = await Contribution.findById(id);

    if (!contribution) {
      return res.status(404).json({
        success: false,
        message: 'Contributor not found',
      });
    }

    if (!contribution.phone) {
      return res.status(400).json({
        success: false,
        message: 'No phone number found',
      });
    }

    if (contribution.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Already paid',
      });
    }

    // ✅ FIX PHONE FORMAT
    const phone = formatPhone(contribution.phone);

    const pledged = parseFloat(contribution.amount) || 0;
    const paid = parseFloat(contribution.paid_amount) || 0;
    const balance = pledged - paid;

    const message =
      `Hello ${contribution.contributor_name},\n` +
      `You pledged: ${formatCurrency(pledged)}\n` +
      `You paid: ${formatCurrency(paid)}\n` +
      `Balance: ${formatCurrency(balance)}\n` +
      `Please complete your contribution.\nThank you.`;

    const sms = getATSms();

    const options = {
      to: [phone],
      message,
    };

    // ⚠️ ONLY use sender ID if approved
    if (process.env.AT_SENDER_ID) {
      options.from = process.env.AT_SENDER_ID;
    }

    console.log("📤 Sending SMS to:", phone);
    console.log("📩 Message:", message);

    const response = await sms.send(options);

    console.log("✅ SMS RESPONSE:", JSON.stringify(response, null, 2));

    return res.json({
      success: true,
      message: `SMS sent to ${contribution.contributor_name}`,
    });

  } catch (err) {
    const status  = err.statusCode || 500;
    const message = extractError(err);
    console.error("❌ SMS ERROR:", message);
    return res.status(status).json({ success: false, message });
  }
}

// ======================================================
// SEND BULK REMINDERS
// ======================================================
async function sendBulkReminders(req, res) {
  try {
    const { eventId } = req.body;

    const contributions = await Contribution.findAll({
      eventId: eventId || undefined,
    });

    const targets = contributions.filter(
      (c) => c.status !== 'paid' && c.phone
    );

    if (!targets.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid contributors',
      });
    }

    const sms = getATSms();

    for (let c of targets) {
      try {
        const phone = formatPhone(c.phone);

        const pledged = parseFloat(c.amount) || 0;
        const paid = parseFloat(c.paid_amount) || 0;
        const balance = pledged - paid;

        const message =
          `Hello ${c.contributor_name},\n` +
          `Balance: ${formatCurrency(balance)}\n` +
          `Please complete your contribution.`;

        const options = {
          to: [phone],
          message,
        };

        if (process.env.AT_SENDER_ID) {
          options.from = process.env.AT_SENDER_ID;
        }

        await sms.send(options);

      } catch (err) {
        console.error("❌ BULK SMS ERROR (skipped):", err.message);
      }
    }

    return res.json({
      success: true,
      message: `Sent ${targets.length} SMS`,
    });

  } catch (err) {
    const status  = err.statusCode || 500;
    const message = extractError(err);
    console.error("❌ BULK ERROR:", message);
    return res.status(status).json({ success: false, message });
  }
}

module.exports = {
  sendReminder,
  sendBulkReminders,
};