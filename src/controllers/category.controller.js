const productService = require('../services/product.service');
const { setFlash } = require('../middleware/flash.middleware');

function index(req, res) {
  res.render('categories/index', {
    title: 'Categories',
    categories: productService.listCategories(),
  });
}

function create(req, res, next) {
  try {
    productService.createCategory(req.body.name, req.user, req.ip);
    setFlash(req, 'success', 'Category created.');
    res.redirect('/categories');
  } catch (error) {
    next(error);
  }
}

function rename(req, res, next) {
  try {
    productService.renameCategory(Number(req.params.id), req.body.name, req.user, req.ip);
    setFlash(req, 'success', 'Category renamed.');
    res.redirect('/categories');
  } catch (error) {
    next(error);
  }
}

module.exports = { index, create, rename };
