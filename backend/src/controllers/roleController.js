const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const roleModel = require('../models/roleModel');
const auditModel = require('../models/auditModel');

const CORE_ROLES = ['Admin', 'HR', 'Sales', 'Support', 'Finance', 'Manager'];

const list = asyncHandler(async (req, res) => {
  const roles = await roleModel.listAllWithPermissions();
  return res.status(200).json({ roles });
});

const create = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  if (!name || name.trim() === '') {
    throw new ApiError(400, 'Role name is required');
  }

  const existing = await roleModel.findByName(name.trim());
  if (existing) {
    throw new ApiError(409, 'Role with this name already exists');
  }

  const role = await roleModel.createRole({ name: name.trim(), description: description || '' });

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ROLE_CREATED',
    detail: `Created role '${role.name}' (ID: ${role.id})`,
    ipAddress,
  });

  return res.status(201).json({ role });
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  const role = await roleModel.findById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }

  // If renaming, check core roles and uniqueness
  if (name && name.trim() !== role.name) {
    if (CORE_ROLES.map(r => r.toLowerCase()).includes(role.name.toLowerCase())) {
      throw new ApiError(400, 'Core role names cannot be renamed');
    }
    const duplicate = await roleModel.findByName(name.trim());
    if (duplicate && duplicate.id !== parseInt(id, 10)) {
      throw new ApiError(409, 'Role name is already in use');
    }
  }

  const updatedRole = await roleModel.updateRole(id, {
    name: name ? name.trim() : undefined,
    description,
  });

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ROLE_UPDATED',
    detail: `Updated role '${role.name}' (ID: ${id})`,
    ipAddress,
  });

  return res.status(200).json({ role: updatedRole });
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  const role = await roleModel.findById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }

  const isCore = CORE_ROLES.some(
    coreRole => coreRole.toLowerCase() === role.name.toLowerCase()
  );

  if (isCore) {
    throw new ApiError(409, 'Core roles cannot be deleted');
  }

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'ROLE_DELETED',
    detail: `Deleted role '${role.name}' (ID: ${id})`,
    ipAddress,
  });

  await roleModel.deleteRole(id);

  return res.status(204).send();
});

module.exports = {
  list,
  create,
  update,
  remove,
};
