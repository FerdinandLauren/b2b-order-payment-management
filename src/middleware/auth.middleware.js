const userRepository = require('../repositories/user.repository');

function attachUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;

  if (req.session && req.session.userId) {
    const user = userRepository.findById(req.session.userId);
    if (user && user.status === 'active') {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      delete req.session.userId;
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (req.user) return next();

  if (req.session) {
    req.session.flash = { type: 'warning', message: 'Please sign in to continue.' };
  }
  return res.redirect('/login');
}

function requireGuest(req, res, next) {
  if (req.user) return res.redirect('/dashboard');
  return next();
}

module.exports = { attachUser, requireAuth, requireGuest };
