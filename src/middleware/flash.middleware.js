function flashMiddleware(req, res, next) {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;

  res.locals.old = req.session.oldInput || {};
  delete req.session.oldInput;

  next();
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

function setFlashMessages(req, type, messages) {
  req.session.flash = { type, messages };
}

module.exports = { flashMiddleware, setFlash, setFlashMessages };
