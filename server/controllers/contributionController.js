'use strict';

const Contribution = require('../models/Contribution');
const Contributor  = require('../models/Contributor');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { getIsolationFilter, canAccessContribution, canAccessEvent } = require('../utils/tenantHelpers');

async function getAll(req, res, next) {
  try {
    const { eventId, status, search } = req.query;
    const filter = getIsolationFilter(req);
    const contributions = await Contribution.findAll({ eventId, status, search, ...filter });
    return res.json({ success: true, data: { contributions, total: contributions.length } });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!canAccessContribution(req, contribution)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    return res.json({ success: true, data: contribution });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { event_id, contributor_name, phone, email, amount } = req.body;

    if (!event_id || !contributor_name || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [
          !event_id         && { field: 'event_id',         message: 'event_id is required' },
          !contributor_name && { field: 'contributor_name', message: 'contributor_name is required' },
          !amount           && { field: 'amount',           message: 'amount is required' },
        ].filter(Boolean),
      });
    }

    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found', errors: [] });
    }
    if (!canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    // Find or create a global contributor record (non-fatal if table missing)
    let contributorId = null;
    try {
      contributorId = await Contributor.findOrCreate({
        name:       contributor_name,
        phone:      phone  || null,
        email:      email  || null,
        created_by: req.user.userId,
      });
    } catch (err) {
      console.error('[create contribution] find-or-create contributor failed:', err.message);
    }

    const id = await Contribution.create({ event_id, contributor_id: contributorId, contributor_name, phone, email, amount });

    await Notification.create({
      user_id: event.organization_id,
      title: 'New Contribution Added',
      message: `${contributor_name} pledged ${parseFloat(amount).toLocaleString()} for event "${event.name}".`,
      type: 'contribution_added',
    });

    const contribution = await Contribution.findById(id);
    return res.status(201).json({ success: true, data: contribution });
  } catch (err) {
    next(err);
  }
}

async function createBulk(req, res, next) {
  try {
    const { contributor_name, phone, email, events } = req.body;

    if (!contributor_name || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [
          !contributor_name       && { field: 'contributor_name', message: 'contributor_name is required' },
          (!events || !events.length) && { field: 'events', message: 'At least one event is required' },
        ].filter(Boolean),
      });
    }

    for (const ev of events) {
      if (!ev.event_id || !ev.amount || parseFloat(ev.amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Each event assignment must have a valid event_id and amount > 0',
          errors: [],
        });
      }
    }

    // Resolve and access-check all events up front
    const resolvedEvents = [];
    for (const ev of events) {
      const event = await Event.findById(ev.event_id);
      if (!event) {
        return res.status(404).json({ success: false, message: `Event ${ev.event_id} not found`, errors: [] });
      }
      if (!canAccessEvent(req, event)) {
        return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
      }
      resolvedEvents.push({ event, amount: ev.amount });
    }

    // Find or create the contributor once
    let contributorId = null;
    try {
      contributorId = await Contributor.findOrCreate({
        name:       contributor_name,
        phone:      phone  || null,
        email:      email  || null,
        created_by: req.user.userId,
      });
    } catch (err) {
      console.error('[createBulk] find-or-create contributor failed:', err.message);
    }

    // Create one contribution per event
    const created = [];
    for (const { event, amount } of resolvedEvents) {
      const id = await Contribution.create({
        event_id:         event.id,
        contributor_id:   contributorId,
        contributor_name,
        phone:            phone  || null,
        email:            email  || null,
        amount,
      });

      await Notification.create({
        user_id: event.organization_id,
        title:   'New Contribution Added',
        message: `${contributor_name} pledged ${parseFloat(amount).toLocaleString()} for event "${event.name}".`,
        type:    'contribution_added',
      });

      created.push(id);
    }

    return res.status(201).json({ success: true, data: { created: created.length } });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!canAccessContribution(req, contribution)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const { contributor_name, phone, email, amount } = req.body;
    const fields = {};
    if (contributor_name !== undefined) fields.contributor_name = contributor_name;
    if (phone            !== undefined) fields.phone            = phone;
    if (email            !== undefined) fields.email            = email;
    if (amount           !== undefined) fields.amount           = amount;

    await Contribution.update(req.params.id, fields);
    if (amount !== undefined) await Contribution.updatePaymentStatus(req.params.id);

    const updated = await Contribution.findById(req.params.id);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!canAccessContribution(req, contribution)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await Contribution.delete(req.params.id);
    return res.json({ success: true, data: { message: 'Contribution deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

// ── Hide (soft delete) ────────────────────────────────────────────────────────
async function hide(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!canAccessContribution(req, contribution)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await Contribution.hide(req.params.id);
    return res.json({ success: true, data: { message: 'Contribution moved to hidden' } });
  } catch (err) {
    next(err);
  }
}

// ── Restore ───────────────────────────────────────────────────────────────────
async function restore(req, res, next) {
  try {
    if (req.user.role === 'client_user') {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!canAccessContribution(req, contribution)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await Contribution.restore(req.params.id);
    return res.json({ success: true, data: { message: 'Contribution restored' } });
  } catch (err) {
    next(err);
  }
}

// ── Get hidden ────────────────────────────────────────────────────────────────
async function getHidden(req, res, next) {
  try {
    if (req.user.role === 'client_user') {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    const filter = getIsolationFilter(req);
    const contributions = await Contribution.findHidden(filter);
    return res.json({ success: true, data: { contributions, total: contributions.length } });
  } catch (err) {
    next(err);
  }
}

// ── Permanent delete ──────────────────────────────────────────────────────────
async function permanentDelete(req, res, next) {
  try {
    if (req.user.role === 'client_user') {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) {
      return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });
    }
    if (!canAccessContribution(req, contribution)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await Contribution.delete(req.params.id);
    return res.json({ success: true, data: { message: 'Contribution permanently deleted' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, createBulk, update, remove, hide, restore, getHidden, permanentDelete };
