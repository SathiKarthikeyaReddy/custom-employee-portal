const { verifyToken } = require('../services/tokenService');
const userModel = require('../models/userModel');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    // Real-time revocation & deactivation enforcement (Scenario 2.7)
    const userDetails = await userModel.getUserWithRolesAndPermissions(decoded.sub);
    if (!userDetails || !userDetails.is_active) {
      return res.status(401).json({ message: 'User account is inactive or not found' });
    }

    // Attach freshly loaded roles & permissions from DB (Scenario 1.10)
    req.user = {
      id: userDetails.id,
      email: userDetails.email,
      roles: userDetails.roleNames || [],
      permissions: userDetails.permissions || [],
    };
    next();
  } catch (err) {
    console.error('Error verifying active user state:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = authenticate;
