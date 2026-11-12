const crypto = require('crypto');
const authService = require('../services/auth.service');

function showLogin(req, res) {
  res.render('auth/login', { title: 'Sign in' });
}

async function login(req, res, next) {
  try {
    const user = authService.login(req.body.username, req.body.password, req.ip);

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

    req.session.userId = user.id;
    req.session.csrfToken = crypto.randomBytes(24).toString('hex');
    req.session.flash = {
      type: 'success',
      message: `Welcome back, ${user.full_name.split(' ')[0]}.`,
    };

    return res.redirect('/dashboard');
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  authService.logout(req.user, req.ip);

  req.session.destroy(() => {
    res.clearCookie('b2b.sid');
    res.redirect('/login');
  });
}

function showForbidden(req, res) {
  res.status(403).render('errors/403', {
    title: 'Access denied',
    currentPath: req.path,
    message: 'Your role does not have access to this page.',
  });
}

module.exports = { showLogin, login, logout, showForbidden };
