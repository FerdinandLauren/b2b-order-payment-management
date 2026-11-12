const userService = require('../services/user.service');
const { setFlash } = require('../middleware/flash.middleware');
const ApiError = require('../utils/ApiError');

function index(req, res) {
  res.render('users/index', {
    title: 'Users',
    users: userService.listUsers(),
  });
}

function newForm(req, res) {
  res.render('users/form', {
    title: 'Add user',
    mode: 'create',
    user: null,
  });
}

function create(req, res, next) {
  try {
    userService.createUser(
      {
        username: req.body.username,
        password: req.body.password,
        fullName: req.body.fullName,
        role: req.body.role,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'User created successfully.');
    res.redirect('/users');
  } catch (error) {
    next(error);
  }
}

function editForm(req, res, next) {
  const users = userService.listUsers();
  const user = users.find((item) => item.id === Number(req.params.id));
  if (!user) return next(new ApiError(404, 'User not found.'));

  return res.render('users/form', {
    title: 'Edit user',
    mode: 'edit',
    user,
  });
}

function update(req, res, next) {
  try {
    userService.updateUser(
      Number(req.params.id),
      {
        fullName: req.body.fullName,
        role: req.body.role,
        password: req.body.password,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'User updated successfully.');
    res.redirect('/users');
  } catch (error) {
    next(error);
  }
}

function updateStatus(req, res, next) {
  try {
    userService.setUserStatus(Number(req.params.id), req.body.status, req.user, req.ip);
    setFlash(req, 'success', 'User status updated.');
    res.redirect('/users');
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, editForm, update, updateStatus };
