/**
 * Tenant isolation middleware.
 * Must be used after auth middleware so that req.user is already populated.
 *
 * - client_user: restricts data access to their own organization (their own userId)
 * - super_admin: no restriction (organizationId = null)
 */
function tenantIsolation(req, res, next) {
  if (req.user.role === 'client_user') {
    req.organizationId = req.user.userId;
  } else {
    // super_admin has unrestricted access
    req.organizationId = null;
  }
  next();
}

module.exports = tenantIsolation;
