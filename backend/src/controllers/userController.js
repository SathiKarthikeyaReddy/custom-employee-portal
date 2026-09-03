const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');
const { query } = require('../config/db');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const list = asyncHandler(async (req, res) => {
  const users = await userModel.listAllWithRoles();
  return res.status(200).json({ users });
});

const create = asyncHandler(async (req, res) => {
  const { name, email, password, roleIds } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  if (!name || !email || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  if (!emailRegex.test(email.trim())) {
    throw new ApiError(400, 'Invalid email format');
  }

  if (typeof password !== 'string' || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  const existingUser = await userModel.findByEmail(email);
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const newUser = await userModel.createUser({
    name: name.trim(),
    email: email.trim(),
    passwordHash,
    roleIds: Array.isArray(roleIds) ? roleIds : [],
  });

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'USER_CREATED',
    detail: `Created user ${email} (ID: ${newUser.id})`,
    ipAddress,
  });

  return res.status(201).json({
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      isActive: newUser.is_active,
      roles: newUser.roleNames || [],
      createdAt: newUser.created_at,
    },
  });
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, isActive, roleIds } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  const targetUser = await userModel.findById(id);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
    if (!emailRegex.test(email.trim())) {
      throw new ApiError(400, 'Invalid email format');
    }
    const existingUser = await userModel.findByEmail(email);
    if (existingUser && existingUser.id !== parseInt(id, 10)) {
      throw new ApiError(409, 'Email is already in use by another user');
    }
  }

  // Guardrail 4.7 & 4.8: Prevent removing last active Admin
  const fullTarget = await userModel.getUserWithRolesAndPermissions(id);
  if (fullTarget && fullTarget.roleNames.includes('Admin')) {
    const adminRoleRes = await query("SELECT id FROM roles WHERE name = 'Admin'");
    const adminRoleId = adminRoleRes.rows[0]?.id;

    const removingAdminRole = roleIds !== undefined && Array.isArray(roleIds) && !roleIds.includes(adminRoleId);
    const deactivating = isActive === false;

    if (removingAdminRole || deactivating) {
      const adminCountRes = await query(
        `SELECT COUNT(DISTINCT u.id) as count 
         FROM user_roles ur 
         JOIN roles r ON ur.role_id = r.id 
         JOIN users u ON ur.user_id = u.id 
         WHERE r.name = 'Admin' AND u.is_active = true AND u.id != $1`,
        [id]
      );
      const remainingAdmins = parseInt(adminCountRes.rows[0].count, 10);
      if (remainingAdmins === 0) {
        throw new ApiError(409, 'At least one Admin must remain');
      }
    }
  }

  const changedFields = [];
  if (name !== undefined) changedFields.push('name');
  if (email !== undefined) changedFields.push('email');
  if (isActive !== undefined) changedFields.push('isActive');
  if (roleIds !== undefined) changedFields.push('roles');

  const updated = await userModel.updateUser(id, {
    name: name !== undefined ? name.trim() : undefined,
    email: email !== undefined ? email.trim() : undefined,
    isActive,
    roleIds,
  });

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'USER_UPDATED',
    detail: `Updated user ${targetUser.email} (ID: ${id}): changed [${changedFields.join(', ')}]`,
    ipAddress,
  });

  return res.status(200).json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      isActive: updated.is_active,
      roles: updated.roleNames || [],
      updatedAt: updated.updated_at,
    },
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters long');
  }

  const targetUser = await userModel.findById(id);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await userModel.updatePassword(id, passwordHash);

  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'PASSWORD_RESET',
    detail: `Password reset for user ${targetUser.email} (ID: ${id})`,
    ipAddress,
  });

  return res.status(200).json({ message: 'Password reset successfully' });
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  const targetUser = await userModel.findById(id);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent admin from deleting themselves
  if (parseInt(id, 10) === req.user.id) {
    throw new ApiError(400, 'You cannot delete your own active account');
  }

  // Guardrail 4.7: Prevent deleting the last Admin
  const fullTarget = await userModel.getUserWithRolesAndPermissions(id);
  if (fullTarget && fullTarget.roleNames.includes('Admin')) {
    const adminCountRes = await query(
      `SELECT COUNT(DISTINCT u.id) as count 
       FROM user_roles ur 
       JOIN roles r ON ur.role_id = r.id 
       JOIN users u ON ur.user_id = u.id 
       WHERE r.name = 'Admin' AND u.is_active = true AND u.id != $1`,
      [id]
    );
    const remainingAdmins = parseInt(adminCountRes.rows[0].count, 10);
    if (remainingAdmins === 0) {
      throw new ApiError(409, 'At least one Admin must remain');
    }
  }

  // Write audit row before deleting, capturing user email first
  await auditModel.createLog({
    userId: req.user.id,
    userEmail: req.user.email,
    action: 'USER_DELETED',
    detail: `Deleted user ${targetUser.email} (ID: ${id})`,
    ipAddress,
  });

  await userModel.deleteUser(id);

  return res.status(204).send();
});

module.exports = {
  list,
  create,
  update,
  resetPassword,
  remove,
};
