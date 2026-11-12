const { getDb } = require('../config/database');
const invoiceRepository = require('../repositories/invoice.repository');
const numberCounter = require('../repositories/number-counter.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { formatDocument } = require('../utils/numbering');
const { now, today, addDays, daysBetween } = require('../utils/time');

const FINANCE_ROLES = ['finance_staff'];
const VOIDABLE_STATUSES = ['draft', 'issued'];

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function assertFinance(actor) {
  if (!FINANCE_ROLES.includes(actor.role)) {
    throw new ApiError(403, 'Only Finance Staff can generate, issue, or void invoices.');
  }
}

function deriveStatus(currentStatus, total, allocated) {
  if (currentStatus === 'void' || currentStatus === 'draft') return currentStatus;
  if (allocated >= total - 0.005) return 'paid';
  if (allocated > 0.005) return 'partially_paid';
  return 'issued';
}

function listInvoices(filters = {}) {
  const currentDate = today();
  return invoiceRepository.list(
    { ...filters, overdueDate: currentDate },
    currentDate
  );
}

function getInvoiceStats() {
  const currentDate = today();
  const invoices = invoiceRepository.list({}, currentDate);
  const outstanding = invoices
    .filter((invoice) => ['issued', 'partially_paid'].includes(invoice.status))
    .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  const collected = invoices.reduce((sum, invoice) => sum + Number(invoice.allocated || 0), 0);

  return {
    total: invoices.length,
    outstanding: roundMoney(outstanding),
    collected: roundMoney(collected),
    overdueCount: invoices.filter((invoice) => invoice.is_overdue).length,
    overdueAmount: roundMoney(
      invoices
        .filter((invoice) => invoice.is_overdue)
        .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0)
    ),
    draftCount: invoices.filter((invoice) => invoice.status === 'draft').length,
    paidCount: invoices.filter((invoice) => invoice.status === 'paid').length,
  };
}

function getEligibleDeliveries() {
  return invoiceRepository.listEligibleDeliveries();
}

function getInvoice(id) {
  const currentDate = today();
  const invoice = invoiceRepository.findById(id, currentDate);
  if (!invoice) throw new ApiError(404, 'Invoice not found.');

  return {
    invoice,
    lines: invoiceRepository.findLines(id),
    allocations: invoiceRepository.listAllocations(id),
    isOverdue: Boolean(invoice.is_overdue),
    daysOverdue: invoice.is_overdue ? daysBetween(invoice.due_date, currentDate) : 0,
  };
}

function getCreateForm(deliveryId) {
  const delivery = invoiceRepository.findBillableDelivery(deliveryId);
  if (!delivery) throw new ApiError(404, 'Delivery not found.');
  if (delivery.status !== 'delivered') {
    throw new ApiError(400, 'Only delivered shipments can be invoiced.');
  }
  if (invoiceRepository.hasActiveInvoiceForDelivery(deliveryId)) {
    throw new ApiError(400, 'This delivery already has an invoice.');
  }

  const lines = invoiceRepository.findBillableLines(deliveryId);
  if (!lines.length) {
    throw new ApiError(400, 'This delivery has no uninvoiced quantities.');
  }

  const invoiceDate = today();
  return {
    delivery,
    lines,
    invoiceDate,
    dueDate: addDays(invoiceDate, delivery.payment_terms_days),
    subtotal: roundMoney(
      lines.reduce((sum, line) => sum + line.billable_quantity * line.unit_price, 0)
    ),
  };
}

function normalizeInvoiceDate(value) {
  const invoiceDate = String(value || today()).slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) ||
    Number.isNaN(new Date(`${invoiceDate}T00:00:00Z`).getTime())
  ) {
    throw new ApiError(400, 'Enter a valid invoice date.');
  }
  return invoiceDate;
}

