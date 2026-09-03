const auditModel = require('../models/auditModel');

const requirePermission = (permissionKey) => {
  return async (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.permissions)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!req.user.permissions.includes(permissionKey)) {
      // Write audit log entry for access denial
      try {
        await auditModel.createLog({
          userId: req.user.id || null,
          userEmail: req.user.email || 'unknown',
          action: 'ACCESS_DENIED',
          detail: `Missing permission: ${permissionKey}`,
          ipAddress: req.ip || req.connection.remoteAddress || '',
        });
      } catch (logErr) {
        console.error('Failed to log ACCESS_DENIED audit entry:', logErr.message);
      }

      return res.status(403).json({
        message: 'Access Denied: Insufficient Permissions',
        details: { requiredPermission: permissionKey },
      });
    }

    next();
  };
};

module.exports = {
  requirePermission,
};
