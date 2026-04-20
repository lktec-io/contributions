const Event = require('../models/Event');
const Notification = require('../models/Notification');
const { getIsolationFilter, canAccessEvent } = require('../utils/tenantHelpers');

async function getAll(req, res, next) {
  try {
    const filter = getIsolationFilter(req);
    const events = await Event.findAll(filter);
    return res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found', errors: [] });
    }
    if (!canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }
    return res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, description, target_amount, organization_id } = req.body;

    if (!name || !organization_id) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [
          !name            && { field: 'name',            message: 'name is required' },
          !organization_id && { field: 'organization_id', message: 'organization_id is required' },
        ].filter(Boolean),
      });
    }

    // admin can only assign events to client_users they created.
    // super_admin can assign to any client_user.
    if (req.user.role === 'admin') {
      const User = require('../models/User');
      const assignedUser = await User.findById(organization_id);
      if (!assignedUser) {
        return res.status(404).json({ success: false, message: 'Assigned user not found', errors: [] });
      }
      if (assignedUser.created_by !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only assign events to users you manage',
          errors: [],
        });
      }
    }

    const id = await Event.create({
      name,
      description,
      target_amount: target_amount || 0,
      organization_id,
      created_by: req.user.userId,
    });

    await Notification.create({
      user_id: organization_id,
      title: 'New Event Assigned',
      message: `Event "${name}" has been assigned to you.`,
      type: 'event_assigned',
    });

    const event = await Event.findById(id);
    return res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found', errors: [] });
    }
    if (!canAccessEvent(req, event)) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const { name, description, target_amount, organization_id } = req.body;
    const fields = {};
    if (name            !== undefined) fields.name            = name;
    if (description     !== undefined) fields.description     = description;
    if (target_amount   !== undefined) fields.target_amount   = target_amount;
    if (organization_id !== undefined) fields.organization_id = organization_id;

    await Event.update(req.params.id, fields);
    const updated = await Event.findById(req.params.id);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

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
