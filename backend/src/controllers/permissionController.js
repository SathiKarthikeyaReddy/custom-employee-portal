const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const permissionModel = require('../models/permissionModel');
const roleModel = require('../models/roleModel');
const auditModel = require('../models/auditModel');

const list = asyncHandler(async (req, res) => {
  const permissions = await permissionModel.listAll();
  return res.status(200).json({ permissions });
});

const assignToRole = asyncHandler(async (req, res) => {
  const { roleId, permissionIds } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  if (!roleId) {
    throw new ApiError(400, 'roleId is required');
  }

  const role = await roleModel.findById(roleId);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }

  if (!Array.isArray(permissionIds)) {
    throw new ApiError(400, 'permissionIds must be an array of numbers');
  }

  if (permissionIds.length > 0) {
    const allPerms = await permissionModel.listAll();
    const validPermIds = new Set(allPerms.map(p => p.id));
    const invalidIds = permissionIds.filter(id => !validPermIds.has(id));
    if (invalidIds.length > 0) {
      throw new ApiError(400, 'One or more invalid permission IDs', { invalidIds });
    }
  }

  const updatedRole = await permissionModel.assignPermissionsToRole(roleId, permissionIds);

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ROLE_PERMISSIONS_UPDATED',
    detail: `Updated permissions for role '${role.name}' (ID: ${roleId}) to [${updatedRole.permissionKeys.join(', ')}]`,
    ipAddress,
  });

  return res.status(200).json({ role: updatedRole });
});

module.exports = {
  list,
  assignToRole,
};
