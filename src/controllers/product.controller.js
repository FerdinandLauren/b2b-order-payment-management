const productService = require('../services/product.service');
const { setFlash } = require('../middleware/flash.middleware');

function index(req, res) {
  res.render('products/index', {
    title: 'Products',
    products: productService.listProducts({
      q: req.query.q,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : null,
      status: req.query.status,
    }),
    categories: productService.listCategories(),
    filters: {
      q: req.query.q || '',
      categoryId: req.query.categoryId || '',
      status: req.query.status || '',
    },
  });
}

function show(req, res, next) {
  try {
    const data = productService.getProduct(Number(req.params.id));
    res.render('products/show', {
      title: data.product.name,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}

function newForm(req, res) {
  res.render('products/form', {
    title: 'New product',
    mode: 'create',
    product: null,
    categories: productService.listCategories(),
  });
}

function create(req, res, next) {
  try {
    const product = productService.createProduct(
      {
        name: req.body.name,
        categoryId: req.body.categoryId,
        unit: req.body.unit,
        unitPrice: req.body.unitPrice,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', `Product ${product.name} created (${product.sku}).`);
    res.redirect(`/products/${product.id}`);
  } catch (error) {
    next(error);
  }
}

function editForm(req, res, next) {
  try {
    const { product } = productService.getProduct(Number(req.params.id));
    res.render('products/form', {
      title: 'Edit product',
      mode: 'edit',
      product,
      categories: productService.listCategories(),
    });
  } catch (error) {
    next(error);
  }
}

function update(req, res, next) {
  try {
    const product = productService.updateProduct(
      Number(req.params.id),
      {
        name: req.body.name,
        categoryId: req.body.categoryId,
        unit: req.body.unit,
        unitPrice: req.body.unitPrice,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'Product updated.');
    res.redirect(`/products/${product.id}`);
  } catch (error) {
    next(error);
  }
}

function updateStatus(req, res, next) {
  try {
    productService.setProductStatus(Number(req.params.id), req.body.status, req.user, req.ip);
    setFlash(req, 'success', 'Product status updated.');
    res.redirect(`/products/${req.params.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, show, newForm, create, editForm, update, updateStatus };
