# Technical Design Document
## B2B Order & Payment Management System

**Version:** 1.0
**Date:** 2026-11-12
**Status:** Draft for Approval
**Related Documents:** PRD.md, PLAN.md, DESIGN.md

---

## 1. Purpose and Scope

This document translates the business requirements (PRD.md) and the conceptual design (DESIGN.md) into a technical implementation design for the MVP.

It covers:

- Technology stack and architecture.
- Database schema.
- Application layers and module structure.
- Business logic, status transitions, and business rules.
- Role-based access control.
- Route design.
- UI structure.
- Validation, error handling, and audit.
- Testing strategy.

**Confirmed decisions (2026-11-12):**

| Decision | Choice |
|---|---|
| Tech stack | Node.js + Express + SQLite (better-sqlite3) + EJS |
| Architecture | Layered modular: routes → controllers → services → repositories → models |
| Role model | 6 roles from PRD.md (authoritative) |
| Credit limit | Warning + supervisor override with mandatory justification |
| Invoicing | Per delivery; at most one active (non-void) invoice per delivery |
| Payments | Multiple invoice allocations per payment; partial payments; unallocated amount retained; no reversal in MVP |
| Tax | Outside MVP; schema kept extensible |
| Scope | Full O2C + Management Dashboard + Audit Trail |

---

## 2. Technology Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js LTS | Single language, large ecosystem |
| Web framework | Express.js | Minimal, mature, easy to structure |
| Database | SQLite (file-based) | Zero-config, transactional, easy to demo |
| DB driver | better-sqlite3 | Synchronous API, transactions, no ORM overhead |
| Templating | EJS | Server-rendered, no build step |
| Styling | Custom CSS (design tokens) | No framework overhead, full control |
| Auth | express-session + bcryptjs | Simple session-based auth |
| Validation | express-validator | Standard declarative input validation |
| Security headers | helmet | Small, standard |
| Testing | Jest + Supertest | Unit + HTTP integration testing |
| Env | dotenv | Environment configuration |

**No ORM, no SPA framework, no build tooling.** The application is a server-rendered modular monolith.

---

## 3. Architecture

### 3.1 Layered Architecture

```
HTTP Request
    │
    ▼
Route (routes/)            → defines endpoints, applies middleware
    │
    ▼
Middleware (middleware/)   → auth, RBAC, validation, error handling
    │
    ▼
Controller (controllers/)  → request/response handling, calls service
    │
    ▼
Service (services/)        → business logic, business rules, transactions
    │
    ▼
Repository (repositories/) → data access, SQL queries
    │
    ▼
Database (SQLite)
```

**Layer rules:**

- Routes never contain business logic.
- Controllers never contain SQL.
- Services own business rules and transaction boundaries.
- Repositories own all SQL and are the only layer that touches the database.
- Validation happens at two levels: input validation (route middleware) and business-rule validation (services).

### 3.2 Transaction Integrity

All multi-write operations run inside a SQLite transaction (`better-sqlite3` `db.transaction()`). If any step fails, the transaction rolls back. This applies to:

- Order approval + inventory reservation.
- Delivery dispatch + stock decrement.
- Invoice generation + delivery-line update.
- Payment recording + allocation + invoice status update.
- Order cancellation + reservation release.

---

## 4. Folder Structure

```text
b2b-order-payment-management/
├── PRD.md
├── PLAN.md
├── DESIGN.md
├── README.md
├── docs/
│   ├── technical-design.md
│   ├── business-process/
│   │   ├── as-is-process.md
│   │   └── to-be-process.md
│   ├── requirements/
│   │   ├── user-stories.md
│   │   ├── business-rules.md
│   │   └── traceability-matrix.md
│   ├── testing/
│   │   ├── test-plan.md
│   │   └── uat-scenarios.md
│   └── decisions/
│       └── architecture-decisions.md
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   │   ├── env.js
│   │   └── database.js
│   ├── database/
│   │   ├── migrate.js
│   │   ├── seed.js
│   │   ├── migrations/
│   │   │   ├── 001_create_users.sql
│   │   │   ├── 002_create_customers.sql
│   │   │   ├── 003_create_products.sql
│   │   │   ├── 004_create_inventory.sql
│   │   │   ├── 005_create_sales_orders.sql
│   │   │   ├── 006_create_deliveries.sql
│   │   │   ├── 007_create_invoices.sql
│   │   │   ├── 008_create_payments.sql
│   │   │   └── 009_create_audit_and_settings.sql
│   │   └── seeders/
│   │       ├── users.seeder.js
│   │       ├── customers.seeder.js
│   │       ├── products.seeder.js
│   │       └── transactions.seeder.js
│   ├── models/
│   │   ├── user.model.js
│   │   ├── customer.model.js
│   │   ├── product.model.js
│   │   ├── warehouse.model.js
│   │   ├── inventory.model.js
│   │   ├── sales-order.model.js
│   │   ├── delivery.model.js
│   │   ├── invoice.model.js
│   │   ├── payment.model.js
│   │   └── audit-log.model.js
│   ├── repositories/
│   │   ├── user.repository.js
│   │   ├── customer.repository.js
│   │   ├── product.repository.js
│   │   ├── inventory.repository.js
│   │   ├── sales-order.repository.js
│   │   ├── delivery.repository.js
│   │   ├── invoice.repository.js
│   │   ├── payment.repository.js
│   │   └── audit.repository.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── customer.service.js
│   │   ├── product.service.js
│   │   ├── inventory.service.js
│   │   ├── order.service.js
│   │   ├── approval.service.js
│   │   ├── delivery.service.js
│   │   ├── invoice.service.js
│   │   ├── payment.service.js
│   │   ├── dashboard.service.js
│   │   └── audit.service.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── customer.controller.js
│   │   ├── product.controller.js
│   │   ├── inventory.controller.js
│   │   ├── order.controller.js
│   │   ├── approval.controller.js
│   │   ├── delivery.controller.js
│   │   ├── invoice.controller.js
│   │   ├── payment.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── user.controller.js
│   │   └── audit.controller.js
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   ├── customer.routes.js
│   │   ├── product.routes.js
│   │   ├── inventory.routes.js
│   │   ├── order.routes.js
│   │   ├── approval.routes.js
│   │   ├── delivery.routes.js
│   │   ├── invoice.routes.js
│   │   ├── payment.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── user.routes.js
│   │   └── audit.routes.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js
│   │   ├── validate.middleware.js
│   │   ├── error.middleware.js
│   │   └── csrf.middleware.js
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── customer.validator.js
│   │   ├── product.validator.js
│   │   ├── order.validator.js
│   │   ├── delivery.validator.js
│   │   ├── invoice.validator.js
│   │   └── payment.validator.js
│   ├── utils/
│   │   ├── constants.js
│   │   ├── format.js
│   │   ├── numbering.js
│   │   ├── ApiError.js
│   │   └── logger.js
│   ├── views/
│   │   ├── layouts/
│   │   │   └── main.ejs
│   │   ├── partials/
│   │   │   ├── header.ejs
│   │   │   ├── sidebar.ejs
│   │   │   ├── footer.ejs
│   │   │   ├── status-badge.ejs
│   │   │   └── flash.ejs
│   │   ├── auth/
│   │   │   └── login.ejs
│   │   ├── dashboard/
│   │   │   └── index.ejs
│   │   ├── customers/
│   │   ├── products/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── approvals/
│   │   ├── deliveries/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── users/
│   │   └── audit/
│   └── public/
│       ├── css/
│       │   ├── reset.css
│       │   ├── tokens.css
│       │   ├── components.css
│       │   └── layout.css
│       ├── js/
│       │   ├── app.js
│       │   └── order-form.js
│       └── images/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── database/
│   └── b2b.db
├── .env
├── .env.example
├── .gitignore
├── package.json
└── jest.config.js
```

