const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../utils/constants');

function listUsers() {
  return userRepository.list();
}

function validateRole(role) {
  if (!ROLES[role]) {
    throw new ApiError(400, 'Invalid role selected.');
  }
}

function createUser({ username, password, fullName, role }, actor, ipAddress) {
  const normalizedUsername = String(username || '').trim().toLowerCase();

  if (userRepository.findByUsername(normalizedUsername)) {
    throw new ApiError(409, 'That username is already in use.');
  }
  validateRole(role);

  const user = userRepository.create({
    username: normalizedUsername,
    passwordHash: bcrypt.hashSync(password, 10),
    fullName: String(fullName || '').trim(),
    role,
  });

  auditService.record({
    userId: actor.id,
    action: 'user_created',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, role: user.role },
    ipAddress,
  });

  return user;
}

function updateUser(id, { fullName, role, password }, actor, ipAddress) {
  const existing = userRepository.findById(id);
  if (!existing) throw new ApiError(404, 'User not found.');
  validateRole(role);

  if (existing.id === actor.id && existing.role !== role) {
    throw new ApiError(400, 'You cannot change your own role.');
  }

  const passwordHash = password ? bcrypt.hashSync(password, 10) : null;
  const user = userRepository.update(id, {
    fullName: String(fullName || '').trim(),
    role,
    passwordHash,
  });

  auditService.record({
    userId: actor.id,
    action: 'user_updated',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, role: user.role, passwordChanged: Boolean(password) },
    ipAddress,
  });

  return user;
}

function setUserStatus(id, status, actor, ipAddress) {
  if (!['active', 'inactive'].includes(status)) {
    throw new ApiError(400, 'Invalid status.');
  }
  if (Number(id) === actor.id && status === 'inactive') {
    throw new ApiError(400, 'You cannot deactivate your own account.');
  }

  const existing = userRepository.findById(id);
  if (!existing) throw new ApiError(404, 'User not found.');

  const user = userRepository.setStatus(id, status);
  auditService.record({
    userId: actor.id,
    action: 'user_status_changed',
    entityType: 'user',
    entityId: user.id,
    details: { username: user.username, status },
    ipAddress,
  });

  return user;
}

module.exports = { listUsers, createUser, updateUser, setUserStatus };