function createInvoice(body, actor, ipAddress) {
  assertFinance(actor);

  const deliveryId = Number(body.deliveryId);
  const delivery = invoiceRepository.findBillableDelivery(deliveryId);
  if (!delivery) throw new ApiError(400, 'Select a valid delivered shipment.');
  if (delivery.status !== 'delivered') {
    throw new ApiError(400, 'Only delivered shipments can be invoiced.');
  }

  const invoiceDate = normalizeInvoiceDate(body.invoiceDate);
  const year = invoiceDate.slice(0, 4);
  const db = getDb();

  const create = db.transaction(() => {
    if (invoiceRepository.hasActiveInvoiceForDelivery(deliveryId)) {
      throw new ApiError(400, 'This delivery already has an invoice.');
    }

    const billableLines = invoiceRepository.findBillableLines(deliveryId);
    if (!billableLines.length) {
      throw new ApiError(400, 'This delivery has no uninvoiced quantities.');
    }

    const lines = billableLines.map((line) => ({
      deliveryLineId: line.delivery_line_id,
      productId: line.product_id,
      productName: line.product_name,
      quantity: Number(line.billable_quantity),
      unitPrice: Number(line.unit_price),
      lineTotal: roundMoney(line.billable_quantity * line.unit_price),
    }));
    const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const dueDate = addDays(invoiceDate, delivery.payment_terms_days);

    const sequence = numberCounter.nextSequence('invoice', year);
    const invoiceNumber = formatDocument('INV', sequence, year);

    const invoiceId = invoiceRepository.createInvoice(
      {
        invoiceNumber,
        customerId: delivery.customer_id,
        orderId: delivery.order_id,
        deliveryId: delivery.id,
        invoiceDate,
        dueDate,
        subtotal,
        total: subtotal,
        createdBy: actor.id,
      },
      lines
    );

    auditService.record({
      userId: actor.id,
      action: 'invoice_generated',
      entityType: 'invoice',
      entityId: invoiceId,
      details: {
        invoiceNumber,
        deliveryNumber: delivery.delivery_number,
        orderNumber: delivery.order_number,
        customer: delivery.customer_name,
        invoiceDate,
        dueDate,
        total: subtotal,
        lines: lines.map((line) => ({ product: line.productName, quantity: line.quantity })),
      },
      ipAddress,
    });

    return invoiceId;
  });

  const invoiceId = create();
  return getInvoice(invoiceId).invoice;
}

function issueInvoice(id, actor, ipAddress) {
  assertFinance(actor);
  const invoice = invoiceRepository.findById(id, today());
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  if (invoice.status !== 'draft') {
    throw new ApiError(400, 'Only draft invoices can be issued.');
  }
  if (invoice.delivery_status !== 'delivered') {
    throw new ApiError(400, 'The source shipment is not delivered.');
  }

  const db = getDb();
  const issue = db.transaction(() => {
    invoiceRepository.setStatus(id, 'issued', { issuedAt: now() });
    auditService.record({
      userId: actor.id,
      action: 'invoice_issued',
      entityType: 'invoice',
      entityId: id,
      details: {
        invoiceNumber: invoice.invoice_number,
        customer: invoice.customer_name,
        total: invoice.total,
        dueDate: invoice.due_date,
      },
      ipAddress,
    });
  });

  issue();
  return getInvoice(id).invoice;
}

function voidInvoice(id, body, actor, ipAddress) {
  assertFinance(actor);
  const invoice = invoiceRepository.findById(id, today());
  if (!invoice) throw new ApiError(404, 'Invoice not found.');
  if (!VOIDABLE_STATUSES.includes(invoice.status)) {
    throw new ApiError(
      400,
      'This invoice cannot be voided once payments have been allocated to it.'
    );
  }

  const reason = String(body.reason || '').trim();
  if (reason.length < 3) {
    throw new ApiError(400, 'Provide a void reason of at least 3 characters.');
  }
  if (invoiceRepository.countAllocations(id) > 0) {
    throw new ApiError(400, 'This invoice has payment allocations and cannot be voided.');
  }

  const db = getDb();
  const voidInvoiceTransaction = db.transaction(() => {
    invoiceRepository.setStatus(id, 'void', { voidedAt: now(), voidReason: reason });
    invoiceRepository.resetDeliveryInvoiced(invoice.delivery_id);

    auditService.record({
      userId: actor.id,
      action: 'invoice_voided',
      entityType: 'invoice',
      entityId: id,
      details: {
        invoiceNumber: invoice.invoice_number,
        deliveryNumber: invoice.delivery_number,
        orderNumber: invoice.order_number,
        reason,
        total: invoice.total,
      },
      ipAddress,
    });
  });

  voidInvoiceTransaction();
  return getInvoice(id).invoice;
}

function refreshInvoiceStatus(invoiceId) {
  const currentDate = today();
  const invoice = invoiceRepository.findById(invoiceId, currentDate);
  if (!invoice || invoice.status === 'void' || invoice.status === 'draft') return invoice;

  const allocated = invoiceRepository.allocatedTotal(invoiceId);
  const nextStatus = deriveStatus(invoice.status, Number(invoice.total), allocated);
  if (nextStatus !== invoice.status) {
    invoiceRepository.setStatus(invoiceId, nextStatus);
  }
  return invoiceRepository.findById(invoiceId, currentDate);
}

module.exports = {
  listInvoices,
  getInvoiceStats,
  getEligibleDeliveries,
  getInvoice,
  getCreateForm,
  createInvoice,
  issueInvoice,
  voidInvoice,
  deriveStatus,
  refreshInvoiceStatus,
};
