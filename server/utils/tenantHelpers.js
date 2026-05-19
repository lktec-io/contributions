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
 * Fast path: direct ownership via event_created_by / organization_id.
 * Fallback: checks event_assignments for secondary access (e.g. multi-event
 * assignments where the user is not the primary event owner).
 *
 * contribution must contain:  event_id, event_created_by, organization_id
 */
async function canAccessContribution(req, contribution) {
  const { userId, role } = req.user;

  if (role === 'super_admin') return true;

  // client_user: STRICT — must be the primary event owner (organization_id).
  // No event_assignments fallback; that would leak another user's contributions.
  if (role === 'client_user') return contribution.organization_id === userId;

  // admin: direct ownership first (fast path), then event_assignments fallback
  // for events the admin can reach as a secondary assignee.
  if (role === 'admin' && contribution.event_created_by === userId) return true;

  try {
    const pool = require('../config/db');
    const [rows] = await pool.query(
      'SELECT 1 FROM event_assignments WHERE event_id = ? AND user_id = ? LIMIT 1',
      [contribution.event_id, userId]
    );
    return rows.length > 0;
  } catch (err) {
    if (err.errno === 1146) return false;
    throw err;
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
