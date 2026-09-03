const bcrypt = require('bcryptjs');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const userModel = require('../models/userModel');
const auditModel = require('../models/auditModel');
const { signToken } = require('../services/tokenService');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '';

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ApiError(400, 'Invalid email format');
  }

  const user = await userModel.findByEmail(email);

  if (!user || !user.is_active) {
    // Record failed login audit log
    await auditModel.createLog({
      userId: user ? user.id : null,
      userEmail: email,
      action: 'LOGIN_FAILED',
      detail: 'Invalid credentials or inactive user',
      ipAddress,
    });
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordMatch) {
    // Record failed login audit log
    await auditModel.createLog({
      userId: user.id,
      userEmail: email,
      action: 'LOGIN_FAILED',
      detail: 'Password mismatch',
      ipAddress,
    });
    throw new ApiError(401, 'Invalid credentials');
  }

  // Fetch full roles and permissions
  const userDetails = await userModel.getUserWithRolesAndPermissions(user.id);
  const roles = userDetails.roleNames || [];
  const permissions = userDetails.permissions || [];

  // Sign JWT token
  const token = signToken(user, roles, permissions);

  // Record successful login audit log
  await auditModel.createLog({
    userId: user.id,
    userEmail: user.email,
    action: 'LOGIN_SUCCESS',
    detail: 'User authenticated successfully',
    ipAddress,
  });

  return res.status(200).json({
    token,
    user: {
      id: userDetails.id,
      name: userDetails.name,
      email: userDetails.email,
      roles,
      permissions,
    },
  });
});

const me = asyncHandler(async (req, res) => {
  const userDetails = await userModel.getUserWithRolesAndPermissions(req.user.id);
  if (!userDetails || !userDetails.is_active) {
    throw new ApiError(401, 'User account is inactive or not found');
  }

  return res.status(200).json({
    user: {
      id: userDetails.id,
      name: userDetails.name,
      email: userDetails.email,
      roles: userDetails.roleNames || [],
      permissions: userDetails.permissions || [],
    },
  });
});

module.exports = {
  login,
  me,
};
