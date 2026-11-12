# Requirements Traceability Matrix

## B2B Order & Payment Management System

**Version:** 1.0  
**Date:** 2026-11-12  
**Source requirements:** `PRD.md`  
**Verification:** `tests/integration/*.test.js`, `docs/testing/uat-scenarios.md`

---

## 1. Functional Requirements

| Requirement | Summary | Implementation | Verification |
|---|---|---|---|
| FR-001 | User authentication | `auth.service.js`, `auth.controller.js`, `routes/auth.routes.js` | `auth.test.js` - signs in; rejects invalid credentials |
| FR-002 | Secure logout | `auth.controller.js`, session destroy, logout audit event | `auth.test.js` - signs out and protects the dashboard again |
| FR-003 | Role-based access control | `middleware/rbac.middleware.js`, route guards, role-aware sidebar | `auth.test.js`, `master-data.test.js`, all suites |
| FR-004 | Unauthorized access blocked | `requireAuth`, `requireRole` on every route | `auth.test.js`, `deliveries.test.js` |
| FR-005 | User management | `user.service.js`, `user.controller.js`, `views/users/*` | `auth.test.js` - admin creates a user; self-deactivation guard |
| FR-006 - FR-008 | Customer create, update, view | `customer.service.js`, `customer.controller.js`, `views/customers/*` | `master-data.test.js` |
| FR-009 | Unique customer codes | `numbering.js`, `CUST-NNNN`, validator | `master-data.test.js` - generated code |
| FR-010 | Payment terms stored | `customers.payment_terms_days`, invoice due date | `master-data.test.js`, `invoices.test.js` - due date |
| FR-011 | Credit limits stored | `customers.credit_limit`, customer form | `master-data.test.js` - negative limit rejected |
| FR-012 | Inactive customers blocked | `order.service.js` customer status check | `orders.test.js` - inactive customer rejected |
| FR-013 - FR-014 | Product management and unique SKU | `product.service.js`, `product.controller.js`, validators | `master-data.test.js` - admin creates product; non-admin blocked |
| FR-015 - FR-017 | Inventory by warehouse, available and reserved stock | `inventory.service.js`, `inventory.repository.js`, `views/inventory/*` | `master-data.test.js`, `approvals.test.js`, `deliveries.test.js` |
| FR-018 | Inventory movements | `inventory_movements`, movement history page | `master-data.test.js` - adjustment appears in history |
| FR-019 | No reservation beyond available stock | `approval.service.js` reservation transaction | `approvals.test.js` - insufficient stock; competing approvals |
| FR-020 | Stock adjustments with reasons | `inventory.service.js`, adjustment validator | `master-data.test.js` |
| FR-021 - FR-023 | Draft orders, multiple lines, totals | `order.service.js`, `order.validator.js`, order form | `orders.test.js` - multi-line totals |
| FR-024 | Draft editing | `order.service.js` update path | `orders.test.js` - edit recalculates totals |
| FR-025 | Submit for approval | `order.service.js`, `POST /orders/:id/submit` | `orders.test.js` - submit |
| FR-026 | Order details and status | `order.controller.js`, `views/orders/show.ejs` | `orders.test.js` |
| FR-027 | Cancellation rules and reasons | `order.service.js` partial/full cancellation | `orders.test.js`, `deliveries.test.js` |
| FR-028 | Order history | `order_history` writes | `orders.test.js`, `approvals.test.js` |
| FR-029 - FR-031 | Approval queue, approve, reject | `approval.service.js`, `views/approvals/*` | `approvals.test.js` |
| FR-032 | Rejection reason required | `approval.validator.js`, service guard | `approvals.test.js` |
| FR-033 - FR-034 | Reservation on approval with stock validation | `approval.service.js` transaction | `approvals.test.js` |
| FR-035 | Credit exposure calculation and warning | `approval.service.js`, `calculateExposure` | `approvals.test.js` - credit warning |
| FR-036 | Warehouse can view approved orders | `order.repository.js` status filter | `deliveries.test.js`, `orders.test.js` |
| FR-037 - FR-039 | Delivery creation, partial delivery, dispatch | `delivery.service.js`, delivery form, dispatch route | `deliveries.test.js` |
| FR-040 - FR-041 | Remaining quantities and over-delivery guard | `delivery.service.js` quantity checks | `deliveries.test.js` |
| FR-042 | Stock update after dispatch | `delivery.service.js` transaction | `deliveries.test.js` |
| FR-043 - FR-045 | Invoice from delivered quantities, unique number, totals | `invoice.service.js`, `invoice.repository.js` | `invoices.test.js` |
| FR-046 | Due date from payment terms | `addDays(invoiceDate, payment_terms_days)` | `invoices.test.js` |
| FR-047 | Invoice issuance | `invoice.service.js` issue transition | `invoices.test.js` |
| FR-048 - FR-049 | Outstanding balances and overdue detection | `invoice.repository.js`, `dashboard.repository.js` | `invoices.test.js`, `dashboard.test.js` |
| FR-050 | Void with reason | `invoice.service.js` void transaction | `invoices.test.js` |
| FR-051 - FR-052 | Payment recording with date, amount, method, reference | `payment.service.js`, `payment.validator.js` | `payments.test.js` |
| FR-053 - FR-055 | Allocation, partial payments, unallocated amount | `payment.service.js`, `payment_allocations`, detail view | `payments.test.js` |
| FR-056 | Over-allocation prevented | `payment.service.js` allocation guards | `payments.test.js` |
| FR-057 | Invoice balance after allocation | Allocation + `refreshInvoiceStatus` transaction | `payments.test.js` |
| FR-058 | Payment history | `payments` table, list/detail views | `payments.test.js` |
| FR-059 - FR-061 | Dashboard order summaries, status distribution, fulfillment | `dashboard.service.js`, `dashboard.repository.js`, dashboard view | `dashboard.test.js` |
| FR-062 - FR-063 | Receivables and overdue invoices | Dashboard finance queries and cards | `dashboard.test.js` |
| FR-064 | Recent business activities | `recentActivity` + `utils/audit.js` | `dashboard.test.js`, audit assertions |
| FR-065 | Date and customer filters | `dashboard.service.js` filter normalization | `dashboard.test.js` |
| FR-066 - FR-067 | Audit records with user and timestamp | `audit.service.js`, `audit_logs`, all workflow services | `dashboard.test.js`, approvals/invoices/payments tests |
| FR-068 | Audit records not modifiable | No update/delete route; append-only insert | `dashboard.test.js` - role restriction; route review |
| FR-069 | Credit warning shows limit, exposure, excess | `approval.service.js` review payload, approval view | `approvals.test.js` |
| FR-070 | Mandatory override justification | `approval.validator.js`, approval service | `approvals.test.js` |
| FR-071 | Overridden orders identifiable | Audit `order_approved` details flag + dashboard/audit summary | `approvals.test.js`, `dashboard.test.js` |
| FR-072 - FR-074 | Per-delivery invoice, delivered quantities, duplicate guard | `invoice.service.js`, active-invoice guard | `invoices.test.js` |

