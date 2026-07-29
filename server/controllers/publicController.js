'use strict';

const Contribution   = require('../models/Contribution');
const PaymentRequest = require('../models/PaymentRequest');
const Notification   = require('../models/Notification');
const Setting        = require('../models/Setting');
const User           = require('../models/User');
const { buildReceiptPdf } = require('../utils/receiptPdf');
const { resolveBranding, fetchImageBuffer } = require('../utils/reportBranding');

const INVALID_LINK_MESSAGE = 'This contribution link is invalid or has expired.';

// ── GET /api/public/contributions/:token ────────────────────────────
// No auth. Returns only the fields the contributor is allowed to see —
// never a database id, event_id, phone/email, or organization_id.
async function getContribution(req, res, next) {
  try {
    const contribution = await Contribution.findByToken(req.params.token);
    if (!contribution) {
      return res.status(404).json({ success: false, message: INVALID_LINK_MESSAGE, errors: [] });
    }

    const targetAmount = parseFloat(contribution.amount) || 0;
    const paidAmount   = parseFloat(contribution.paid_amount) || 0;
    const balance      = Math.max(targetAmount - paidAmount, 0);
    const progress      = targetAmount > 0 ? Math.min(100, Math.round((paidAmount / targetAmount) * 100)) : 0;

    const [paymentMethods, latestRequest, branding] = await Promise.all([
      Setting.getPaymentMethods(contribution),
      PaymentRequest.findLatestByContribution(contribution.id),
      resolveBranding(contribution.organization_id),
    ]);

    return res.json({
      success: true,
      data: {
        event_name: contribution.event_name,
        contributor_name: contribution.contributor_name,
        target_amount: targetAmount,
        paid_amount: paidAmount,
        balance,
        progress_percent: progress,
        status: contribution.status,
        updated_at: contribution.updated_at,
        payment_methods: paymentMethods,
        organization_name: branding.organizationName,
        logo_url: branding.logoUrl,
        latest_request: latestRequest
          ? { status: latestRequest.status, submitted_at: latestRequest.submitted_at }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/public/contributions/:token/payment-request ──────────
async function submitPaymentRequest(req, res, next) {
  try {
    const contribution = await Contribution.findByToken(req.params.token);
    if (!contribution) {
      return res.status(404).json({ success: false, message: INVALID_LINK_MESSAGE, errors: [] });
    }

    const pending = await PaymentRequest.findLatestByContribution(contribution.id);
    if (pending && pending.status === 'pending') {
      return res.status(409).json({
        success: false,
        message: 'A payment confirmation is already pending review. Please wait for the organizer to verify it.',
        errors: [],
      });
    }

    const { submitted_amount, reference_number, message } = req.body;

    let parsedAmount = null;
    if (submitted_amount !== undefined && submitted_amount !== null && submitted_amount !== '') {
      parsedAmount = parseFloat(submitted_amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Amount must be a positive number', errors: [] });
      }
    }

    await PaymentRequest.create({
      contribution_id: contribution.id,
      submitted_amount: parsedAmount || 0,
      reference_number: reference_number || null,
      message: message || null,
    });

    const amountLabel = parsedAmount
      ? `TZS ${parsedAmount.toLocaleString('en', { maximumFractionDigits: 0 })}`
      : 'an unspecified amount';

    const targets = new Set([contribution.organization_id, contribution.event_created_by]);
    for (const userId of targets) {
      await Notification.create({
        user_id: userId,
        title: 'New Payment Request',
        message: `${contribution.contributor_name.toUpperCase()} — ${contribution.event_name}\nSubmitted ${amountLabel} — Pending Approval`,
        type: 'payment_verification_requested',
      });
    }

    return res.status(201).json({ success: true, message: 'Thank you! The organizer has been notified and will verify your payment.' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/public/contributions/:token/receipt ────────────────────
// No auth. Only ever serves a receipt for an approved request on this
// contribution — pending/rejected/missing all get the same generic error.
async function downloadReceipt(req, res, next) {
  try {
    const contribution = await Contribution.findByToken(req.params.token);
    if (!contribution) {
      return res.status(404).json({ success: false, message: INVALID_LINK_MESSAGE, errors: [] });
    }

    const latestRequest = await PaymentRequest.findLatestByContribution(contribution.id);
    if (!latestRequest || latestRequest.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'No approved payment found for this contribution yet.', errors: [] });
    }

    const approver = latestRequest.reviewed_by ? await User.findById(latestRequest.reviewed_by) : null;
    const branding = await resolveBranding(contribution.organization_id);
    const logoBuffer = await fetchImageBuffer(branding.logoUrl);

    await buildReceiptPdf({
      contribution,
      paymentRequest: latestRequest,
      approverName: approver?.name,
      logoBuffer,
      organizationName: branding.organizationName,
      res,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getContribution, submitPaymentRequest, downloadReceipt };
