const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authenticate = require('../middlewares/authenticate');
const { requirePermission } = require('../middlewares/authorize');

router.use(authenticate);
router.use(requirePermission('admin.roles.manage'));

router.get('/', roleController.list);
router.post('/', roleController.create);
router.patch('/:id', roleController.update);
router.delete('/:id', roleController.remove);

module.exports = router;
