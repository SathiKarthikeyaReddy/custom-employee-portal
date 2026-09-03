const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authenticate = require('../middlewares/authenticate');
const { requirePermission } = require('../middlewares/authorize');

router.use(authenticate);
router.use(requirePermission('admin.users.manage'));

router.get('/', userController.list);
router.post('/', userController.create);
router.patch('/:id', userController.update);
router.post('/:id/reset-password', userController.resetPassword);
router.delete('/:id', userController.remove);

module.exports = router;
