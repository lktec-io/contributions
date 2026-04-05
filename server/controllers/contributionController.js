const Contribution = require('../models/Contribution');
const Event = require('../models/Event');
const Notification = require('../models/Notification');

async function getAll(req, res, next) {
  try {
    const organizationId = req.user.role === 'client_user' ? req.user.userId : null;
    const { eventId, status, search } = req.query;
    const contributions = await Contribution.findAll({ eventId, status, search, organizationId });
    return res.json({ success: true, data: { contributions, total: contributions.length } });
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });

    if (req.user.role === 'client_user' && contribution.organization_id !== req.user.userId) {
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
          !event_id && { field: 'event_id', message: 'event_id is required' },
          !contributor_name && { field: 'contributor_name', message: 'contributor_name is required' },
          !amount && { field: 'amount', message: 'amount is required' },
        ].filter(Boolean),
      });
    }

    // Verify event exists and belongs to this user (if client_user)
    const event = await Event.findById(event_id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found', errors: [] });

    if (req.user.role === 'client_user' && event.organization_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const id = await Contribution.create({ event_id, contributor_name, phone, email, amount });

    // Notify event owner
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

async function update(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });

    if (req.user.role === 'client_user' && contribution.organization_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    const { contributor_name, phone, email, amount } = req.body;
    const fields = {};
    if (contributor_name !== undefined) fields.contributor_name = contributor_name;
    if (phone !== undefined) fields.phone = phone;
    if (email !== undefined) fields.email = email;
    if (amount !== undefined) fields.amount = amount;

    // status is never set manually
    await Contribution.update(req.params.id, fields);

    // If amount changed, recalculate status
    if (amount !== undefined) {
      await Contribution.updatePaymentStatus(req.params.id);
    }

    const updated = await Contribution.findById(req.params.id);
    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const contribution = await Contribution.findById(req.params.id);
    if (!contribution) return res.status(404).json({ success: false, message: 'Contribution not found', errors: [] });

    if (req.user.role === 'client_user' && contribution.organization_id !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied', errors: [] });
    }

    await Contribution.delete(req.params.id);
    return res.json({ success: true, data: { message: 'Contribution deleted successfully' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getById, create, update, remove };
