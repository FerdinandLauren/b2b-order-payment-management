const crypto = require('crypto');
const env = require('../config/env');

function csrfMiddleware(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  }

  res.locals.csrfToken = req.session.csrfToken;

  if (req.method === 'POST' && !env.isTest) {
    const token = req.body && req.body._csrf;
    if (!token || token !== req.session.csrfToken) {
      return res.status(403).render('errors/403', {
        title: 'Invalid request',
        currentPath: req.path,
        message: 'Your session token is invalid or expired. Please go back and try again.',
      });
    }
  }

  return next();
}

module.exports = { csrfMiddleware };
