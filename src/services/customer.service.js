const { getDb } = require('../config/database');
const customerRepository = require('../repositories/customer.repository');
const numberCounter = require('../repositories/number-counter.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { formatDocument } = require('../utils/numbering');
const { today } = require('../utils/time');

function listCustomers(filters) {
  return customerRepository.list(filters);
}

function getCustomer(id) {
  const customer = customerRepository.findById(id);
  if (!customer) throw new ApiError(404, 'Customer not found.');

  return {
    customer,
    summary: customerRepository.summary(id, today()),
    recentOrders: customerRepository.recentOrders(id),
    recentInvoices: customerRepository.recentInvoices(id),
  };
}

function normalizeInput(input) {
  const name = String(input.name || '').trim();
  if (name.length < 2) throw new ApiError(400, 'Customer name is required.');

  const paymentTermsDays = Number(input.paymentTermsDays ?? 30);
  if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) {
    throw new ApiError(400, 'Payment terms must be between 0 and 365 days.');
  }

  const creditLimit = Number(input.creditLimit ?? 0);
  if (Number.isNaN(creditLimit) || creditLimit < 0) {
    throw new ApiError(400, 'Credit limit cannot be negative.');
  }

  return {
    name,
    address: String(input.address || '').trim() || null,
    city: String(input.city || '').trim() || null,
    phone: String(input.phone || '').trim() || null,
    email: String(input.email || '').trim().toLowerCase() || null,
    npwp: String(input.npwp || '').trim() || null,
    paymentTermsDays,
    creditLimit,
  };
}

function createCustomer(input, actor, ipAddress) {
  const data = normalizeInput(input);
  const db = getDb();

  const create = db.transaction(() => {
    let sequence = numberCounter.nextSequence('customer');
    let code = formatDocument('CUST', sequence);
    while (customerRepository.findByCode(code)) {
      sequence = numberCounter.nextSequence('customer');
      code = formatDocument('CUST', sequence);
    }
    const customer = customerRepository.create({ ...data, code });

    auditService.record({
      userId: actor.id,
      action: 'customer_created',
      entityType: 'customer',
      entityId: customer.id,
      details: { code: customer.code, name: customer.name },
      ipAddress,
    });

    return customer;
  });

  return create();
}

function updateCustomer(id, input, actor, ipAddress) {
  const existing = customerRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Customer not found.');

  const data = normalizeInput(input);
  const db = getDb();

  const update = db.transaction(() => {
    const customer = customerRepository.update(id, data);
    auditService.record({
      userId: actor.id,
      action: 'customer_updated',
      entityType: 'customer',
      entityId: customer.id,
      details: { code: customer.code, name: customer.name },
      ipAddress,
    });
    return customer;
  });

  return update();
}

function setCustomerStatus(id, status, actor, ipAddress) {
  if (!['active', 'inactive'].includes(status)) {
    throw new ApiError(400, 'Invalid status.');
  }

  const existing = customerRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Customer not found.');

  const db = getDb();
  const change = db.transaction(() => {
    const customer = customerRepository.setStatus(id, status);
    auditService.record({
      userId: actor.id,
      action: 'customer_status_changed',
      entityType: 'customer',
      entityId: customer.id,
      details: { status },
      ipAddress,
    });
    return customer;
  });

  return change();
}

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, setCustomerStatus };
