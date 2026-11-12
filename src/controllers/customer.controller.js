const customerService = require('../services/customer.service');
const { setFlash } = require('../middleware/flash.middleware');

function index(req, res) {
  res.render('customers/index', {
    title: 'Customers',
    customers: customerService.listCustomers({
      q: req.query.q,
      status: req.query.status,
    }),
    filters: { q: req.query.q || '', status: req.query.status || '' },
  });
}

function show(req, res, next) {
  try {
    const data = customerService.getCustomer(Number(req.params.id));
    res.render('customers/show', {
      title: data.customer.name,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}

function newForm(req, res) {
  res.render('customers/form', { title: 'New customer', mode: 'create', customer: null });
}

function create(req, res, next) {
  try {
    const customer = customerService.createCustomer(
      {
        name: req.body.name,
        address: req.body.address,
        city: req.body.city,
        phone: req.body.phone,
        email: req.body.email,
        npwp: req.body.npwp,
        paymentTermsDays: req.body.paymentTermsDays,
        creditLimit: req.body.creditLimit,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', `Customer ${customer.name} created (${customer.code}).`);
    res.redirect(`/customers/${customer.id}`);
  } catch (error) {
    next(error);
  }
}

function editForm(req, res, next) {
  try {
    const { customer } = customerService.getCustomer(Number(req.params.id));
    res.render('customers/form', { title: 'Edit customer', mode: 'edit', customer });
  } catch (error) {
    next(error);
  }
}

function update(req, res, next) {
  try {
    const customer = customerService.updateCustomer(
      Number(req.params.id),
      {
        name: req.body.name,
        address: req.body.address,
        city: req.body.city,
        phone: req.body.phone,
        email: req.body.email,
        npwp: req.body.npwp,
        paymentTermsDays: req.body.paymentTermsDays,
        creditLimit: req.body.creditLimit,
      },
      req.user,
      req.ip
    );
    setFlash(req, 'success', 'Customer updated.');
    res.redirect(`/customers/${customer.id}`);
  } catch (error) {
    next(error);
  }
}

function updateStatus(req, res, next) {
  try {
    customerService.setCustomerStatus(Number(req.params.id), req.body.status, req.user, req.ip);
    setFlash(req, 'success', 'Customer status updated.');
    res.redirect(`/customers/${req.params.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, show, newForm, create, editForm, update, updateStatus };
