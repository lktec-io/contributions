const Contribution = require('../models/Contribution');

/**
 * Africa's Talking SMS integration.
 * Requires env: AT_API_KEY, AT_USERNAME, AT_SENDER_ID (optional)
 */
function getATSms() {
  const AfricasTalking = require('africastalking');
  const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
  });
  return at.SMS;
}

function formatCurrency(amount) {
  return `KES ${parseFloat(amount || 0).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * POST /api/sms/reminder/:id
 * Send a payment reminder SMS to a single contributor.
 */
async function sendReminder(req, res, next) {
  try {
    const { id } = req.params;
    const contribution = await Contribution.findById(id);

    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contributor not found' });
    }

    // Tenant isolation: client users can only message their own contributors
    if (req.user.role === 'client_user' && contribution.organization_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!contribution.phone) {
      return res.status(400).json({ success: false, message: 'No phone number registered for this contributor' });
    }

    if (contribution.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Contributor has already paid in full' });
    }

    const pledged  = parseFloat(contribution.amount);
    const paid     = parseFloat(contribution.paid_amount);
    const balance  = pledged - paid;

    const message =
      `Hello ${contribution.contributor_name},\n` +
      `You pledged: ${formatCurrency(pledged)}\n` +
      `You paid: ${formatCurrency(paid)}\n` +
      `Balance: ${formatCurrency(balance)}\n` +
      `Please complete your contribution. Thank you!`;

    const sms = getATSms();
    const sendOpts = {
      to: [contribution.phone],
      message,
    };
    if (process.env.AT_SENDER_ID) sendOpts.from = process.env.AT_SENDER_ID;

    await sms.send(sendOpts);

    res.json({ success: true, message: `SMS reminder sent to ${contribution.contributor_name}` });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/sms/bulk-reminder
 * Send reminders to all unpaid/partial contributors for an event.
 */
async function sendBulkReminders(req, res, next) {
  try {
    const { eventId } = req.body;
    const organizationId = req.user.role === 'client_user' ? req.user.userId : null;

    const contributions = await Contribution.findAll({
      eventId: eventId || undefined,
      organizationId,
    });

    const targets = contributions.filter(c => c.status !== 'paid' && c.phone);

    if (!targets.length) {
      return res.status(400).json({ success: false, message: 'No unpaid contributors with phone numbers found' });
    }

    const sms = getATSms();
    const sendPromises = targets.map(c => {
      const pledged = parseFloat(c.amount);
      const paid    = parseFloat(c.paid_amount);
      const balance = pledged - paid;
      const message =
        `Hello ${c.contributor_name},\n` +
        `You pledged: ${formatCurrency(pledged)}\n` +
        `You paid: ${formatCurrency(paid)}\n` +
        `Balance: ${formatCurrency(balance)}\n` +
        `Please complete your contribution. Thank you!`;

      const opts = { to: [c.phone], message };
      if (process.env.AT_SENDER_ID) opts.from = process.env.AT_SENDER_ID;
      return sms.send(opts).catch(() => null); // don't fail entire batch on one error
    });

    await Promise.all(sendPromises);

    res.json({
      success: true,
      message: `SMS reminders sent to ${targets.length} contributor(s)`,
      count: targets.length,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendReminder, sendBulkReminders };
