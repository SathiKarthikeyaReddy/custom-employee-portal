const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const zohoAppModel = require('../models/zohoAppModel');
const zohoService = require('../services/zohoService');
const auditModel = require('../models/auditModel');

const getMyApps = asyncHandler(async (req, res) => {
  const permissions = req.user && req.user.permissions ? req.user.permissions : [];
  const result = await zohoService.getAuthorizedApps(permissions);
  return res.status(200).json(result);
});

const open = asyncHandler(async (req, res) => {
  const { appKey } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  const app = await zohoAppModel.findByKey(appKey);
  if (!app) {
    throw new ApiError(404, `Zoho application '${appKey}' not found`);
  }

  const userPermissions = req.user && Array.isArray(req.user.permissions) ? req.user.permissions : [];
  if (!userPermissions.includes(app.permission_key)) {
    await auditModel.createLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'ACCESS_DENIED',
      detail: `Attempted to open Zoho app '${appKey}' without permission '${app.permission_key}'`,
      ipAddress,
    });
    throw new ApiError(403, 'Access Denied: Insufficient Permissions', {
      requiredPermission: app.permission_key,
    });
  }

  if (!app.is_provisioned) {
    throw new ApiError(409, 'This Zoho application is not yet provisioned');
  }

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ZOHO_APP_OPENED',
    detail: appKey,
    ipAddress,
  });

  return res.status(200).json({ redirectUrl: app.base_url });
});

const proxy = asyncHandler(async (req, res) => {
  const { appKey } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  const app = await zohoAppModel.findByKey(appKey);
  if (!app) {
    throw new ApiError(404, `Zoho application '${appKey}' not found`);
  }

  const userPermissions = req.user && Array.isArray(req.user.permissions) ? req.user.permissions : [];
  if (!userPermissions.includes(app.permission_key)) {
    await auditModel.createLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'ACCESS_DENIED',
      detail: `Attempted to proxy request to Zoho app '${appKey}' without permission '${app.permission_key}'`,
      ipAddress,
    });
    throw new ApiError(403, 'Access Denied: Insufficient Permissions', {
      requiredPermission: app.permission_key,
    });
  }

  if (!app.is_provisioned) {
    throw new ApiError(409, 'This Zoho application is not yet provisioned');
  }

  // Get subpath beyond /api/zoho/:appKey/proxy
  const subPath = req.path.replace(new RegExp(`^/?${appKey}/proxy/?`), '');
  const response = await zohoService.proxyRequest(appKey, req.method, subPath, req.body, req.headers);

  return res.status(response.status).json(response.data);
});

module.exports = {
  getMyApps,
  open,
  proxy,
};
