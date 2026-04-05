const Notification = require('../models/Notification');

async function getAll(req, res, next) {
  try {
    const notifications = await Notification.findByUser(req.user.userId, 20);
    return res.json({ success: true, data: notifications });
  } catch (err) {
    next(err);
  }
}

async function getUnreadCount(req, res, next) {
  try {
    const count = await Notification.getUnreadCount(req.user.userId);
    return res.json({ success: true, data: { count: Number(count) } });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    await Notification.markRead(req.params.id, req.user.userId);
    return res.json({ success: true, data: { message: 'Notification marked as read' } });
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await Notification.markAllRead(req.user.userId);
    return res.json({ success: true, data: { message: 'All notifications marked as read' } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getUnreadCount, markRead, markAllRead };