---

## 5. Database Schema

### 5.1 Entity Relationship Overview

```text
users ──< audit_logs
users ──< sales_orders (created_by)
users ──< order_approvals (acted_by)
users ──< deliveries (created_by)
users ──< invoices (created_by)
users ──< payments (created_by)
users ──< stock_movements (created_by)

customers ──< sales_orders ──< sales_order_lines >── products
sales_orders ──< deliveries ──< delivery_lines >── sales_order_lines
deliveries ──< invoices ──< invoice_lines >── delivery_lines
customers ──< invoices
customers ──< payments ──< payment_allocations >── invoices

warehouses ──< inventory_balances >── products
warehouses ──< stock_movements
products ──< stock_movements
```

### 5.2 Tables

**users**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK, AUTOINCREMENT |
| username | TEXT | UNIQUE, NOT NULL |
| password_hash | TEXT | NOT NULL |
| full_name | TEXT | NOT NULL |
| role | TEXT | NOT NULL, CHECK (`sales_staff`, `sales_supervisor`, `warehouse_staff`, `finance_staff`, `management`, `admin`) |
| status | TEXT | NOT NULL, default `active` |
| created_at | TEXT | NOT NULL |
| updated_at | TEXT | NOT NULL |

**customers**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| code | TEXT | UNIQUE, NOT NULL (`CUST-NNNN`) |
| name | TEXT | NOT NULL |
| address | TEXT | |
| city | TEXT | |
| phone | TEXT | |
| email | TEXT | |
| npwp | TEXT | |
| payment_terms_days | INTEGER | NOT NULL, default 30 |
| credit_limit | REAL | NOT NULL, default 0 |
| status | TEXT | NOT NULL, default `active` |
| created_at | TEXT | |
| updated_at | TEXT | |

**product_categories**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| name | TEXT | NOT NULL |
| created_at | TEXT | |

**products**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| sku | TEXT | UNIQUE, NOT NULL (`PRD-NNNN`) |
| name | TEXT | NOT NULL |
| category_id | INTEGER | FK → product_categories |
| unit | TEXT | NOT NULL (`pcs`, `box`, `kg`, `ltr`, `unit`) |
| unit_price | REAL | NOT NULL, default 0 |
| status | TEXT | NOT NULL, default `active` |
| created_at | TEXT | |
| updated_at | TEXT | |

**warehouses**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| code | TEXT | UNIQUE, NOT NULL |
| name | TEXT | NOT NULL |
| address | TEXT | |
| status | TEXT | NOT NULL, default `active` |
| created_at | TEXT | |

**inventory_balances**

| Column | Type | Constraints |
|---|---|---|
| warehouse_id | INTEGER | FK → warehouses, PK (composite) |
| product_id | INTEGER | FK → products, PK (composite) |
| on_hand | REAL | NOT NULL, default 0 |
| reserved | REAL | NOT NULL, default 0 |

**stock_movements**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| product_id | INTEGER | FK → products, NOT NULL |
| warehouse_id | INTEGER | FK → warehouses, NOT NULL |
| movement_type | TEXT | NOT NULL (`receipt`, `dispatch`, `adjustment_in`, `adjustment_out`, `reservation`, `reservation_release`) |
| quantity | REAL | NOT NULL (signed) |
| reference_type | TEXT | (`sales_order`, `delivery`, `adjustment`) |
| reference_id | INTEGER | |
| reason | TEXT | |
| created_by | INTEGER | FK → users |
| created_at | TEXT | NOT NULL |

