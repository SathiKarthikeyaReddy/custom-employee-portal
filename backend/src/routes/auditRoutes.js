const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const authenticate = require('../middlewares/authenticate');
const { requirePermission } = require('../middlewares/authorize');

router.use(authenticate);
router.use(requirePermission('admin.audit.view'));

router.get('/', auditController.list);

module.exports = router;
