const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAll, getUnreadCount, markRead, markAllRead, deleteOne, deleteAll } = require('../controllers/notificationController');

router.use(auth);

router.get('/', getAll);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllRead);
router.put('/:id/read', markRead);
router.delete('/', deleteAll);
router.delete('/:id', deleteOne);

module.exports = router;