**sales_orders**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| order_number | TEXT | UNIQUE, NOT NULL (`SO-YYYY-NNNN`) |
| customer_id | INTEGER | FK → customers, NOT NULL |
| order_date | TEXT | NOT NULL |
| status | TEXT | NOT NULL (`draft`, `submitted`, `approved`, `rejected`, `partially_fulfilled`, `partially_cancelled`, `fulfilled`, `cancelled`) |
| subtotal | REAL | NOT NULL, default 0 |
| total | REAL | NOT NULL, default 0 |
| currency | TEXT | NOT NULL, default `IDR` |
| notes | TEXT | |
| created_by | INTEGER | FK → users |
| submitted_at | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

**sales_order_lines**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| order_id | INTEGER | FK → sales_orders, NOT NULL |
| product_id | INTEGER | FK → products, NOT NULL |
| quantity | REAL | NOT NULL |
| unit_price | REAL | NOT NULL |
| line_total | REAL | NOT NULL |
| cancelled_quantity | REAL | NOT NULL, default 0, CHECK ≥ 0 |
| cancellation_reason | TEXT | required when `cancelled_quantity > 0` |

**order_approvals**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| order_id | INTEGER | FK → sales_orders, NOT NULL |
| action | TEXT | NOT NULL (`submitted`, `approved`, `rejected`, `cancelled`, `partially_cancelled`) |
| reason | TEXT | required for `rejected` / `cancelled` / override |
| is_override | INTEGER | NOT NULL, default 0 |
| acted_by | INTEGER | FK → users |
| acted_at | TEXT | NOT NULL |

**deliveries**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| delivery_number | TEXT | UNIQUE, NOT NULL (`DN-YYYY-NNNN`) |
| order_id | INTEGER | FK → sales_orders, NOT NULL |
| delivery_date | TEXT | NOT NULL |
| status | TEXT | NOT NULL (`draft`, `dispatched`, `delivered`, `delivery_exception`, `cancelled`) |
| notes | TEXT | |
| created_by | INTEGER | FK → users |
| dispatched_at | TEXT | |
| delivered_at | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

**delivery_lines**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| delivery_id | INTEGER | FK → deliveries, NOT NULL |
| order_line_id | INTEGER | FK → sales_order_lines, NOT NULL |
| product_id | INTEGER | FK → products, NOT NULL |
| quantity | REAL | NOT NULL |
| invoiced_quantity | REAL | NOT NULL, default 0 |

**invoices**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| invoice_number | TEXT | UNIQUE, NOT NULL (`INV-YYYY-NNNN`) |
| customer_id | INTEGER | FK → customers, NOT NULL |
| order_id | INTEGER | FK → sales_orders, NOT NULL |
| delivery_id | INTEGER | FK → deliveries, NOT NULL |
| invoice_date | TEXT | NOT NULL |
| due_date | TEXT | NOT NULL |
| status | TEXT | NOT NULL (`draft`, `issued`, `partially_paid`, `paid`, `void`) |
| subtotal | REAL | NOT NULL, default 0 |
| tax_rate | REAL | NOT NULL, default 0 (reserved for future) |
| tax_amount | REAL | NOT NULL, default 0 (reserved for future) |
| total | REAL | NOT NULL, default 0 |
| currency | TEXT | NOT NULL, default `IDR` |
| created_by | INTEGER | FK → users |
| issued_at | TEXT | |
| voided_at | TEXT | |
| void_reason | TEXT | |
| created_at | TEXT | |
| updated_at | TEXT | |

**invoice_lines**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| invoice_id | INTEGER | FK → invoices, NOT NULL |
| delivery_line_id | INTEGER | FK → delivery_lines, NOT NULL |
| product_id | INTEGER | FK → products, NOT NULL |
| quantity | REAL | NOT NULL |
| unit_price | REAL | NOT NULL |
| line_total | REAL | NOT NULL |

**payments**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| payment_number | TEXT | UNIQUE, NOT NULL (`PAY-YYYY-NNNN`) |
| customer_id | INTEGER | FK → customers, NOT NULL |
| payment_date | TEXT | NOT NULL |
| amount | REAL | NOT NULL |
| method | TEXT | NOT NULL (`cash`, `transfer`, `cheque`, `other`) |
| reference | TEXT | |
| status | TEXT | NOT NULL (`recorded`, `partially_allocated`, `fully_allocated`, `reversed`) |
| notes | TEXT | |
| created_by | INTEGER | FK → users |
| created_at | TEXT | |
| updated_at | TEXT | |

**payment_allocations**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| payment_id | INTEGER | FK → payments, NOT NULL |
| invoice_id | INTEGER | FK → invoices, NOT NULL |
| amount | REAL | NOT NULL |
| created_at | TEXT | NOT NULL |

**audit_logs**

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PK |
| user_id | INTEGER | FK → users |
| action | TEXT | NOT NULL |
| entity_type | TEXT | NOT NULL |
| entity_id | INTEGER | |
| details | TEXT | JSON |
| created_at | TEXT | NOT NULL |

**settings**

| Column | Type | Constraints |
|---|---|---|
| key | TEXT | PK |
| value | TEXT | |
| updated_at | TEXT | |

**number_counters**

| Column | Type | Constraints |
|---|---|---|
| entity | TEXT | PK (composite) |
| year | TEXT | PK (composite) |
| last_number | INTEGER | NOT NULL, default 0 |

### 5.3 Indexes

