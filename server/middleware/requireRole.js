'use strict';

/**
 * Role-based access control middleware factory.
 * Usage: requireRole('super_admin') or requireRole('client_user')
 * @param {...string} roles - One or more allowed roles.
 * @returns {Function} Express middleware
 */
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated', errors: [] });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: insufficient permissions',
        errors: [],
      });
    }

    next();
  };
}

module.exports = requireRole;
