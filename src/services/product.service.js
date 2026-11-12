const { getDb } = require('../config/database');
const productRepository = require('../repositories/product.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const numberCounter = require('../repositories/number-counter.repository');
const auditService = require('./audit.service');
const ApiError = require('../utils/ApiError');
const { formatDocument } = require('../utils/numbering');
const { UNITS } = require('../utils/constants');

function listProducts(filters) {
  return productRepository.list(filters);
}

function getProduct(id) {
  const product = productRepository.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');

  return {
    product,
    balances: inventoryRepository
      .listBalances({})
      .filter((row) => row.product_id === Number(id)),
    movements: inventoryRepository.listMovements({ productId: id, limit: 20 }).rows,
  };
}

function normalizeInput(input) {
  const name = String(input.name || '').trim();
  if (name.length < 2) throw new ApiError(400, 'Product name is required.');

  const unit = String(input.unit || '');
  if (!UNITS.includes(unit)) throw new ApiError(400, 'Select a valid unit of measure.');

  const unitPrice = Number(input.unitPrice ?? 0);
  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    throw new ApiError(400, 'Unit price cannot be negative.');
  }

  const categoryId = input.categoryId ? Number(input.categoryId) : null;
  if (categoryId && !productRepository.findCategoryById(categoryId)) {
    throw new ApiError(400, 'Selected category does not exist.');
  }

  return { name, unit, unitPrice, categoryId };
}

function createProduct(input, actor, ipAddress) {
  const data = normalizeInput(input);
  const db = getDb();

  const create = db.transaction(() => {
    let sequence = numberCounter.nextSequence('product');
    let sku = formatDocument('PRD', sequence);
    while (productRepository.findBySku(sku)) {
      sequence = numberCounter.nextSequence('product');
      sku = formatDocument('PRD', sequence);
    }
    const product = productRepository.create({ ...data, sku });

    auditService.record({
      userId: actor.id,
      action: 'product_created',
      entityType: 'product',
      entityId: product.id,
      details: { sku: product.sku, name: product.name },
      ipAddress,
    });

    return product;
  });

  return create();
}

function updateProduct(id, input, actor, ipAddress) {
  const existing = productRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Product not found.');

  const data = normalizeInput(input);
  const db = getDb();

  const update = db.transaction(() => {
    const product = productRepository.update(id, data);
    auditService.record({
      userId: actor.id,
      action: 'product_updated',
      entityType: 'product',
      entityId: product.id,
      details: { sku: product.sku, name: product.name },
      ipAddress,
    });
    return product;
  });

  return update();
}

function setProductStatus(id, status, actor, ipAddress) {
  if (!['active', 'inactive'].includes(status)) {
    throw new ApiError(400, 'Invalid status.');
  }

  const existing = productRepository.findById(id);
  if (!existing) throw new ApiError(404, 'Product not found.');

  const db = getDb();
  const change = db.transaction(() => {
    const product = productRepository.setStatus(id, status);
    auditService.record({
      userId: actor.id,
      action: 'product_status_changed',
      entityType: 'product',
      entityId: product.id,
      details: { status },
      ipAddress,
    });
    return product;
  });

  return change();
}

/* Categories */
function listCategories() {
  return productRepository.listCategories();
}

function createCategory(name, actor, ipAddress) {
  const value = String(name || '').trim();
  if (value.length < 2 || value.length > 60) {
    throw new ApiError(400, 'Category name must be 2-60 characters.');
  }
  if (productRepository.findCategoryByName(value)) {
    throw new ApiError(409, 'That category already exists.');
  }

  const db = getDb();
  const create = db.transaction(() => {
    const category = productRepository.createCategory(value);
    auditService.record({
      userId: actor.id,
      action: 'category_created',
      entityType: 'category',
      entityId: category.id,
      details: { name: category.name },
      ipAddress,
    });
    return category;
  });

  return create();
}

function renameCategory(id, name, actor, ipAddress) {
  const existing = productRepository.findCategoryById(id);
  if (!existing) throw new ApiError(404, 'Category not found.');

  const value = String(name || '').trim();
  if (value.length < 2 || value.length > 60) {
    throw new ApiError(400, 'Category name must be 2-60 characters.');
  }

  const duplicate = productRepository.findCategoryByName(value);
  if (duplicate && duplicate.id !== Number(id)) {
    throw new ApiError(409, 'Another category already uses that name.');
  }

  const db = getDb();
  const rename = db.transaction(() => {
    const category = productRepository.renameCategory(id, value);
    auditService.record({
      userId: actor.id,
      action: 'category_renamed',
      entityType: 'category',
      entityId: category.id,
      details: { name: category.name },
      ipAddress,
    });
    return category;
  });

  return rename();
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  setProductStatus,
  listCategories,
  createCategory,
  renameCategory,
};
