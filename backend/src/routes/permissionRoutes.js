const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const authenticate = require('../middlewares/authenticate');
const { requirePermission } = require('../middlewares/authorize');

router.use(authenticate);
router.use(requirePermission('admin.permissions.manage'));

router.get('/', permissionController.list);
router.post('/assign', permissionController.assignToRole);

module.exports = router;
