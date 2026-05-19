'use strict';

const Event        = require('../models/Event');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const { getIsolationFilter, canAccessEvent } = require('../utils/tenantHelpers');

async function attachAssignments(events) {
  if (!events.length) return events;
  const ids = events.map(e => e.id);
  const map = await Event.getAssignmentsForEvents(ids);
  return events.map(e => ({ ...e, assignments: map[e.id] || [] }));
}

async function validateAdminAssignments(adminUserId, assignments) {
  for (const a of assignments) {
    const u = await User.findById(a.user_id);
    if (!u) return `User ${a.user_id} not found`;
    if (u.created_by !== adminUserId) return 'You can only assign events to users you manage';
  }
  return null;
}

// ── GET /events ───────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const filter = getIsolationFilter(req);
    const events = await Event.findAll(filter);
    const withAssignments = await attachAssignments(events);
    return res.json({ success: true, data: withAssignments });
  } catch (err) {
    next(err);
  }
}

// ── GET /events/:id ───────────────────────────────────────────
async function getById(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found', errors: [] });
    }

    let hasAccess = canAccessEvent(req, event);
    if (!hasAccess && req.user.role === 'client_user') {
      hasAccess = await Event.isAssigned(req.params.id, req.user.userId);
    }
    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const assignments = await Event.getAssignments(req.params.id);
    return res.json({ success: true, data: { ...event, assignments } });
  } catch (err) {
    next(err);
  }
}

// ── POST /events ──────────────────────────────────────────────
async function create(req, res, next) {
  try {
    const { name, description, assignments } = req.body;

    const errors = [];
    if (!name?.trim())        errors.push({ field: 'name',        message: 'Event name is required' });
    if (!assignments?.length) errors.push({ field: 'assignments', message: 'At least one user must be assigned' });
    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    for (const a of assignments) {
      const amt = parseFloat(a.target_amount);
      if (!a.user_id || isNaN(amt) || amt < 0) {
        return res.status(400).json({ success: false, message: 'Each assignment must have a valid user_id and target_amount', errors: [] });
      }
    }

    if (req.user.role === 'admin') {
      const errMsg = await validateAdminAssignments(req.user.userId, assignments);
      if (errMsg) return res.status(403).json({ success: false, message: errMsg, errors: [] });
    }

    // Create one independent event row per assigned user so each user has
    // their own isolated copy (organization_id = that user's id).
    const createdIds = [];
    for (const a of assignments) {
      const id = await Event.create({
        name:            name.trim(),
        description:     description || null,
        target_amount:   parseFloat(a.target_amount) || 0,
        organization_id: a.user_id,
        created_by:      req.user.userId,
      });
      await Event.setAssignments(id, [a]);
      createdIds.push(id);

      await Notification.create({
        user_id: a.user_id,
        title:   'New Event Assigned',
        message: `Event "${name.trim()}" has been assigned to you.`,
        type:    'event_assigned',
      });
    }

    return res.status(201).json({ success: true, data: { created: createdIds.length, eventIds: createdIds } });
  } catch (err) {
    next(err);
  }
}

// ── PUT /events/:id ───────────────────────────────────────────
async function update(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found', errors: [] });
    }
    if (!canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const { name, description, assignments } = req.body;

    if (assignments !== undefined) {
      if (!assignments.length) {
        return res.status(400).json({ success: false, message: 'At least one user must be assigned', errors: [] });
      }
      for (const a of assignments) {
        const amt = parseFloat(a.target_amount);
        if (!a.user_id || isNaN(amt) || amt < 0) {
          return res.status(400).json({ success: false, message: 'Each assignment must have a valid user_id and target_amount', errors: [] });
        }
      }
      if (req.user.role === 'admin') {
        const errMsg = await validateAdminAssignments(req.user.userId, assignments);
        if (errMsg) return res.status(403).json({ success: false, message: errMsg, errors: [] });
      }
    }

    const fields = {};
    if (name        !== undefined) fields.name        = name.trim();
    if (description !== undefined) fields.description = description || null;
    if (assignments?.length) {
      fields.organization_id = assignments[0].user_id;
      fields.target_amount   = assignments.reduce((s, a) => s + (parseFloat(a.target_amount) || 0), 0);
    }

    await Event.update(req.params.id, fields);

    if (assignments?.length) {
      await Event.setAssignments(req.params.id, assignments);
    }

    const updated      = await Event.findById(req.params.id);
    const updatedAssignments = await Event.getAssignments(req.params.id);
    return res.json({ success: true, data: { ...updated, assignments: updatedAssignments } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /events/:id ────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found', errors: [] });
    }
    if (!canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    await Event.delete(req.params.id);
    return res.json({ success: true, data: { message: 'Event deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove };
