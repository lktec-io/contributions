const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  search, getAll,
  listMembers, createMember, updateMember, deleteMember,
} = require('../controllers/contributorController');

router.use(auth);

// Custom SMS members — declared before '/' and '/:id'-style paths
router.get('/members',        listMembers);
router.post('/members',       createMember);
router.put('/members/:id',    updateMember);
router.delete('/members/:id', deleteMember);

router.get('/search', search);
router.get('/',       getAll);

module.exports = router;
