const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  search, getAll,
  listMembers, createMember, updateMember, deleteMember,
} = require('../controllers/contributorController');
const uploadExcel = require('../middleware/uploadExcel');
const {
  exportMembersXLSX, exportMembersPDF, importMembers,
} = require('../controllers/memberReportController');

router.use(auth);

// Custom SMS members — declared before '/' and '/:id'-style paths
router.get('/members/export/xlsx', exportMembersXLSX);
router.get('/members/export/pdf',  exportMembersPDF);
router.post('/members/import',     uploadExcel, importMembers);

router.get('/members',        listMembers);
router.post('/members',       createMember);
router.put('/members/:id',    updateMember);
router.delete('/members/:id', deleteMember);

router.get('/search', search);
router.get('/',       getAll);

module.exports = router;
