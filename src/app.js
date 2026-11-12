const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');

const env = require('./config/env');
const routes = require('./routes');
const { attachUser } = require('./middleware/auth.middleware');
const { flashMiddleware } = require('./middleware/flash.middleware');
const { csrfMiddleware } = require('./middleware/csrf.middleware');
const { notFound, errorHandler } = require('./middleware/error.middleware');
const { rupiah, number, date, datetime, percent } = require('./utils/format');
const { today } = require('./utils/time');
const constants = require('./utils/constants');

function createApp() {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          upgradeInsecureRequests: null,
        },
      },
    })
  );

  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      name: 'b2b.sid',
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 8 * 60 * 60 * 1000,
      },
    })
  );

  app.use(flashMiddleware);
  app.use(csrfMiddleware);
  app.use(attachUser);

  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    res.locals.query = req.query;
    res.locals.appName = env.appName;
    res.locals.companyName = env.companyName;
    res.locals.helpers = { rupiah, number, date, datetime, percent };
    res.locals.enums = constants;
    res.locals.badge = (status) => constants.STATUS_BADGE[status] || 'neutral';
    res.locals.todayLabel = date(today());
    res.locals.initials = (name) =>
      String(name || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
    next();
  });

  app.use(routes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
