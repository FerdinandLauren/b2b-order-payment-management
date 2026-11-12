const orderService = require('../services/order.service');
const customerService = require('../services/customer.service');
const productService = require('../services/product.service');
const { setFlash } = require('../middleware/flash.middleware');
const ApiError = require('../utils/ApiError');
const { today } = require('../utils/time');

const ORDER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'partially_fulfilled',
  'partially_cancelled',
  'fulfilled',
  'cancelled',
];

function index(req, res) {
  res.render('orders/index', {
    title: 'Sales orders',
    orders: orderService.listOrders(
      {
        status: req.query.status,
        customerId: req.query.customerId ? Number(req.query.customerId) : null,
        q: req.query.q,
      },
      req.user
    ),
    customers: customerService.listCustomers({}),
    statuses: ORDER_STATUSES,
    filters: {
      status: req.query.status || '',
      customerId: req.query.customerId || '',
      q: req.query.q || '',
    },
  });
}

function newForm(req, res) {
  const body = req.body || {};
  const productIds = Array.isArray(body.productId)
    ? body.productId
    : body.productId
      ? [body.productId]
      : [];
  const quantities = Array.isArray(body.quantity)
    ? body.quantity
    : body.quantity
      ? [body.quantity]
      : [];
  const prices = Array.isArray(body.unitPrice)
    ? body.unitPrice
    : body.unitPrice
      ? [body.unitPrice]
      : [];

  const oldItems = productIds.map((productId, index) => ({
    productId: String(productId),
    quantity: quantities[index] || '',
    unitPrice: prices[index] || '',
  }));

  res.render('orders/form', {
    title: 'New sales order',
    mode: 'create',
    order: null,
    lines: [],
    initialItems: oldItems,
    orderDate: body.orderDate || today(),
    customers: customerService.listCustomers({ status: 'active' }),
    products: productService.listProducts({}),
    oldHeader: body,
  });
}

function create(req, res, next) {
  try {
    const order = orderService.createOrder(req.body, req.user, req.ip);
    setFlash(req, 'success', `Sales order ${order.order_number} created as a draft.`);
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    next(error);
  }
}

function show(req, res, next) {
  try {
    const data = orderService.getOrder(Number(req.params.id));
    if (!orderService.canViewOrder(data.order, req.user)) {
      throw new ApiError(403, 'This sales order is not available to your role.');
    }
    res.render('orders/show', {
      title: data.order.order_number,
      ...data,
      canCancel: orderService.canCancel(data.order, req.user),
    });
  } catch (error) {
    next(error);
  }
}

function editForm(req, res, next) {
  try {
    const data = orderService.getOrder(Number(req.params.id));

    if (data.order.status !== 'draft') {
      throw new ApiError(400, 'Only draft orders can be edited.');
    }
    if (req.user.role === 'sales_staff' && data.order.created_by !== req.user.id) {
      throw new ApiError(403, 'You can only edit your own draft orders.');
    }

    res.render('orders/form', {
      title: `Edit ${data.order.order_number}`,
      mode: 'edit',
      order: data.order,
      lines: data.lines,
      initialItems: data.lines.map((line) => ({
        productId: String(line.product_id),
        quantity: String(line.quantity),
        unitPrice: String(line.unit_price),
      })),
      orderDate: data.order.order_date,
      customers: customerService.listCustomers({ status: 'active' }),
      products: productService.listProducts({}),
      oldHeader: {},
    });
  } catch (error) {
    next(error);
  }
}

function update(req, res, next) {
  try {
    const order = orderService.updateOrder(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'success', `Sales order ${order.order_number} updated.`);
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    next(error);
  }
}

function submit(req, res, next) {
  try {
    const order = orderService.submitOrder(Number(req.params.id), req.user, req.ip);
    setFlash(req, 'success', `Sales order ${order.order_number} submitted for approval.`);
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    next(error);
  }
}

function cancel(req, res, next) {
  try {
    const result = orderService.cancelOrder(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(
      req,
      'success',
      result.status === 'cancelled'
        ? `Sales order ${result.order.order_number} cancelled.`
        : `Sales order ${result.order.order_number} updated with partial cancellation.`
    );
    res.redirect(`/orders/${result.order.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, show, editForm, update, submit, cancel };
