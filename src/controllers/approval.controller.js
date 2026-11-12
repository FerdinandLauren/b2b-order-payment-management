const approvalService = require('../services/approval.service');
const { setFlash } = require('../middleware/flash.middleware');

function index(req, res) {
  res.render('approvals/index', {
    title: 'Approval queue',
    queue: approvalService.listQueue(),
  });
}

function show(req, res, next) {
  try {
    const data = approvalService.getReview(Number(req.params.id), req.user);
    res.render('approvals/show', {
      title: `Review ${data.order.order_number}`,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}

function approve(req, res, next) {
  try {
    const order = approvalService.approveOrder(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'success', `Sales order ${order.order_number} approved and stock reserved.`);
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    next(error);
  }
}

function reject(req, res, next) {
  try {
    const order = approvalService.rejectOrder(Number(req.params.id), req.body, req.user, req.ip);
    setFlash(req, 'success', `Sales order ${order.order_number} rejected.`);
    res.redirect(`/orders/${order.id}`);
  } catch (error) {
    next(error);
  }
}

module.exports = { index, show, approve, reject };