## 2. Business Rules

| Rule group | Implementation | Verification |
|---|---|---|
| BR-001 - BR-004 (customer/product/quantity/totals) | Order validator and service | `orders.test.js` |
| BR-005 - BR-009 (approval, reservation, rejection, cancellation release) | Approval and order services | `approvals.test.js`, `orders.test.js` |
| BR-010 - BR-011 (delivery limits, stock issue) | Delivery service transaction | `deliveries.test.js` |
| BR-012 - BR-017 (invoice quantity, uniqueness, uneditable issued invoice, paid/partial/overdue) | Invoice service and repository | `invoices.test.js`, `payments.test.js` |
| BR-018 - BR-020 (allocation customer, payment amount, invoice balance) | Payment allocation service | `payments.test.js` |
| BR-021 - BR-022 (reasons, audit) | Validators and audit service | All workflow suites |
| BR-023 - BR-025 (exposure, override, audit) | Approval service, audit details | `approvals.test.js` |
| BR-026 (no double invoicing) | Delivery-line `invoiced_quantity` guard | `invoices.test.js` |
| BR-027 (no self-approval) | Approval ownership guard | `approvals.test.js` |
| BR-028 - BR-032 (cancellation and cancellation audit) | Order/delivery services | `orders.test.js`, `deliveries.test.js` |

## 3. Non-Functional Requirements

| Requirement | Implementation | Verification |
|---|---|---|
| NFR-001 Security | Helmet, bcrypt, session auth, CSRF, parameterized queries, RBAC | Auth/RBAC suites; code review |
| NFR-002 Integrity | Transactions for approval, dispatch, invoice, payment | Guard tests in all workflow suites |
| NFR-003 Reliability | `db.transaction` wrappers; no partial writes on guard failure | Over-allocation, duplicate invoice, insufficient stock tests |
| NFR-004 Usability | Inline validation, flash messages, status badges, empty states | Manual smoke checks |
| NFR-005 Performance | Indexed lookups; small demo dataset | Not benchmarked; manual responsiveness check |
| NFR-006 Maintainability | Layered routes → controllers → services → repositories | Folder structure and code review |
| NFR-007 Auditability | Append-only audit log with user, timestamp, IP, details | `dashboard.test.js`, workflow assertions |
| NFR-008 Accessibility | Labels, focus styles, semantic tables | Basic manual check; no formal WCAG audit |
| NFR-009 Responsiveness | Responsive layout down to tablet/mobile | Manual check |
| NFR-010 Privacy | Fictional demo customers, products, and users | Seed review |

## 4. Out-of-Scope Requirements

No requirements from the PRD "out of scope" list are implemented: tax, e-invoicing, payment gateway, bank reconciliation, general ledger, procurement, forecasting, multi-currency, consolidated invoicing, and payment reversal remain excluded from the MVP.
