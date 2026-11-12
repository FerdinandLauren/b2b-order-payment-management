const { setFlash } = require('./flash.middleware');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      setFlash(req, 'warning', 'Please sign in to continue.');
      return res.redirect('/login');
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).render('errors/403', {
        title: 'Access denied',
        currentPath: req.path,
        message: 'Your role does not have access to this page.',
      });
    }

    return next();
  };
}

module.exports = { requireRole };