- `users(username)`, `customers(code)`, `products(sku)`
- `sales_orders(order_number)`, `sales_orders(customer_id)`, `sales_orders(status)`
- `deliveries(delivery_number)`, `deliveries(order_id)`, `deliveries(status)`
- `invoices(invoice_number)`, `invoices(customer_id)`, `invoices(status)`, `invoices(due_date)`
- `payments(payment_number)`, `payments(customer_id)`
- `payment_allocations(payment_id)`, `payment_allocations(invoice_id)`
- `stock_movements(product_id, warehouse_id)`
- `audit_logs(entity_type, entity_id)`, `audit_logs(created_at)`

---

## 6. Business Logic

### 6.1 Order-to-Cash Flow

1. **Create order (draft):** Sales Staff selects an active customer and adds lines (active products, qty > 0). The system calculates line totals and order total.
2. **Submit:** status `draft → submitted`. The system validates the customer is active, products are active, quantities > 0, and calculates credit exposure.
3. **Credit check:** exposure is calculated line by line (see 6.2) and displayed when the supervisor reviews the order (warning only, never an automatic block). It is recomputed at approval time so it reflects the latest invoices, orders, and cancellations. The warning shows the credit limit, outstanding invoices, open order value, existing exposure, current order value, projected exposure, and excess amount.
4. **Approve:** Supervisor reviews the order in the approval queue. If projected exposure exceeds a positive credit limit, an override justification of at least 3 characters is required. Status `submitted → approved`. The system reserves stock in the default warehouse (`on_hand - reserved >= remaining qty`) and records a `reservation` movement per line. If stock is insufficient, approval is blocked with an explanatory error and the order stays `submitted` (the supervisor can still reject it). Approval history and audit log record the action, warehouse, reserved lines, and any credit override. The stock check is repeated inside the transaction so two supervisors cannot over-reserve the same stock.
5. **Reject:** status `submitted → rejected`, reason required. No reservation.
6. **Cancel:** eligible orders (`draft`, `submitted`, `approved`, `partially_fulfilled`, `partially_cancelled`) → `cancelled` (nothing delivered and all remaining cancelled), `fulfilled` (delivered > 0 and nothing remains), or `partially_cancelled` (delivered > 0 and remaining quantity still open), reason required. A draft order always cancels in full because it has not entered fulfillment and cannot be edited after partial cancellation. Releases reservation for the cancelled (undelivered) quantities only. Delivered quantities remain unchanged and invoicable.
7. **Delivery:** Warehouse Staff creates a delivery for an approved order with quantities ≤ the remaining (ordered − cancelled − committed) balance. The draft reserves no stock. Dispatch re-checks the balance and available reservation, then decrements `on_hand` and `reserved` and writes a `dispatch` movement. Confirm marks the delivery `delivered` and recalculates the order status from confirmed quantities (`partially_fulfilled` / `fulfilled`). A dispatched delivery can be flagged as a delivery exception and later resolved to `delivered` (confirm) or `cancelled` (reverse the dispatch, restoring `on_hand` and `reserved`). Open draft deliveries and unresolved exceptions block order cancellation.
8. **Invoice:** Finance generates an invoice from a delivered delivery. One delivery has at most one active (non-void) invoice, and quantities are the still-uninvoiced delivered quantities. The invoice is created as `draft`; Finance must explicitly issue it (`draft → issued`) before it becomes a receivable. Due date = invoice date + customer payment terms. Voiding (`draft` or `issued`) requires a reason, is blocked once payment allocations exist, and resets the delivery's `invoiced_quantity` so a replacement invoice can be generated.
9. **Payment:** Finance records a payment (date, amount, method, reference, optional notes). The payment starts as `recorded` and keeps its full amount unallocated. From the payment detail, Finance allocates it to one or more open invoices of the same customer in a single submission. Each allocation ≤ unallocated payment amount and ≤ invoice outstanding balance; the aggregate must also respect the unallocated amount. Unallocated value remains on the payment. Payment status is derived (`recorded`, `partially_allocated`, `fully_allocated`) and invoice statuses are refreshed in the same transaction. Allocations are immutable in the MVP; there is no reversal workflow.
10. **Dashboard and audit:** Management views KPIs; the audit trail records all important actions.

### 6.2 Credit Exposure Calculation

```text
exposure = outstanding_invoiced + open_order_value + current_order

outstanding_invoiced =
    SUM(invoice.total - SUM(allocation.amount))
    FOR invoices OF customer
    WHERE status IN ('issued', 'partially_paid')
      AND balance > 0

open_order_value =
    SUM(open_value FOR orders OF customer
        WHERE status IN ('approved', 'partially_fulfilled',
                         'partially_cancelled', 'fulfilled'))

open_value (per order) =
    SUM((line.quantity - line.cancelled_quantity) * line.unit_price)
    - SUM(invoice_line.line_total FOR invoices
          WITH status IN ('issued', 'partially_paid', 'paid')
          LINKED TO that order line)

current_order =
    SUM((line.quantity - line.cancelled_quantity - line.delivered_quantity)
        * line.unit_price)
    FOR the order currently under approval
```

**Rules:**

- Exposure is calculated at the line level so partial deliveries, partial cancellations, and partial invoicing are handled without double counting.
- Cancelled quantities are excluded from the order value; delivered quantities remain part of the order value until they are invoiced.
- Only issued, partially paid, and paid invoice lines reduce the order's open value, because those invoices represent a receivable. Draft invoices have not been issued yet and void invoices no longer exist commercially, so neither reduces exposure; the delivery quantity stays counted in `open_order_value` until an invoice is actually issued.
- The current order is counted fully (minus cancellations) while it is under approval. Once approved it moves into `open_order_value`; it is not counted twice because the order being approved is excluded from the existing-order query.
- A credit limit of `0` means the customer has no limit and the warning check does not apply.
- The over-limit condition is `credit_limit > 0 AND projected_exposure > credit_limit`.
- The calculation is performed inside the approval transaction to avoid double counting and race conditions.

