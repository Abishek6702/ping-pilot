const mongoose = require("mongoose");

function isAdminUser(user) {
  return Boolean(user && user.role === "admin");
}

function getUserIdString(user) {
  if (!user || !user._id) return null;
  return user._id.toString();
}

/**
 * Verifies ownership of a Monitor document.
 * Non-admin users can ONLY access monitors explicitly owned by their userId
 * (never allowing null-owner/legacy monitors to be accessed by arbitrary users).
 */
function canAccessMonitor(user, monitor) {
  if (!user || !monitor) return false;
  if (isAdminUser(user)) return true;

  const ownerId = monitor.userId?._id ? monitor.userId._id.toString() : monitor.userId?.toString();
  const requesterId = getUserIdString(user);
  return Boolean(ownerId && requesterId && ownerId === requesterId);
}

/**
 * Verifies ownership of any user-scoped document (Incident, StatusPage, etc.)
 * or direct owner ID / populated owner reference.
 */
function canAccessOwnedResource(user, resourceOrOwnerId) {
  if (!user || !resourceOrOwnerId) return false;
  if (isAdminUser(user)) return true;

  let ownerValue = resourceOrOwnerId;
  if (
    typeof resourceOrOwnerId === "object" &&
    !(resourceOrOwnerId instanceof mongoose.Types.ObjectId)
  ) {
    if (Object.prototype.hasOwnProperty.call(resourceOrOwnerId, "userId") || "userId" in resourceOrOwnerId) {
      ownerValue = resourceOrOwnerId.userId;
    }
  }

  if (!ownerValue) return false;
  const ownerId = ownerValue._id ? ownerValue._id.toString() : ownerValue.toString();
  const requesterId = getUserIdString(user);
  return Boolean(ownerId && requesterId && ownerId === requesterId);
}

/**
 * Resolves accessible Monitor IDs for the current requester, enforcing ownership when
 * explicit Monitor IDs are supplied.
 */
function filterAccessibleMonitorIds(user, requestedMonitorIds = [], accessibleMonitors = []) {
  const accessibleMap = new Map(
    accessibleMonitors.map((m) => [m._id.toString(), m])
  );

  if (!Array.isArray(requestedMonitorIds) || requestedMonitorIds.length === 0) {
    return accessibleMonitors.map((m) => m._id);
  }

  const validRequested = requestedMonitorIds
    .map((id) => (id ? id.toString().trim() : ""))
    .filter((id) => mongoose.Types.ObjectId.isValid(id));

  return validRequested
    .filter((id) => accessibleMap.has(id))
    .map((id) => accessibleMap.get(id)._id);
}

module.exports = {
  isAdminUser,
  getUserIdString,
  canAccessMonitor,
  canAccessOwnedResource,
  filterAccessibleMonitorIds,
};

