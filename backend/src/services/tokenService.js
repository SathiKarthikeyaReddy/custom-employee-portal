const jwt = require('jsonwebtoken');

const signToken = (user, roles = [], permissions = []) => {
  const payload = {
    sub: user.id,
    email: user.email,
    roles: Array.isArray(roles) ? roles : [],
    permissions: Array.isArray(permissions) ? permissions : [],
  };

  const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'fallback-secret-for-dev';
  return jwt.verify(token, secret);
};

module.exports = {
  signToken,
  verifyToken,
};
