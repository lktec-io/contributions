const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAll, getById, create, update, remove } = require('../controllers/contributionController');

router.use(auth);

router.get('/', getAll);
router.post('/', create);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