**Warning display:** credit limit, existing exposure, current order value, projected exposure, and excess amount.

### 6.3 Inventory Calculations

```text
available = on_hand - reserved
```

- **Reservation (on approval):** `reserved += remaining_qty` per line, plus one `reservation` stock movement per product (`reference_type = 'sales_order'`).
- **Dispatch:** `on_hand -= qty`, `reserved -= qty`, guarded by `on_hand >= qty` and `reserved >= qty`; writes a `dispatch` movement with a negative quantity.
- **Delivery exception cancellation:** `on_hand += qty`, `reserved += qty`; writes a `dispatch_reversal` movement.
- **Order cancellation:** `reserved -= remaining_reserved`, plus a `reservation_release` movement; skipped when the order was never approved. Blocked while a draft delivery or unresolved exception exists.

**Per-order-line reserved quantity** is computed as `order_line.quantity - cancelled_quantity - Σ delivery_lines.quantity` for deliveries in `dispatched`, `delivered`, or `delivery_exception` status. Draft deliveries hold planned quantity for over-delivery checks but reserve no stock, and cancelled deliveries release it. No separate per-line reservation column is required. Partially cancelled lines keep their delivered quantities invoicable while the cancelled quantity is excluded from fulfillment and reservation.

**Warehouse scope:** reservations and dispatches always apply to the default warehouse configured in `settings.default_warehouse_id` (seeded as `WH-JKT`). The MVP seeds a single active warehouse; multi-warehouse allocation is out of scope. An order line reserves its full remaining quantity against that warehouse at approval time.

### 6.4 Numbering

| Entity | Format |
|---|---|
| Customer | `CUST-NNNN` |
| Product | `PRD-NNNN` |
| Sales Order | `SO-YYYY-NNNN` |
| Delivery | `DN-YYYY-NNNN` |
| Invoice | `INV-YYYY-NNNN` |
| Payment | `PAY-YYYY-NNNN` |

Numbering uses the `number_counters` table and is generated inside a transaction.

### 6.5 Status Transitions

**Sales Order**

| From | To | Trigger | Rules |
|---|---|---|---|
| draft | submitted | submit | customer active, ≥1 line, qty > 0 |
| draft | cancelled | cancel | reason required; always cancels the whole order |
| submitted | approved | approve | stock available; credit warning → override + justification |
| submitted | rejected | reject | reason required |
| submitted | cancelled | cancel | reason required |
| approved | cancelled | cancel | reason required; release full reservation |
| approved | partially_cancelled | cancel remaining | reason required; release reservation for undelivered qty |
| partially_fulfilled | partially_cancelled | cancel remaining | reason required; release reservation for undelivered qty |
| partially_cancelled | partially_cancelled | cancel remaining | reason required; release reservation for undelivered qty |
| partially_cancelled | fulfilled | cancel remaining | delivered > 0 and no remaining undelivered qty |
| approved | partially_fulfilled | delivery confirmed | partial delivery confirmed |
| partially_fulfilled | fulfilled | delivery confirmed | all quantities delivered |
| approved | fulfilled | delivery confirmed | all quantities delivered at once |

**Cancellation rules:**

- Orders with no deliveries can be fully cancelled.
- Orders with partial deliveries can only cancel their remaining undelivered quantities.
- Draft orders always cancel in full, because a partially cancelled draft cannot be edited and would strand the remaining quantity.
- Already delivered quantities remain unchanged and can still be invoiced.
- Reservations are released only for the cancelled (undelivered) quantities.
- Cancellation of delivered or invoiced quantities is prevented.
- A cancellation reason is required and recorded in the audit trail.
- Order status becomes `cancelled` (nothing delivered and all remaining quantity cancelled), `fulfilled` (delivered > 0 and nothing remains), or `partially_cancelled` (delivered > 0 but remaining quantity is still open).
- A partially cancelled `submitted` order keeps status `submitted`, so the remaining quantity stays in the approval queue. `partially_cancelled` only applies once the order is approved and reservation is active.
- Sales Staff can cancel only their own draft orders; Sales Supervisor can cancel any eligible order.
- Credit exposure is recalculated after cancellation.

**Delivery**

| From | To | Trigger | Rules |
|---|---|---|---|
| draft | dispatched | dispatch | qty ≤ remaining order qty |
| dispatched | delivered | confirm | |
| draft | cancelled | cancel | reason required |
| dispatched | delivery_exception | exception | reason required |
| delivery_exception | delivered | resolve | exception resolved; goods received |
| delivery_exception | cancelled | resolve | exception resolved; goods not received; reverse dispatch stock |

**Order fulfillment rules:**

- Delivered quantity counts only deliveries with status `delivered`. Dispatched-but-unconfirmed quantities remain committed and cannot be delivered again.
- Confirming a delivery recalculates the order: no delivered quantity and no cancellations → `approved`; delivered > 0 with remaining balance → `partially_fulfilled`; nothing remains → `fulfilled`; no delivered quantity but cancellations exist → `partially_cancelled`.
- Resolving an exception to `cancelled` reverses the dispatch (`on_hand += qty`, `reserved += qty`) and writes a `dispatch_reversal` movement.
- A draft delivery reserves no inventory. Dispatching requires the approval reservation to still be present for every line.

**Invoice**

