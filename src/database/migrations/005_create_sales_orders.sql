CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'partially_fulfilled', 'partially_cancelled', 'fulfilled', 'cancelled')),
  subtotal REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  submitted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  line_total REAL NOT NULL,
  cancelled_quantity REAL NOT NULL DEFAULT 0 CHECK (cancelled_quantity >= 0),
  cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS order_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'cancelled', 'partially_cancelled')),
  reason TEXT,
  is_override INTEGER NOT NULL DEFAULT 0,
  acted_by INTEGER REFERENCES users(id),
  acted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON sales_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON sales_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_product ON sales_order_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_order_approvals_order ON order_approvals(order_id);
