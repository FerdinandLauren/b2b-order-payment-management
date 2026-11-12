const env = require('../config/env');
const { setFlash } = require('./flash.middleware');

function safeBack(req, fallback = '/dashboard') {
  const referer = req.get('referer');
  if (!referer) return fallback;

  try {
    const url = new URL(referer);
    const host = req.get('host');
    if (url.host === host) {
      return `${url.pathname}${url.search}`;
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
}

function notFound(req, res) {
  res.status(404).render('errors/404', {
    title: 'Page not found',
    currentPath: req.path,
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.isOperational) {
    if (req.method === 'POST') {
      setFlash(req, 'danger', err.message);
      return res.redirect(safeBack(req));
    }
    return res.status(err.statusCode || 400).render('errors/error', {
      title: 'Action could not be completed',
      currentPath: req.path,
      statusCode: err.statusCode || 400,
      message: err.message,
    });
  }

  // eslint-disable-next-line no-console
  console.error(err);

  if (env.isTest) {
    return res.status(500).render('errors/error', {
      title: 'Unexpected error',
      currentPath: req.path,
      statusCode: 500,
      message: err.message,
    });
  }

  return res.status(500).render('errors/500', {
    title: 'Unexpected error',
    currentPath: req.path,
  });
}

module.exports = { notFound, errorHandler, safeBack };
