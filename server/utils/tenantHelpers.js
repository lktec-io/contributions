'use strict';

/**
 * Returns the Contribution/Event query filter for the current user.
 *
 * super_admin → {} (no filter — sees everything)
 * admin       → { createdBy: userId } (sees their own events/contributions)
 * client_user → { organizationId: userId } (sees their assigned events)
 */
function getIsolationFilter(req) {
  switch (req.user.role) {
    case 'super_admin':  return {};
    case 'admin':        return { createdBy: req.user.userId };
    case 'client_user':  return { organizationId: req.user.userId };
    default:             return { createdBy: req.user.userId };
  }
}

/**
 * Returns true if the calling user may read/write this contribution row.
 *
 * contribution must contain:  event_created_by  (from events.created_by JOIN)
 *                              organization_id   (from events.organization_id JOIN)
 */
function canAccessContribution(req, contribution) {
  switch (req.user.role) {
    case 'super_admin':  return true;
    case 'admin':        return contribution.event_created_by === req.user.userId;
    case 'client_user':  return contribution.organization_id  === req.user.userId;
    default:             return false;
  }
}

/**
 * Returns true if the calling user may read/write this event row.
 *
 * event must contain:  created_by      (from events.created_by)
 *                      organization_id (from events.organization_id)
 */
function canAccessEvent(req, event) {
  switch (req.user.role) {
    case 'super_admin':  return true;
    case 'admin':        return event.created_by     === req.user.userId;
    case 'client_user':  return event.organization_id === req.user.userId;
    default:             return false;
  }
}

/**
 * Returns true if the calling user may manage this user row.
 *
 * targetUser must contain:  created_by  (which admin created this user)
 *                            id          (the user's own id)
 */
function canAccessUser(req, targetUser) {
  if (req.user.role === 'super_admin') return true;
  // admin can manage users they created
  return targetUser.created_by === req.user.userId;
}

module.exports = { getIsolationFilter, canAccessContribution, canAccessEvent, canAccessUser };
