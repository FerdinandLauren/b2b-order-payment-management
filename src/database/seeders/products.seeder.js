const { now } = require('../../utils/time');

const CATEGORIES = ['Building Materials', 'Industrial Supplies', 'Tools & Hardware'];

const PRODUCTS = [
  { sku: 'SEM-50', name: 'Semen Portland 50 kg', category: 'Building Materials', unit: 'bag', unit_price: 68000, on_hand: 700 },
  { sku: 'PSR-BET', name: 'Pasir Beton', category: 'Building Materials', unit: 'unit', unit_price: 275000, on_hand: 120 },
  { sku: 'BSP-12', name: 'Batu Split 1-2', category: 'Building Materials', unit: 'unit', unit_price: 340000, on_hand: 90 },
  { sku: 'BTR-MRH', name: 'Bata Merah', category: 'Building Materials', unit: 'pcs', unit_price: 950, on_hand: 5000 },
  { sku: 'HBL-075', name: 'Bata Ringan Hebel 7.5 cm', category: 'Building Materials', unit: 'pcs', unit_price: 6800, on_hand: 850 },
  { sku: 'BSI-10', name: 'Besi Beton 10 mm', category: 'Building Materials', unit: 'pcs', unit_price: 78500, on_hand: 600 },
  { sku: 'BSI-12', name: 'Besi Beton 12 mm', category: 'Building Materials', unit: 'pcs', unit_price: 112000, on_hand: 420 },
  { sku: 'KWT-BTN', name: 'Kawat Beton', category: 'Building Materials', unit: 'roll', unit_price: 47000, on_hand: 150 },
  { sku: 'TPL-09', name: 'Triplek 9 mm', category: 'Building Materials', unit: 'pcs', unit_price: 125000, on_hand: 260 },
  { sku: 'MTR-40', name: 'Semen Mortar 40 kg', category: 'Building Materials', unit: 'bag', unit_price: 84000, on_hand: 300 },
  { sku: 'CAT-25', name: 'Cat Tembok Interior 25 kg', category: 'Industrial Supplies', unit: 'pcs', unit_price: 315000, on_hand: 140 },
  { sku: 'PIP-3', name: 'Pipa PVC 3 inch', category: 'Industrial Supplies', unit: 'pcs', unit_price: 64000, on_hand: 380 },
  { sku: 'LMP-PVC', name: 'Lem Pipa PVC 100 gr', category: 'Industrial Supplies', unit: 'pcs', unit_price: 19000, on_hand: 220 },
  { sku: 'HLM-PRJ', name: 'Helm Proyek', category: 'Tools & Hardware', unit: 'pcs', unit_price: 56000, on_hand: 90 },
  { sku: 'SRG-KRJ', name: 'Sarung Tangan Kerja', category: 'Tools & Hardware', unit: 'set', unit_price: 16500, on_hand: 400 },
];

module.exports = function seedProducts(db) {
  const timestamp = now();
  const insertCategory = db.prepare(
    'INSERT INTO product_categories (name, created_at) VALUES (?, ?)'
  );
  const categoryIds = {};

  for (const name of CATEGORIES) {
    const result = insertCategory.run(name, timestamp);
    categoryIds[name] = Number(result.lastInsertRowid);
  }

  const insertProduct = db.prepare(`
    INSERT INTO products (sku, name, category_id, unit, unit_price, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `);

  for (const product of PRODUCTS) {
    insertProduct.run(
      product.sku,
      product.name,
      categoryIds[product.category],
      product.unit,
      product.unit_price,
      timestamp,
      timestamp
    );
  }

  return PRODUCTS.length;
};

module.exports.CATEGORIES = CATEGORIES;
module.exports.PRODUCTS = PRODUCTS;
