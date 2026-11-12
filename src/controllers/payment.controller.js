const paymentService = require('../services/payment.service');
const { setFlash } = require('../middleware/flash.middleware');
const { PAYMENT_STATUS, PAYMENT_METHOD } = require('../utils/constants');

function index(req, res) {
  res.render('payments/index', {
    title: 'Payments',
    payments: paymentService.listPayments({
      status: req.query.status,
      q: req.query.q,
    }),
    stats: paymentService.getPaymentStats(),
    statuses: Object.keys(PAYMENT_STATUS),
    methods: Object.keys(PAYMENT_METHOD),
    filters: {
      status: req.query.status || '',
      q: req.query.q || '',
    },
    isFinance: req.user.role === 'finance_staff',
  });
}

function newForm(req, res) {
  const data = paymentService.getCreateForm();
  res.render('payments/new', {
    title: 'Record payment',
    customers: data.customers,
    paymentDate: data.paymentDate,
    methods: Object.keys(PAYMENT_METHOD),
  });
}

function create(req, res, next) {
  try {
    const payment = paymentService.createPayment(req.body, req.user, req.ip);
    setFlash(req, 'success', `Payment ${payment.payment_number} recorded.`);
    res.redirect(`/payments/${payment.id}`);
  } catch (error) {
    next(error);
  }
}

function show(req, res, next) {
  try {
    const data = paymentService.getPayment(Number(req.params.id));
    res.render('payments/show', {
      title: data.payment.payment_number,
      ...data,
      isFinance: req.user.role === 'finance_staff',
    });
  } catch (error) {
    next(error);
  }
}

function allocate(req, res, next) {
  try {
    const payment = paymentService.allocatePayment(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'success', `Payment ${payment.payment_number} allocated.`);
    res.redirect(`/payments/${payment.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, show, allocate };
