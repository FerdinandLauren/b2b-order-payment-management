CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_number TEXT NOT NULL UNIQUE,
  order_id INTEGER NOT NULL REFERENCES sales_orders(id),
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'dispatched', 'delivered', 'delivery_exception', 'cancelled')),
  notes TEXT,
  exception_reason TEXT,
  created_by INTEGER REFERENCES users(id),
  dispatched_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  order_line_id INTEGER NOT NULL REFERENCES sales_order_lines(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  invoiced_quantity REAL NOT NULL DEFAULT 0 CHECK (invoiced_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_number ON deliveries(delivery_number);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_delivery ON delivery_lines(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_order_line ON delivery_lines(order_line_id);
