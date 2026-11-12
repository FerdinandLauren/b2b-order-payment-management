const { getDb } = require('../config/database');
const paymentRepository = require('../repositories/payment.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const invoiceService = require('./invoice.service');
const customerRepository = require('../repositories/customer.repository');
const numberCounter = require('../repositories/number-counter.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { formatDocument } = require('../utils/numbering');
const { today } = require('../utils/time');

const PAYMENT_METHODS = ['cash', 'transfer', 'cheque', 'other'];
const ALLOCATABLE_INVOICE_STATUSES = ['issued', 'partially_paid'];

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function assertFinance(actor) {
  if (actor.role !== 'finance_staff') {
    throw new ApiError(403, 'Only Finance Staff can record and allocate payments.');
  }
}

function derivePaymentStatus(amount, allocated) {
  if (allocated >= amount - 0.005) return 'fully_allocated';
  if (allocated > 0.005) return 'partially_allocated';
  return 'recorded';
}

function normalizePaymentDate(value) {
  const paymentDate = String(value || today()).slice(0, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate) ||
    Number.isNaN(new Date(`${paymentDate}T00:00:00Z`).getTime())
  ) {
    throw new ApiError(400, 'Enter a valid payment date.');
  }
  return paymentDate;
}

function listPayments(filters = {}) {
  return paymentRepository.list(filters);
}

function getPaymentStats() {
  const payments = paymentRepository.list({});
  const totalReceived = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const unallocated = payments.reduce(
    (sum, payment) => sum + Number(payment.unallocated || 0),
    0
  );

  return {
    total: payments.length,
    totalReceived: roundMoney(totalReceived),
    unallocated: roundMoney(unallocated),
    fullyAllocatedCount: payments.filter((payment) => payment.status === 'fully_allocated').length,
    partiallyAllocatedCount: payments.filter(
      (payment) => payment.status === 'partially_allocated'
    ).length,
  };
}

function getCreateForm() {
  const currentDate = today();
  const customers = customerRepository.list({}).map((customer) => {
    const summary = customerRepository.summary(customer.id, currentDate);
    return {
      ...customer,
      outstanding: roundMoney(summary.outstanding),
    };
  });

  return { customers, paymentDate: currentDate };
}

function getPayment(id) {
  const payment = paymentRepository.findById(id);
  if (!payment) throw new ApiError(404, 'Payment not found.');

  const allocations = paymentRepository.findAllocations(id, today());
  const hasUnallocated = roundMoney(payment.unallocated) > 0.005;
  const openInvoices = hasUnallocated
    ? paymentRepository.listOpenInvoices(payment.customer_id, today())
    : [];

  return {
    payment,
    allocations,
    openInvoices,
    canAllocate: hasUnallocated && openInvoices.length > 0,
  };
}

function createPayment(body, actor, ipAddress) {
  assertFinance(actor);

  const customerId = Number(body.customerId);
  const customer = customerRepository.findById(customerId);
  if (!customer) throw new ApiError(400, 'Select a valid customer.');

  const amount = roundMoney(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Enter a payment amount greater than zero.');
  }

  const paymentDate = normalizePaymentDate(body.paymentDate);
  const method = String(body.method || '').trim();
  if (!PAYMENT_METHODS.includes(method)) {
    throw new ApiError(400, 'Select a valid payment method.');
  }

  const reference = String(body.reference || '').trim();
  if (reference.length > 100) {
    throw new ApiError(400, 'The payment reference is too long.');
  }
  const notes = String(body.notes || '').trim();
  if (notes.length > 500) {
    throw new ApiError(400, 'Payment notes are too long.');
  }

  const year = paymentDate.slice(0, 4);
  const db = getDb();

  const record = db.transaction(() => {
    const sequence = numberCounter.nextSequence('payment', year);
    const paymentNumber = formatDocument('PAY', sequence, year);

    const paymentId = paymentRepository.createPayment({
      paymentNumber,
      customerId: customer.id,
      paymentDate,
      amount,
      method,
      reference,
      notes,
      createdBy: actor.id,
    });

    auditService.record({
      userId: actor.id,
      action: 'payment_recorded',
      entityType: 'payment',
      entityId: paymentId,
      details: {
        paymentNumber,
        customer: customer.name,
        paymentDate,
        amount,
        method,
        reference: reference || null,
      },
      ipAddress,
    });

    return paymentId;
  });

  const paymentId = record();
  return getPayment(paymentId).payment;
}

function allocatePayment(id, body, actor, ipAddress) {
  assertFinance(actor);

  const invoiceIds = toArray(body.invoiceId);
  const amounts = toArray(body.amount);
  if (!invoiceIds.length || invoiceIds.length !== amounts.length) {
    throw new ApiError(400, 'Enter at least one allocation amount.');
  }

  const requested = [];
  const seen = new Set();
  for (let index = 0; index < invoiceIds.length; index += 1) {
    const invoiceId = Number(invoiceIds[index]);
    const amount = roundMoney(amounts[index]);
    if (!invoiceId || !amount) continue;
    if (amount < 0) {
      throw new ApiError(400, 'Allocation amounts cannot be negative.');
    }
    if (seen.has(invoiceId)) {
      throw new ApiError(400, 'Each invoice can only be allocated once per submission.');
    }
    seen.add(invoiceId);
    requested.push({ invoiceId, amount });
  }

  if (!requested.length) {
    throw new ApiError(400, 'Enter at least one allocation amount.');
  }

  const db = getDb();
  const allocate = db.transaction(() => {
    const payment = paymentRepository.findById(id);
    if (!payment) throw new ApiError(404, 'Payment not found.');

    let remaining = roundMoney(payment.unallocated);
    if (remaining <= 0.005) {
      throw new ApiError(400, 'This payment is already fully allocated.');
    }

    const applied = [];
    for (const request of requested) {
      const invoice = invoiceRepository.findById(request.invoiceId, today());
      if (!invoice) throw new ApiError(400, 'Select a valid invoice to allocate to.');

      if (invoice.customer_id !== payment.customer_id) {
        throw new ApiError(
          400,
          `Invoice ${invoice.invoice_number} belongs to a different customer.`
        );
      }
      if (!ALLOCATABLE_INVOICE_STATUSES.includes(invoice.status)) {
        throw new ApiError(
          400,
          `Invoice ${invoice.invoice_number} is not open for payment allocation.`
        );
      }

      const balance = roundMoney(invoice.balance);
      if (request.amount > balance + 0.005) {
        throw new ApiError(
          400,
          `Allocation to ${invoice.invoice_number} exceeds its outstanding balance.`
        );
      }
      if (request.amount > remaining + 0.005) {
        throw new ApiError(400, 'Allocations exceed the payment unallocated amount.');
      }

      paymentRepository.createAllocation(payment.id, invoice.id, request.amount);
      remaining = roundMoney(remaining - request.amount);
      applied.push({ invoiceNumber: invoice.invoice_number, amount: request.amount });
    }

    const totalAllocated = paymentRepository.allocatedTotal(payment.id);
    const nextStatus = derivePaymentStatus(Number(payment.amount), totalAllocated);
    paymentRepository.setStatus(payment.id, nextStatus);

    for (const request of requested) {
      invoiceService.refreshInvoiceStatus(request.invoiceId);
    }

    auditService.record({
      userId: actor.id,
      action: 'payment_allocated',
      entityType: 'payment',
      entityId: payment.id,
      details: {
        paymentNumber: payment.payment_number,
        customer: payment.customer_name,
        allocations: applied,
        unallocatedAfter: remaining,
        status: nextStatus,
      },
      ipAddress,
    });
  });

  allocate();
  return getPayment(id).payment;
}

module.exports = {
  PAYMENT_METHODS,
  derivePaymentStatus,
  listPayments,
  getPaymentStats,
  getCreateForm,
  getPayment,
  createPayment,
  allocatePayment,
};
