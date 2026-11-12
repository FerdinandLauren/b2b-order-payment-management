const invoiceService = require('../services/invoice.service');
const { setFlash } = require('../middleware/flash.middleware');
const { INVOICE_STATUS } = require('../utils/constants');

function index(req, res) {
  res.render('invoices/index', {
    title: 'Invoices',
    invoices: invoiceService.listInvoices({
      status: req.query.status,
      q: req.query.q,
      overdue: req.query.overdue === '1',
    }),
    stats: invoiceService.getInvoiceStats(),
    statuses: Object.keys(INVOICE_STATUS),
    filters: {
      status: req.query.status || '',
      q: req.query.q || '',
      overdue: req.query.overdue === '1',
    },
    isFinance: req.user.role === 'finance_staff',
  });
}

function newForm(req, res, next) {
  try {
    const deliveryId = req.query.deliveryId ? Number(req.query.deliveryId) : null;
    if (!deliveryId) {
      return res.render('invoices/new', {
        title: 'New invoice',
        delivery: null,
        lines: [],
        deliveries: invoiceService.getEligibleDeliveries(),
        invoiceDate: '',
        dueDate: '',
        subtotal: 0,
      });
    }

    const data = invoiceService.getCreateForm(deliveryId);
    res.render('invoices/new', {
      title: `New invoice for ${data.delivery.delivery_number}`,
      delivery: data.delivery,
      lines: data.lines,
      deliveries: [],
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      subtotal: data.subtotal,
    });
  } catch (error) {
    next(error);
  }
}

function create(req, res, next) {
  try {
    const invoice = invoiceService.createInvoice(req.body, req.user, req.ip);
    setFlash(req, 'success', `Invoice ${invoice.invoice_number} generated as a draft.`);
    res.redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    next(error);
  }
}

function show(req, res, next) {
  try {
    const data = invoiceService.getInvoice(Number(req.params.id));
    res.render('invoices/show', {
      title: data.invoice.invoice_number,
      ...data,
      isFinance: req.user.role === 'finance_staff',
    });
  } catch (error) {
    next(error);
  }
}

function issue(req, res, next) {
  try {
    const invoice = invoiceService.issueInvoice(Number(req.params.id), req.user, req.ip);
    setFlash(req, 'success', `Invoice ${invoice.invoice_number} issued.`);
    res.redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    next(error);
  }
}

function voidInvoice(req, res, next) {
  try {
    const invoice = invoiceService.voidInvoice(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'warning', `Invoice ${invoice.invoice_number} voided.`);
    res.redirect(`/invoices/${invoice.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, show, issue, voidInvoice };
