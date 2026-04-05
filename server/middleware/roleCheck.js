/**
 * Role-based access control middleware factory.
 * @param {...string} roles - Allowed roles (e.g. 'super_admin', 'client_user')
 * @returns {Function} Express middleware
 */
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireRole };
