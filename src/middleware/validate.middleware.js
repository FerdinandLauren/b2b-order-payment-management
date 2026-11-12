const { validationResult } = require('express-validator');
const { setFlashMessages } = require('./flash.middleware');

function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const messages = result.array().map((error) => error.msg);

  if (req.session) {
    setFlashMessages(req, 'danger', messages);
    const oldInput = { ...req.body };
    delete oldInput.password;
    delete oldInput._csrf;
    req.session.oldInput = oldInput;
  }

  const back = req.get('referer') || '/dashboard';
  return res.redirect(back);
}

module.exports = { validate };
