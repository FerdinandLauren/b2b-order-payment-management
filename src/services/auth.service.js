const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');

function login(username, password, ipAddress) {
  const user = userRepository.findByUsername(String(username || '').trim().toLowerCase());

  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'This account is inactive. Contact the administrator.');
  }

  auditService.record({
    userId: user.id,
    action: 'login',
    entityType: 'auth',
    entityId: user.id,
    details: { username: user.username },
    ipAddress,
  });

  delete user.password_hash;
  return user;
}

function logout(user, ipAddress) {
  if (!user) return;
  auditService.record({
    userId: user.id,
    action: 'logout',
    entityType: 'auth',
    entityId: user.id,
    details: { username: user.username },
    ipAddress,
  });
}

module.exports = { login, logout };
