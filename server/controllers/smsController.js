const Contribution = require('../models/Contribution');

// ======================================================
// Africa's Talking SMS Setup
// ======================================================
function getATSms() {
  const AfricasTalking = require('africastalking');

  const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  });

  return at.SMS;
}

// ======================================================
// FORMAT PHONE (TZ format 255xxxxxxxxx)
// ======================================================
function formatPhone(phone) {
  if (!phone) return null;

  let cleaned = phone.replace(/\s+/g, '');

  if (cleaned.startsWith('0')) {
    return '255' + cleaned.substring(1);
  }

  if (!cleaned.startsWith('255')) {
    return '255' + cleaned;
  }

  return cleaned;
}

// ======================================================
// FORMAT MONEY
// ======================================================
function formatCurrency(amount) {
  return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', {
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
    console.error("❌ SMS ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
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
    console.error("❌ BULK ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
}

module.exports = {
  sendReminder,
  sendBulkReminders,
};