| From | To | Trigger | Rules |
|---|---|---|---|
| (new) | draft | generate | delivery is `delivered`; delivery has no active invoice; uninvoiced quantities > 0 |
| draft | issued | issue | delivery is `delivered`; status must be `draft` |
| issued | partially_paid | allocate | partial allocation |
| issued / partially_paid | paid | allocate | balance = 0 |
| draft / issued | void | void | reason required; only when the invoice has no payment allocations |

**Void rule:** voiding an invoice releases its delivery lines (`invoiced_quantity` reset to 0) so the delivery can be re-invoiced with a new invoice number. Invoices with payment allocations cannot be voided in the MVP. Because a void invoice is ignored by the active-invoice guard, the delivery card offers "Generate replacement invoice" after a void.

**Draft rule:** a generated invoice does not create a receivable and does not change credit exposure. Only `issued`, `partially_paid`, and `paid` invoices are included in outstanding receivables and exposure. Status beyond `issued` is derived from allocations (`deriveStatus`), and `refreshInvoiceStatus` recomputes it after every allocation.

**Payment**

| From | To | Trigger | Rules |
|---|---|---|---|
| recorded | partially_allocated | allocate | total allocated < payment amount |
| recorded / partially_allocated | fully_allocated | allocate | total allocated = payment amount |

**Allocation rule:** every allocation row references one payment and one invoice. All invoices in a submission must belong to the payment's customer and be `issued` or `partially_paid`. The sum of the submission cannot exceed the payment's unallocated amount, and each row cannot exceed the invoice's outstanding balance. Allocations, payment status, and invoice statuses are written in one database transaction so a partial failure leaves no allocation behind. Audit records capture the payment, customer, invoice numbers, amounts, and remaining unallocated amount.

**Payment status is derived:** `recorded` when allocated = 0, `partially_allocated` when 0 < allocated < amount, and `fully_allocated` when allocated = amount. There is no payment reversal in the MVP.

**Overdue** is computed on read: `due_date < today AND balance > 0 AND status NOT IN ('paid', 'void')`.

### 6.6 Business Rules Mapping

| Rule | Implementation |
|---|---|
| BR-001 | Service validates customer status before order creation. |
| BR-002 | Service validates product status before adding a line. |
| BR-003 | Validator rejects qty ≤ 0. |
| BR-004 | Service computes `line_total = qty × unit_price`; `subtotal = Σ line_total`; `total = subtotal`. |
| BR-005 | Service checks current status before approve/reject. |
| BR-006 | Service checks `available >= qty` for every line before approval. |
| BR-007 | On approval, service increments `reserved` per line and writes a `reservation` stock movement. |
| BR-008 | Rejection performs no reservation. |
| BR-009 | On cancellation, service releases remaining `reserved` and writes a `reservation_release` movement. |
| BR-010 | Service checks delivery qty ≤ remaining order line qty. |
| BR-011 | On dispatch, service decrements `on_hand` and `reserved`, writes a `dispatch` movement. |
| BR-012 | Invoice service checks `invoiced_quantity` on the delivery line. |
| BR-013 | `invoice_number` is UNIQUE; generated from `number_counters`. |
| BR-014 | No update route exists for issued invoices; only void is allowed. |
| BR-015 | Derived: `balance = total - Σ allocations`; `Paid` when balance = 0. |
| BR-016 | Derived: `Partially Paid` when 0 < allocated < total. |
| BR-017 | Derived on read (see 6.5). |
| BR-018 | Service checks payment.customer_id = invoice.customer_id. |
| BR-019 | Service checks aggregate allocations ≤ payment unallocated amount. |
| BR-020 | Service checks allocation ≤ invoice outstanding balance. |
| BR-021 | Validators require reason for reject/cancel/void. |
| BR-022 | Service writes an audit record for every status transition. |
| BR-023 | Credit warning is computed on submission; approval with warning requires override + justification. |
| BR-024 | One delivery has at most one active (non-void) invoice; invoice qty = still-uninvoiced delivered qty. |
| BR-025 | A delivery line cannot be invoiced twice. |

---

## 7. Role-Based Access Control

### 7.1 Roles (from PRD.md)

1. Sales Staff
2. Sales Supervisor
3. Warehouse Staff
4. Finance Staff
5. Management
6. Admin

### 7.2 Permission Matrix

| Feature | Sales Staff | Sales Supervisor | Warehouse Staff | Finance Staff | Management | Admin |
|---|---|---|---|---|---|---|
| Login / logout | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard | own view | sales view | fulfillment view | finance view | full | full |
| Customer list / view | ✓ | ✓ | – | ✓ | ✓ | ✓ |
| Customer create / edit | ✓ | ✓ | – | – | – | ✓ |
| Product list / view | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Product create / edit | – | – | – | – | – | ✓ |
| Inventory view | ✓ | ✓ | ✓ | – | ✓ | ✓ |
| Stock adjustment | – | – | ✓ | – | – | ✓ |
| Order create / edit draft | ✓ | ✓ | – | – | – | – |
| Order list / view | ✓ | ✓ | fulfillment statuses only | ✓ | ✓ | ✓ |
| Order submit | ✓ | ✓ | – | – | – | – |
| Order cancel | own draft | ✓ | – | – | – | – |
| Approval queue | – | ✓ | – | – | – | – |
| Approve / reject | – | ✓ | – | – | – | – |
| Delivery view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delivery create / dispatch / confirm | – | – | ✓ | – | – | – |
| Invoice view | ✓ | ✓ | – | ✓ | ✓ | ✓ |
| Invoice generate / issue / void | – | – | – | ✓ | – | – |
| Payment view | – | – | – | ✓ | ✓ | ✓ |
| Payment record / allocate | – | – | – | ✓ | – | – |
| User management | – | – | – | – | – | ✓ |
| Audit view | – | – | – | – | ✓ | ✓ |
| Management dashboard | – | – | – | – | ✓ | ✓ |

