const Payment = require('../models/Payment');
const Contribution = require('../models/Contribution');
const Notification = require('../models/Notification');

async function create(req, res, next) {
  try {
    const { contribution_id, amount, note } = req.body;

    if (!contribution_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [
          !contribution_id && { field: 'contribution_id', message: 'contribution_id is required' },
          !amount && { field: 'amount', message: 'amount is required' },
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

    // Verify access for client_user
    if (req.user.role === 'client_user' && contribution.organization_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    // Insert payment record
    await Payment.create({
      contribution_id,
      amount: parsedAmount,
      note: note || null,
      recorded_by: req.user.userId,
    });

    // Recalculate contribution status
    const updated = await Contribution.updatePaymentStatus(contribution_id);

    // Notify event owner
    await Notification.create({
      user_id: contribution.organization_id,
      title: 'Payment Recorded',
      message: `Payment of ${parsedAmount.toLocaleString()} recorded for ${contribution.contributor_name}.`,
      type: 'payment_recorded',
    });

    const updatedContribution = await Contribution.findById(contribution_id);
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

    if (req.user.role === 'client_user' && contribution.organization_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const payments = await Payment.findByContribution(contributionId);
    return res.json({ success: true, data: payments });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, getByContribution };
