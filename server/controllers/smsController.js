const Contribution = require('../models/Contribution');
const { getIsolationFilter, canAccessContribution } = require('../utils/tenantHelpers');

function getATSms() {
  const apiKey   = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    const missing = [!apiKey && 'AT_API_KEY', !username && 'AT_USERNAME'].filter(Boolean).join(', ');
    const err = new Error(`SMS service not configured — missing env vars: ${missing}`);
    err.statusCode = 503;
    throw err;
  }
  const AfricasTalking = require('africastalking');
  return AfricasTalking({ apiKey, username }).SMS;
}

function formatPhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-().]/g, '');
  if (cleaned.startsWith('+'))                            return cleaned;
  if (cleaned.startsWith('255') && cleaned.length >= 12)  return '+' + cleaned;
  if (cleaned.startsWith('0'))                            return '+255' + cleaned.substring(1);
  return '+255' + cleaned;
}

function extractError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') return err.message || err.errorMessage || err.description || JSON.stringify(err);
  return String(err);
}

function formatCurrency(amount) {
  return `TZS ${parseFloat(amount || 0).toLocaleString('en-TZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function sendReminder(req, res) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) return res.status(404).json({ success: false, message: 'Contributor not found' });
    if (!canAccessContribution(req, contribution)) return res.status(403).json({ success: false, message: 'Access denied' });
    if (!contribution.phone) return res.status(400).json({ success: false, message: 'No phone number found' });
    if (contribution.status === 'paid') return res.status(400).json({ success: false, message: 'Already paid' });

    const phone   = formatPhone(contribution.phone);
    const pledged = parseFloat(contribution.amount)      || 0;
    const paid    = parseFloat(contribution.paid_amount) || 0;
    const message =
      `Hello ${contribution.contributor_name},\n` +
      `You pledged: ${formatCurrency(pledged)}\n` +
      `You paid: ${formatCurrency(paid)}\n` +
      `Balance: ${formatCurrency(pledged - paid)}\n` +
      `Please complete your contribution.\nThank you.`;

    const sms = getATSms();
    const options = { to: [phone], message };
    if (process.env.AT_SENDER_ID) options.from = process.env.AT_SENDER_ID;

    await sms.send(options);
    return res.json({ success: true, message: `SMS sent to ${contribution.contributor_name}` });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error('❌ SMS ERROR:', extractError(err));
    return res.status(status).json({ success: false, message: extractError(err) });
  }
}

async function sendBulkReminders(req, res) {
  try {
    const { eventId } = req.body;
    const filter = getIsolationFilter(req);
    if (eventId) filter.eventId = eventId;

    const contributions = await Contribution.findAll(filter);
    const targets = contributions.filter(c => c.status !== 'paid' && c.phone);

    if (!targets.length) return res.status(400).json({ success: false, message: 'No valid contributors' });

    const sms = getATSms();
    for (const c of targets) {
      try {
        const pledged = parseFloat(c.amount)      || 0;
        const paid    = parseFloat(c.paid_amount) || 0;
        const options = {
          to:      [formatPhone(c.phone)],
          message: `Hello ${c.contributor_name},\nBalance: ${formatCurrency(pledged - paid)}\nPlease complete your contribution.`,
        };
        if (process.env.AT_SENDER_ID) options.from = process.env.AT_SENDER_ID;
        await sms.send(options);
      } catch (err) {
        console.error('❌ BULK SMS (skipped):', extractError(err));
      }
    }

    return res.json({ success: true, message: `Sent ${targets.length} SMS` });
  } catch (err) {
    const status = err.statusCode || 500;
    console.error('❌ BULK ERROR:', extractError(err));
    return res.status(status).json({ success: false, message: extractError(err) });
  }
}

module.exports = { sendReminder, sendBulkReminders };
