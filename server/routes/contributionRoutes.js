const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getAll, getById, create, createBulk, update, remove,
  hide, restore, getHidden, permanentDelete,
} = require('../controllers/contributionController');

router.use(auth);

router.get('/hidden', getHidden);   // must come before /:id
router.get('/', getAll);
router.post('/', create);
router.post('/bulk', createBulk);   // must come before /:id
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/:id/hide', hide);
router.post('/:id/restore', restore);
router.delete('/:id/permanent', permanentDelete);

module.exports = router;
