const deliveryService = require('../services/delivery.service');
const { setFlash } = require('../middleware/flash.middleware');
const { DELIVERY_STATUS } = require('../utils/constants');

function index(req, res) {
  const isWarehouse = req.user.role === 'warehouse_staff';
  res.render('deliveries/index', {
    title: 'Deliveries',
    deliveries: deliveryService.listDeliveries({
      status: req.query.status,
      q: req.query.q,
      orderId: req.query.orderId ? Number(req.query.orderId) : null,
    }),
    board: isWarehouse ? deliveryService.getFulfillmentBoard() : { orders: [] },
    statuses: Object.keys(DELIVERY_STATUS),
    filters: {
      status: req.query.status || '',
      q: req.query.q || '',
    },
    isWarehouse,
  });
}

function newForm(req, res, next) {
  try {
    const orderId = req.query.orderId ? Number(req.query.orderId) : null;
    if (!orderId) {
      return res.render('deliveries/new', {
        title: 'New delivery',
        order: null,
        lines: [],
        board: deliveryService.getFulfillmentBoard(),
        deliveryDate: new Date().toISOString().slice(0, 10),
        oldHeader: {},
      });
    }

    const data = deliveryService.getCreateForm(orderId);
    res.render('deliveries/new', {
      title: `New delivery for ${data.order.order_number}`,
      order: data.order,
      lines: data.lines,
      board: { orders: [] },
      deliveryDate: new Date().toISOString().slice(0, 10),
      oldHeader: {},
    });
  } catch (error) {
    next(error);
  }
}

function create(req, res, next) {
  try {
    const delivery = deliveryService.createDelivery(req.body, req.user, req.ip);
    setFlash(req, 'success', `Delivery ${delivery.delivery_number} created as a draft.`);
    res.redirect(`/deliveries/${delivery.id}`);
  } catch (error) {
    next(error);
  }
}

function show(req, res, next) {
  try {
    const data = deliveryService.getDelivery(Number(req.params.id));
    res.render('deliveries/show', {
      title: data.delivery.delivery_number,
      ...data,
      isWarehouse: req.user.role === 'warehouse_staff',
    });
  } catch (error) {
    next(error);
  }
}

function dispatch(req, res, next) {
  try {
    const delivery = deliveryService.dispatchDelivery(Number(req.params.id), req.user, req.ip);
    setFlash(req, 'success', `Delivery ${delivery.delivery_number} dispatched. Stock has been issued.`);
    res.redirect(`/deliveries/${delivery.id}`);
  } catch (error) {
    next(error);
  }
}

function confirm(req, res, next) {
  try {
    const delivery = deliveryService.confirmDelivery(Number(req.params.id), req.user, req.ip);
    setFlash(req, 'success', `Delivery ${delivery.delivery_number} confirmed as delivered.`);
    res.redirect(`/deliveries/${delivery.id}`);
  } catch (error) {
    next(error);
  }
}

function exception(req, res, next) {
  try {
    const delivery = deliveryService.markException(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'warning', `Delivery ${delivery.delivery_number} marked with a delivery exception.`);
    res.redirect(`/deliveries/${delivery.id}`);
  } catch (error) {
    next(error);
  }
}

function resolve(req, res, next) {
  try {
    const delivery = deliveryService.resolveException(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(
      req,
      'success',
      delivery.status === 'delivered'
        ? `Delivery ${delivery.delivery_number} resolved as delivered.`
        : `Delivery ${delivery.delivery_number} resolved as cancelled; stock has been restored.`
    );
    res.redirect(`/deliveries/${delivery.id}`);
  } catch (error) {
    next(error);
  }
}

function cancel(req, res, next) {
  try {
    const delivery = deliveryService.cancelDelivery(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'success', `Delivery ${delivery.delivery_number} cancelled.`);
    res.redirect(`/deliveries/${delivery.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, newForm, create, show, dispatch, confirm, exception, resolve, cancel };
