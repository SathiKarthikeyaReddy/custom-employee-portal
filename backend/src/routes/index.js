const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const roleRoutes = require('./roleRoutes');
const permissionRoutes = require('./permissionRoutes');
const auditRoutes = require('./auditRoutes');
const zohoRoutes = require('./zohoRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/audit', auditRoutes);
router.use('/zoho', zohoRoutes);

module.exports = router;
