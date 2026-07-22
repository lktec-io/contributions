const Payment = require('../models/Payment');
const Contribution = require('../models/Contribution');
const Notification = require('../models/Notification');
const { canAccessContribution } = require('../utils/tenantHelpers');

// ── recordPayment ────────────────────────────────────────────
// Single source of truth for crediting a payment against a contribution:
// insert into payment_history, recompute paid_amount/status, notify.
// Used by the manual "Record Payment" flow (create() below) and by the
// Payment Requests approval flow (paymentRequestController.js).
async function recordPayment({ contribution, amount, note, recordedBy }) {
  await Payment.create({
    contribution_id: contribution.id,
    amount,
    note: note || null,
    recorded_by: recordedBy,
  });

  await Contribution.updatePaymentStatus(contribution.id);

  await Notification.create({
    user_id: contribution.organization_id,
    title: 'Payment Recorded',
    message: `Payment of ${amount.toLocaleString()} recorded for ${contribution.contributor_name}.`,
    type: 'payment_recorded',
  });

  return Contribution.findById(contribution.id);
}

async function create(req, res, next) {
  try {
    const { contribution_id, amount, note } = req.body;

    if (!contribution_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [
          !contribution_id && { field: 'contribution_id', message: 'contribution_id is required' },
          !amount          && { field: 'amount',          message: 'amount is required' },
        ].filter(Boolean),
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number', errors: [] });
    }

    const contribution = await Contribution.findById(contribution_id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const updatedContribution = await recordPayment({
      contribution,
      amount: parsedAmount,
      note,
      recordedBy: req.user.userId,
    });

    return res.status(201).json({ success: true, data: updatedContribution });
  } catch (err) {
    next(err);
  }
}

async function getByContribution(req, res, next) {
  try {
    const { contributionId } = req.params;
    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    const payments = await Payment.findByContribution(contributionId);
    return res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getByContribution, recordPayment };