**Warehouse visibility:** Warehouse Staff only see orders that have entered fulfillment (`approved`, `partially_fulfilled`, `partially_cancelled`, `fulfilled`). Draft, submitted, rejected and cancelled orders are hidden from both the order list and the detail page for that role.

### 7.3 Implementation

- `requireAuth` middleware validates the session.
- `requireRole(...roles)` middleware validates the user role.
- Route-level permission checks enforce the matrix.
- The UI shows/hides navigation items by role.
- **Segregation of duties:** a Sales Supervisor cannot approve or reject an order they created.

---

## 8. Route Design

```text
GET    /login
POST   /login
POST   /logout
GET    /forbidden

GET    /dashboard?dateFrom=&dateTo=&customerId=

GET    /customers
GET    /customers/new
GET    /customers/:id
GET    /customers/:id/edit
POST   /customers
POST   /customers/:id
POST   /customers/:id/status

GET    /products
GET    /products/new
GET    /products/:id
GET    /products/:id/edit
POST   /products
POST   /products/:id
POST   /products/:id/status

GET    /inventory
GET    /inventory/movements
GET    /inventory/adjustments/new
POST   /inventory/adjustments

GET    /orders
GET    /orders/new
GET    /orders/:id
GET    /orders/:id/edit
POST   /orders
POST   /orders/:id
POST   /orders/:id/submit
POST   /orders/:id/cancel

GET    /approvals
GET    /approvals/:id
POST   /approvals/:id/approve
POST   /approvals/:id/reject

GET    /deliveries
GET    /deliveries/new
GET    /deliveries/:id
POST   /deliveries
POST   /deliveries/:id/dispatch
POST   /deliveries/:id/confirm
POST   /deliveries/:id/cancel
POST   /deliveries/:id/exception
POST   /deliveries/:id/resolve

GET    /invoices
GET    /invoices/new
GET    /invoices/:id
POST   /invoices
POST   /invoices/:id/issue
POST   /invoices/:id/void

GET    /payments
GET    /payments/new
GET    /payments/:id
POST   /payments
POST   /payments/:id/allocations

GET    /categories
POST   /categories
POST   /categories/:id

GET    /warehouses
GET    /warehouses/new
GET    /warehouses/:id/edit
POST   /warehouses
POST   /warehouses/:id
POST   /warehouses/:id/status

GET    /users
GET    /users/new
GET    /users/:id/edit
POST   /users
POST   /users/:id
POST   /users/:id/status

GET    /audit?entityType=&action=&dateFrom=&dateTo=&page=
```

All routes are protected by `requireAuth`; role-restricted routes add `requireRole`. Because the UI is server-rendered with HTML forms, state-changing routes use `POST` endpoints (no `PUT`/`PATCH`/`DELETE` verbs); action suffixes such as `/status`, `/submit`, and `/approve` express intent.

---

## 9. UI Design

### 9.1 Layout

- **Top bar:** application name, current user, role, logout.
- **Left sidebar:** role-based navigation.
- **Main content:** page content with breadcrumb and flash messages.

### 9.2 Pages

| Page | Purpose |
|---|---|
| Login | Authentication |
| Dashboard | KPI cards, status distribution, fulfillment, inventory, receivables, recent orders, activity feed |
| Customers | List, detail, create/edit form |
| Products | List, detail, create/edit form |
| Inventory | Stock balances, movement history, adjustments |
| Orders | List, detail, create/edit form, submit/cancel |
| Approvals | Pending queue, review, approve/reject with reason |
| Deliveries | List, detail, create, dispatch/confirm |
| Invoices | List, detail, generate, issue, void |
| Payments | List, detail, record, allocate |
| Users | List, create/edit, role assignment |
| Categories | Admin management of product categories |
| Warehouses | Admin management of warehouses |
| Audit | Filterable audit log |

### 9.3 Design Direction

- Clean enterprise layout, neutral palette, clear typography.
- Status badges with consistent color semantics.
- Tables with sorting and filtering where relevant.
- Forms with inline validation messages.
- Responsive down to tablet width.

### 9.4 Per-Role Dashboard

| Role | Dashboard contents |
|---|---|
| Sales Staff | Sales order KPIs, order status distribution, recent orders, fulfillment progress, stock overview, receivables, activity feed |
| Sales Supervisor | Same operational view plus the pending approval count and submitted orders |
| Warehouse Staff | Fulfillment progress and delivery status, pending approvals, inventory overview, activity feed (no finance sections) |
| Finance Staff | Sales and fulfillment KPIs, receivables, overdue invoices, draft invoices, unallocated payments, activity feed (no inventory section) |
| Management | All KPIs, receivables, overdue invoices, inventory, delivery exceptions, recent orders, activity feed, audit link |
| Admin | Same visibility as Management for operational monitoring, plus administration shortcuts |

Section visibility is enforced server-side in `dashboard.service.js`; the template only renders sections the role is allowed to see.

### 9.5 Dashboard and Reporting Rules

