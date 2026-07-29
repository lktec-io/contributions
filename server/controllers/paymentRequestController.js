'use strict';

const PaymentRequest = require('../models/PaymentRequest');
const Contribution   = require('../models/Contribution');
const Notification   = require('../models/Notification');
const User           = require('../models/User');
const { recordPayment } = require('./paymentController');
const { getIsolationFilter, canAccessContribution } = require('../utils/tenantHelpers');
const { buildReceiptPdf } = require('../utils/receiptPdf');
const { resolveBranding, fetchImageBuffer } = require('../utils/reportBranding');

// ── GET /api/payment-requests ───────────────────────────────────────
async function list(req, res, next) {
  try {
    const filter = getIsolationFilter(req);
    if (req.query.status) filter.status = req.query.status;

    const requests = await PaymentRequest.findAllForScope(filter);
    return res.json({ success: true, data: requests });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/payment-requests/:id/approve ──────────────────────────
async function approve(req, res, next) {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Payment request not found', errors: [] });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has already been reviewed', errors: [] });
    }

    const contribution = await Contribution.findById(request.contribution_id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const note = request.reference_number
      ? `Verified from contributor payment request (ref: ${request.reference_number})`
      : 'Verified from contributor payment request';

    const updatedContribution = await recordPayment({
      contribution,
      amount: parseFloat(request.submitted_amount),
      note,
      recordedBy: req.user.userId,
    });

    await PaymentRequest.approve(request.id, req.user.userId);

    return res.json({ success: true, data: updatedContribution });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/payment-requests/:id/reject ───────────────────────────
async function reject(req, res, next) {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Payment request not found', errors: [] });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'This request has already been reviewed', errors: [] });
    }

    const contribution = await Contribution.findById(request.contribution_id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    await PaymentRequest.reject(request.id, req.user.userId);

    // Only notification path for a rejection — approval already gets one via recordPayment.
    const targets = new Set([contribution.organization_id, contribution.event_created_by]);
    for (const userId of targets) {
      await Notification.create({
        user_id: userId,
        title: 'Payment Request Rejected',
        message: `Payment request from ${contribution.contributor_name} was rejected.`,
        type: 'payment_verification_rejected',
      });
    }

    return res.json({ success: true, message: 'Payment request rejected' });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/payment-requests/:id ────────────────────────────────
// Approved payment history is never deletable — this only removes the
// payment_requests row itself (never touches payment_history/contributions).
async function remove(req, res, next) {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Payment request not found', errors: [] });
    }
    if (request.status === 'approved') {
      return res.status(400).json({ success: false, message: 'Approved payment requests cannot be deleted', errors: [] });
    }

    const contribution = await Contribution.findById(request.contribution_id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    await PaymentRequest.remove(request.id);

    return res.json({ success: true, message: 'Payment request deleted' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/payment-requests/:id/receipt ───────────────────────────
async function downloadReceipt(req, res, next) {
  try {
    const request = await PaymentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Payment request not found', errors: [] });
    }
    if (request.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Receipt is only available for approved requests', errors: [] });
    }

    const contribution = await Contribution.findById(request.contribution_id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!(await canAccessContribution(req, contribution))) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const approver = request.reviewed_by ? await User.findById(request.reviewed_by) : null;
    const branding = await resolveBranding(contribution.organization_id);
    const logoBuffer = await fetchImageBuffer(branding.logoUrl);

    await buildReceiptPdf({
      contribution,
      paymentRequest: request,
      approverName: approver?.name,
      logoBuffer,
      organizationName: branding.organizationName,
      res,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, approve, reject, remove, downloadReceipt };
