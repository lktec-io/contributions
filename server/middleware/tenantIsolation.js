/**
 * Tenant isolation middleware.
 * Sets req.tenantFilter — spread into any model query that supports it.
 *
 * super_admin → {}                          (no filter — sees all data)
 * admin       → { createdBy: userId }       (sees only their own events/contributions)
 * client_user → { organizationId: userId }  (sees only their assigned events)
 */
function tenantIsolation(req, res, next) {
  switch (req.user?.role) {
    case 'super_admin':
      req.tenantFilter = {};
      break;
    case 'admin':
      req.tenantFilter = { createdBy: req.user.userId };
      break;
    case 'client_user':
      req.tenantFilter = { organizationId: req.user.userId };
      break;
    default:
      req.tenantFilter = { createdBy: req.user?.userId };
  }
  next();
}

module.exports = tenantIsolation;
