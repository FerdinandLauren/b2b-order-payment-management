const dashboardService = require('../services/dashboard.service');
const { ROLES } = require('../utils/constants');

const ROLE_GUIDE = {
  sales_staff: {
    heading: 'Sales workspace',
    description:
      'Create customer orders, submit them for approval, and follow their progress through delivery and payment.',
    actions: [
      { label: 'View customers', href: '/customers' },
      { label: 'Create an order', href: '/orders/new' },
      { label: 'Track orders', href: '/orders' },
    ],
  },
  sales_supervisor: {
    heading: 'Sales supervision',
    description:
      'Review submitted orders, evaluate customer credit exposure, and release approved orders to the warehouse.',
    actions: [
      { label: 'Review approvals', href: '/approvals' },
      { label: 'View orders', href: '/orders' },
      { label: 'View customers', href: '/customers' },
    ],
  },
  warehouse_staff: {
    heading: 'Fulfillment workspace',
    description:
      'Monitor reserved inventory, prepare deliveries from approved orders, and confirm dispatch and delivery.',
    actions: [
      { label: 'Open deliveries', href: '/deliveries' },
      { label: 'Check inventory', href: '/inventory' },
      { label: 'Stock movements', href: '/inventory/movements' },
    ],
  },
  finance_staff: {
    heading: 'Finance workspace',
    description:
      'Issue invoices from delivered shipments, record customer payments, and keep receivables accurate.',
    actions: [
      { label: 'Generate invoice', href: '/invoices/new' },
      { label: 'Record a payment', href: '/payments/new' },
      { label: 'Monitor receivables', href: '/invoices?view=outstanding' },
    ],
  },
  management: {
    heading: 'Management overview',
    description:
      'Monitor order volume, receivables, credit overrides, and overall Order-to-Cash performance.',
    actions: [
      { label: 'View orders', href: '/orders' },
      { label: 'View receivables', href: '/invoices' },
      { label: 'Audit trail', href: '/audit' },
    ],
  },
  admin: {
    heading: 'Administration',
    description:
      'Maintain users, roles, master data, and system configuration. Administrative access does not grant business approvals.',
    actions: [
      { label: 'Manage users', href: '/users' },
      { label: 'Manage products', href: '/products' },
      { label: 'Audit trail', href: '/audit' },
    ],
  },
};

function index(req, res) {
  const role = req.user.role;
  const data = dashboardService.getDashboard(req.user, req.query);

  res.render('dashboard/index', {
    title: 'Dashboard',
    roleLabel: ROLES[role],
    guide: ROLE_GUIDE[role],
    ...data,
  });
}

module.exports = { index };
