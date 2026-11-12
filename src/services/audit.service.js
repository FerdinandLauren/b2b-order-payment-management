const auditRepository = require('../repositories/audit.repository');
const { now } = require('../utils/time');

function record({ userId, action, entityType, entityId, details, ipAddress }) {
  return auditRepository.create({
    userId,
    action,
    entityType,
    entityId,
    details,
    ipAddress,
    createdAt: now(),
  });
}

module.exports = { record };
