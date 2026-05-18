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

  // Direct ownership — fast path, no extra DB round-trip needed
  if (role === 'admin'       && contribution.event_created_by === userId) return true;
  if (role === 'client_user' && contribution.organization_id  === userId) return true;

  // Secondary access via event_assignments
  // Covers contributions on events the user can reach as an assignee but
  // where they are not the primary owner (organization_id / created_by).
  try {
    const pool = require('../config/db');
    const [rows] = await pool.query(
      'SELECT 1 FROM event_assignments WHERE event_id = ? AND user_id = ? LIMIT 1',
      [contribution.event_id, userId]
    );
    return rows.length > 0;
  } catch (err) {
    if (err.errno === 1146) return false; // table not yet migrated — deny gracefully
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