- **Source of truth:** every KPI is calculated from transactional tables (`sales_orders`, `deliveries`, `inventory_balances`, `invoices`, `payments`, `audit_logs`). No KPI is hard-coded.
- **Date filters** (`dateFrom`, `dateTo`) apply to transaction dates: order date, delivery date, invoice date, and payment date. Receivables and inventory balances are always current as of today, because they represent live balances rather than period movements.
- **Customer filter** (`customerId`) narrows orders, deliveries, invoices, payments, and overdue invoices. Inactive or unknown customers are ignored.
- **Invalid filters** are discarded rather than rejected; an inverted date range is swapped so the page still renders.
- **Order KPIs:** total orders and value, open orders (`approved`, `partially_fulfilled`, `partially_cancelled`), and pending approvals (`submitted`).
- **Fulfillment rate:** units delivered against ordered units (after cancelled quantities) for orders that reached approval. Delivery status counts are derived from `deliveries`.
- **Receivables:** sum of `total - allocations` for invoices in `issued` or `partially_paid` with a positive balance. Overdue is the portion whose `due_date` is before today. Draft invoices are excluded until issued.
- **Inventory:** active products only; on-hand, reserved, and available (`on_hand - reserved`) are aggregated across warehouses.
- **Recent activity:** latest non-authentication audit records, summarized with entity links.
- **Audit trail viewer:** management and admin only; filterable by entity type, action, and date, paginated at 25 records per page.

---

## 10. Validation and Error Handling

- **Input validation:** `express-validator` chains at route level.
- **Business validation:** services throw `ApiError` with a user-friendly message.
- **Central error middleware:** renders an error page or returns JSON for API-like routes.
- **Flash messages:** success and error feedback in the UI.
- **No stack traces** are exposed to users.

---

## 11. Audit Trail

Recorded events:

| Entity | Events |
|---|---|
| auth | login, logout |
| customer | created, updated, status_changed |
| product | created, updated, status_changed |
| order | created, updated, submitted, approved, rejected, cancelled |
| approval | overridden |
| delivery | created, dispatched, confirmed, cancelled, exception |
| invoice | generated, issued, voided |
| payment | recorded, allocated |
| inventory | adjusted |
| user | created, updated, status_changed |

Each record contains: `user_id`, `action`, `entity_type`, `entity_id`, `details` (JSON), `created_at`, and `ip_address`.

The audit trail viewer (`/audit`, management and admin only) lists records newest first with pagination (25 per page) and filters for entity type, action, and record date. The management dashboard shows the latest non-authentication records as a read-only activity feed.

Utility `src/utils/audit.js` maps action codes to human labels and badge tones, maps entity types to labels and detail links, and summarizes each record from its `details` payload so the same presentation is reused by the dashboard feed and the audit page.

---

## 12. Testing Strategy

- **Unit tests:** services (calculations, status transitions, business rules).
- **Integration tests:** routes with Supertest (auth, RBAC, CRUD, workflows).
- **Transaction tests:** rollback on failure for approval, dispatch, invoice, payment.
- **UAT scenarios:** documented in `docs/testing/uat-scenarios.md` and executed with evidence.

Test data is provided by the seed script.

---

## 13. Security

- Passwords hashed with bcrypt.
- Session-based auth with HTTP-only cookies.
- CSRF protection via synchronizer token stored in the session.
- Parameterized queries via better-sqlite3 prepared statements (SQL injection prevention).
- Role-based access control on every route.
- Security headers via `helmet`.
- Audit trail for accountability.

---

## 14. Seed Data

- 6 users (one per role).
- 8–10 fictional Indonesian customers.
- 3 product categories, 12–15 products.
- 1 warehouse with inventory balances.
- Sample orders, deliveries, invoices, and payments to demonstrate the dashboard.

Fictional company: **PT Maju Bersama** — distributor of building materials and industrial supplies.

---

## 15. Conventions

- **UI language:** English.
- **Currency:** IDR, formatted as `Rp 1.234.567`.
- **Dates:** ISO `YYYY-MM-DD` stored; displayed in Indonesian format.
- **Timezone:** Asia/Jakarta (WIB) for business dates.
- **Naming:** camelCase in JavaScript, snake_case in the database.
- **Timestamps:** `YYYY-MM-DD HH:MM:SS` in WIB.
- **Numbers:** decimal for quantities (supports fractional units), 2 decimals for money.

---

## 16. Out of Scope (MVP)

- Tax calculation, configuration, and reporting.
- Payment gateway and bank reconciliation.
- General ledger integration.
- Procurement and vendor management.
- Demand forecasting.
- Multi-currency.
- Consolidated invoicing across deliveries.
- Returns and credit notes.
- Notifications.
- Export functionality.
- Customer self-service portal.

---

## 17. Decisions Log (2026-11-12)

| # | Decision | Status |
|---|---|---|
| D1 | Tech stack: Node.js + Express + SQLite + EJS | Confirmed |
| D2 | 6-role model from PRD.md | Confirmed |
| D3 | Credit limit: warning + override with justification | Confirmed |
| D4 | Credit exposure includes the current order under approval | Confirmed |
| D5 | Per-delivery invoicing | Confirmed |
| D6 | Tax outside MVP (schema extensible) | Confirmed |
| D7 | Scope: full O2C + dashboard + audit | Confirmed |
| D8 | Order fulfillment status updates on delivery confirmation | Confirmed |
| D9 | Order line prices default to list price but can be overridden | Confirmed |
| D10 | `credit_limit = 0` means no limit (check skipped) | Confirmed |
| D11 | Delivery exceptions resolve to delivered or cancelled | Confirmed |
| D12 | Categories and warehouses are admin-managed CRUD | Confirmed |
| D13 | Per-role dashboard KPI sets (§9.4) | Confirmed |
| D14 | Invoice void only for invoices without allocations | Confirmed |
| D15 | Payment reversal out of MVP scope | Confirmed |
| D16 | Self-approval blocked | Confirmed |
| D17 | Partial order cancellation supported | Confirmed |
