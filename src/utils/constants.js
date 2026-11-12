const ROLES = {
  sales_staff: 'Sales Staff',
  sales_supervisor: 'Sales Supervisor',
  warehouse_staff: 'Warehouse Staff',
  finance_staff: 'Finance Staff',
  management: 'Management',
  admin: 'Admin',
};

const ROLE_LIST = Object.keys(ROLES);

const ORDER_STATUS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  partially_fulfilled: 'Partially Fulfilled',
  partially_cancelled: 'Partially Cancelled',
  fulfilled: 'Fulfilled',
  cancelled: 'Cancelled',
};

const DELIVERY_STATUS = {
  draft: 'Draft',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  delivery_exception: 'Delivery Exception',
  cancelled: 'Cancelled',
};

const INVOICE_STATUS = {
  draft: 'Draft',
  issued: 'Issued',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  void: 'Void',
};

const PAYMENT_STATUS = {
  recorded: 'Recorded',
  partially_allocated: 'Partially Allocated',
  fully_allocated: 'Fully Allocated',
};

const PAYMENT_METHOD = {
  cash: 'Cash',
  transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

const MOVEMENT_TYPE = {
  receipt: 'Goods Receipt',
  dispatch: 'Dispatch',
  dispatch_reversal: 'Dispatch Reversal',
  adjustment_in: 'Adjustment In',
  adjustment_out: 'Adjustment Out',
  reservation: 'Stock Reservation',
  reservation_release: 'Reservation Release',
};

const UNITS = ['pcs', 'box', 'kg', 'ltr', 'unit', 'bag', 'roll', 'set'];

const OPEN_ORDER_STATUSES = ['approved', 'partially_fulfilled'];
const CANCELLABLE_ORDER_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'partially_fulfilled',
  'partially_cancelled',
];

const STATUS_BADGE = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'info',
  rejected: 'danger',
  partially_fulfilled: 'info',
  partially_cancelled: 'warning',
  fulfilled: 'success',
  cancelled: 'danger',
  dispatched: 'info',
  delivered: 'success',
  delivery_exception: 'danger',
  issued: 'info',
  partially_paid: 'warning',
  paid: 'success',
  void: 'danger',
  recorded: 'neutral',
  partially_allocated: 'warning',
  fully_allocated: 'success',
  active: 'success',
  inactive: 'neutral',
  overdue: 'danger',
};

const ENTITY_PREFIX = {
  customer: 'CUST',
  product: 'PRD',
  sales_order: 'SO',
  delivery: 'DN',
  invoice: 'INV',
  payment: 'PAY',
};

module.exports = {
  ROLES,
  ROLE_LIST,
  ORDER_STATUS,
  DELIVERY_STATUS,
  INVOICE_STATUS,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  MOVEMENT_TYPE,
  UNITS,
  OPEN_ORDER_STATUSES,
  CANCELLABLE_ORDER_STATUSES,
  STATUS_BADGE,
  ENTITY_PREFIX,
};
