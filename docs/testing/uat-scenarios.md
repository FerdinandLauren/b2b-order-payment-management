# UAT Scenarios

## B2B Order & Payment Management System

**Version:** 1.0  
**Date:** 2026-11-12  
**Execution status:** All scenarios passed via automated integration tests and manual smoke checks. See `test-execution-results.md`.

---

## How to read this document

Each scenario is written the way a business user would execute it. `Evidence` points to the automated test that reproduces the scenario, or to a documented manual check. Demo credentials are listed in the project README.

---

## UAT-01 - Authentication and session protection

| Field | Detail |
|---|---|
| **Role** | Any |
| **Requirements** | FR-001, FR-002, FR-004, NFR-001 |
| **Precondition** | The application is running and the seed data exists. |

**Steps**

1. Open `/dashboard` without signing in.
2. Sign in with `sales / sales123`.
3. Sign out.
4. Open `/dashboard` again.
5. Sign in with an invalid password.

**Expected results**

1. The visitor is redirected to `/login` with a warning.
2. A valid account reaches the role-specific dashboard.
3. Logout ends the session and writes an audit event.
4. The protected page is no longer accessible.
5. A safe error is shown; no stack trace or credential detail is leaked.

**Evidence:** `auth.test.js` - renders the login page; redirects unauthenticated users; rejects invalid credentials; signs in and redirects; signs out and protects the dashboard again.

---

## UAT-02 - Role-based access control

| Field | Detail |
|---|---|
| **Role** | All roles |
| **Requirements** | FR-003, FR-004, NFR-001 |
| **Precondition** | One user per role is available. |

**Steps**

1. Sign in as Sales Staff and open `/users`.
2. Sign in as Finance Staff and open `/inventory`.
3. Sign in as Warehouse Staff and open `/customers`.
4. Sign in as Admin and create a user; sign in as that user.
5. Sign in as Warehouse Staff and attempt to dispatch a delivery.

**Expected results**

1. Sales Staff receives `403 Forbidden`.
2. Finance Staff receives `403` for inventory balances.
3. Warehouse Staff receives `403` for customer records.
4. The new account can sign in with the assigned role.
5. Only Warehouse Staff and Admin can dispatch.

**Evidence:** `auth.test.js` - blocks a sales user from user management; allows the admin to manage users. `master-data.test.js` - warehouse staff cannot access customer records; finance staff cannot view inventory balances. `deliveries.test.js` - non-warehouse roles cannot dispatch or confirm deliveries.

---

## UAT-03 - Master data and inventory adjustment

| Field | Detail |
|---|---|
| **Role** | Sales Staff, Admin, Warehouse Staff |
| **Requirements** | FR-006 - FR-020 |
| **Precondition** | Signed in with the appropriate role. |

**Steps**

1. Create a customer; leave the code empty and let the system generate it.
2. Attempt to save a negative credit limit.
3. As Admin, create a product with a unique SKU.
4. As Warehouse Staff, record a stock adjustment with a reason.
5. Attempt an adjustment that would make on-hand stock negative.
6. As Admin, try to deactivate the default warehouse.

**Expected results**

1. The customer is created with a generated `CUST-NNNN` code.
2. Validation rejects the negative credit limit with a readable message.
3. The product is created and appears in the product list.
4. The adjustment updates the balance and appears in movement history with the actor and timestamp.
5. The adjustment is rejected; stock remains unchanged.
6. The default warehouse cannot be deactivated.

**Evidence:** `master-data.test.js` - all six checks above.

---

## UAT-04 - Multi-line sales order and totals

| Field | Detail |
|---|---|
| **Role** | Sales Staff |
| **Requirements** | FR-021 - FR-024, BR-001 - BR-004 |
| **Precondition** | Active customer and active products with stock exist. |

**Steps**

1. Open `/orders/new`.
2. Select a customer, add two product lines, and enter positive quantities and negotiated prices.
3. Save the order as a draft and open its detail page.
4. Edit the quantity of one line and save.
5. Try to create an order for an inactive customer.
6. Try to create an order with an empty line set or a zero quantity.

**Expected results**

1. The form loads with customer and product options.
2. The order is saved as `draft` with a generated `SO-YYYY-NNNN` number.
3. Line totals and the order total equal quantity × unit price, summed across lines.
4. Totals are recalculated and order history records the update.
5. The inactive customer is rejected.
6. Validation blocks both cases with readable field errors.

**Evidence:** `orders.test.js` - opens the order form; creates a multi-line draft; rejects empty lines and zero quantity; edits a draft and recalculates totals; inactive customers cannot be used.

---

## UAT-05 - Approval, credit warning, and stock reservation

| Field | Detail |
|---|---|
| **Role** | Sales Staff → Sales Supervisor |
| **Requirements** | FR-025, FR-029 - FR-035, FR-069 - FR-071, BR-005 - BR-008, BR-023 - BR-025, BR-027 |
| **Precondition** | A submitted order exists and stock is available. |

**Steps**

1. As Sales Staff, submit a draft order.
2. As Sales Supervisor, open the approval queue and review the order.
3. Approve the order.
4. Verify inventory: on-hand unchanged, reserved increased by the ordered quantity.
5. Submit a second order whose value pushes the customer above the credit limit.
6. Attempt approval without a justification, then approve with a written justification.
7. As the supervisor who created an order, attempt to approve it.
8. Attempt to approve an order with insufficient available stock.

**Expected results**

1. The order moves to `submitted` and appears in the supervisor queue.
2. The review shows order value, stock availability, invoice exposure, open order value, projected exposure, credit limit, and excess.
3. Approval moves the order to `approved`, reserves stock atomically, and records an audit event.
4. The reservation is visible in inventory.
5. A credit warning is displayed; it is a warning, not an automatic block.
6. Approval without justification is rejected; with justification it succeeds, and the audit event stores the reason.
7. Self-approval is blocked (BR-027).
8. Approval is rejected without changing stock or order status.

**Evidence:** `approvals.test.js` - reviews credit and stock; reserves stock and writes an audit event; credit warnings require an override justification; a supervisor cannot approve their own order; approval is blocked when stock is insufficient; competing approvals cannot over-reserve.

---

## UAT-06 - Rejection with reason

| Field | Detail |
|---|---|
| **Role** | Sales Supervisor |
| **Requirements** | FR-031, FR-032, BR-005, BR-008, BR-021 |

**Steps**

1. Open a submitted order.
2. Reject it without a reason.
3. Reject it with a reason.

**Expected results**

1. Rejection without a reason is blocked.
2. Rejection with a reason moves the order to `rejected`, reserves no stock, records history, and writes an audit event.

**Evidence:** `approvals.test.js` - rejection requires a reason and reserves no stock.

---

## UAT-07 - Partial delivery and fulfillment status

| Field | Detail |
|---|---|
| **Role** | Warehouse Staff |
| **Requirements** | FR-036 - FR-042, BR-010, BR-011 |
| **Precondition** | An approved order with reserved stock exists. |

**Steps**

1. Open the fulfillment queue and select an approved order.
2. Create a delivery for part of the ordered quantity.
3. Dispatch the delivery.
4. Confirm the delivery.
5. Create a second delivery for the remaining quantity and complete it.
6. Attempt to deliver more than the remaining quantity.

**Expected results**

1. Approved orders are visible to the warehouse.
2. The delivery is created as `draft` with a generated `DO-YYYY-NNNN` number.
3. Dispatch decreases on-hand and reserved stock and moves the delivery to `dispatched`.
4. Confirmation moves the delivery to `delivered` and the order to `partially_fulfilled` or `fulfilled`.
5. Remaining quantities are calculated correctly and the order closes as `fulfilled`.
6. Over-delivery is rejected.

**Evidence:** `deliveries.test.js` - warehouse sees approved orders; only warehouse can create deliveries and over-delivery is rejected; dispatch issues stock and confirmation updates fulfillment; dispatch is blocked when reserved stock is gone.

---

## UAT-08 - Delivery exception resolution

| Field | Detail |
|---|---|
| **Role** | Warehouse Staff |
| **Requirements** | FR-041, FR-042, BR-029 |
| **Precondition** | A dispatched delivery exists. |

**Steps**

1. Record a delivery exception with a reason.
2. Resolve the exception as `delivered`.
3. Repeat with a second delivery and resolve as `cancelled`.

**Expected results**

1. The delivery moves to `delivery_exception` and the reason is visible.
2. Resolving as delivered completes the delivery and updates the order fulfillment.
3. Resolving as cancelled reverses the stock movement and restores the reservation.

**Evidence:** `deliveries.test.js` - exception resolved as delivered; exception resolved as cancelled reverses dispatch and restores stock.

---

## UAT-09 - Invoice generation, issuance, and due date

| Field | Detail |
|---|---|
| **Role** | Finance Staff |
| **Requirements** | FR-043 - FR-049, FR-072 - FR-074, BR-012 - BR-017, BR-026 |
| **Precondition** | A confirmed delivery exists. |

**Steps**

1. Generate an invoice from the delivery.
2. Open the invoice detail.
3. Issue the invoice.
4. Attempt to generate a second invoice from the same delivery.
5. Attempt to issue the same invoice twice.
6. Compare the due date with the customer payment terms.

**Expected results**

1. The invoice is created as `draft` with a unique `INV-YYYY-NNNN` number; delivered quantities are copied.
2. Totals equal quantity × unit price; the due date equals invoice date + customer terms.
3. Issuance moves the invoice to `issued`, making it a receivable.
4. Duplicate generation for the same delivery is blocked.
5. Re-issuing is blocked.
6. The due date is calculated correctly (for example, 30-day terms on 2026-11-12 → 2026-12-12).

**Evidence:** `invoices.test.js` - generates an invoice with correct totals and due date; a delivery cannot generate duplicate invoices; issuing twice is blocked.

---

## UAT-10 - Invoice void and replacement

| Field | Detail |
|---|---|
| **Role** | Finance Staff |
| **Requirements** | FR-050, BR-021, BR-024 |

**Steps**

1. Void a draft invoice without a reason, then with a reason.
2. Generate a replacement invoice from the same delivery.
3. Allocate a payment to an issued invoice and attempt to void it.

**Expected results**

1. Voiding without a reason is blocked; with a reason the invoice becomes `void`.
2. Voiding resets the delivery's invoiced quantity, so a replacement invoice can be generated.
3. Invoices with payment allocations cannot be voided.

**Evidence:** `invoices.test.js` - voiding requires a reason and releases the delivery; invoices with allocations cannot be voided.

---

## UAT-11 - Payment recording and multi-invoice allocation

| Field | Detail |
|---|---|
| **Role** | Finance Staff |
| **Requirements** | FR-051 - FR-058, BR-015, BR-016, BR-018 - BR-020 |
| **Precondition** | One or more `issued` invoices exist for the payment's customer. |

**Steps**

1. Record a payment with date, amount, method, and reference.
2. Allocate part of the payment to two invoices in one submission.
3. Record a second payment and allocate less than the invoice balance.
4. Allocate the remainder until the invoice balance reaches zero.

**Expected results**

1. The payment is saved as `recorded` with a `PAY-YYYY-NNNN` number; the full amount is initially unallocated.
2. Each allocation reduces the invoice balance; the payment becomes `partially_allocated`; the invoices become `partially_paid` or `paid`.
3. The unallocated amount is retained and displayed; the invoice remains `partially_paid`.
4. The final allocation makes the invoice `paid` and the payment `fully_allocated`.

**Evidence:** `payments.test.js` - records a payment with an unallocated amount; allocates to multiple invoices; partial allocation leaves an outstanding balance.

---

## UAT-12 - Allocation guards

| Field | Detail |
|---|---|
| **Role** | Finance Staff |
| **Requirements** | FR-056, BR-018 - BR-020 |

**Steps**

1. Enter an allocation larger than the payment's unallocated amount.
2. Enter an allocation larger than the invoice balance.
3. Attempt to allocate a payment to another customer's invoice.
4. Attempt to allocate to a draft invoice.
5. Allocate the full payment, then attempt another allocation.

**Expected results**

1. The submission is rejected; no partial allocation is saved.
2. The submission is rejected.
3. Cross-customer allocation is rejected.
4. Draft invoices are not offered and are rejected if submitted directly.
5. A fully allocated payment has no unallocated amount to give; the submission is rejected.

**Evidence:** `payments.test.js` - allocations cannot exceed payment or invoice balance; cannot allocate across customers or to draft invoices; over-allocation empties are blocked.

---

## UAT-13 - Order cancellation with partial delivery

| Field | Detail |
|---|---|
| **Role** | Sales Staff / Sales Supervisor |
| **Requirements** | FR-027, BR-009, BR-030 - BR-032 |
| **Precondition** | One order without deliveries and one with a completed partial delivery. |

**Steps**

1. Cancel a draft order with no deliveries.
2. Cancel the remaining quantity of a partially delivered order with a reason.
3. Cancel an approved order that still has an open draft delivery.
4. Attempt to cancel a delivered or invoiced quantity.
5. Verify inventory reservations and credit exposure after each cancellation.

**Expected results**

1. The whole draft order becomes `cancelled`.
2. Only the remaining undelivered quantity is cancelled; the order becomes `partially_cancelled`; delivered quantities remain invoiceable.
3. Cancellation is blocked until the draft delivery is cancelled.
4. Delivered or invoiced quantities cannot be cancelled.
5. Reservations for cancelled quantities are released; the reason, user, and timestamp are recorded in the audit trail.

**Evidence:** `orders.test.js` - supervisor partially cancels; cancellation cannot exceed remaining quantity; full cancellation closes the order; draft cancellation; `deliveries.test.js` - an open draft delivery blocks cancellation.

---

## UAT-14 - Dashboard KPIs, filters, and visibility

| Field | Detail |
|---|---|
| **Role** | Sales Staff, Sales Supervisor, Warehouse Staff, Finance Staff, Management, Admin |
| **Requirements** | FR-059 - FR-065 |

**Steps**

1. Sign in as each role and open `/dashboard`.
2. Compare the KPI values with the order, delivery, inventory, invoice, and payment records.
3. Filter by date range and by customer.
4. Apply an invalid date and an inverted date range.
5. As Finance Staff, confirm the receivables card and the overdue invoice table.
6. As Warehouse Staff, confirm the inventory card and the absence of finance sections.

**Expected results**

1. Each role sees its own guidance and permitted sections.
2. KPIs equal the underlying records; no hard-coded values.
3. Order, delivery, invoice, and payment figures are limited to the selected period; receivables and stock remain as of today.
4. Invalid dates are ignored and inverted ranges are swapped; the page still renders.
5. Finance sees outstanding, overdue, current, draft invoice, and unallocated payment figures.
6. Warehouse sees inventory but no receivables or overdue sections; audit links are hidden.

**Evidence:** `dashboard.test.js` - live order KPIs; date and customer filters; role visibility; pending approvals; receivables and overdue invoices as of today.

---

## UAT-15 - Audit trail integrity and filtering

| Field | Detail |
|---|---|
| **Role** | Management, Admin |
| **Requirements** | FR-066 - FR-068, FR-071, BR-022, BR-025, BR-032, NFR-007 |
| **Precondition** | Business actions have been performed in the system. |

**Steps**

1. As Management, open `/audit`.
2. Filter by entity (for example, `sales_order`).
3. Filter by action (for example, `order_created`).
4. Filter by a date range with no records.
5. As Sales Staff, attempt to open `/audit`.
6. Confirm that each record shows user, timestamp, entity, summary, and IP address.

**Expected results**

1. Records are listed newest first with pagination.
2. Only sales-order records are shown.
3. Only creation events are shown.
4. An empty state is displayed with a clear-filters action.
5. Ordinary users receive `403`.
6. Every record contains the accountable user and timestamp; no edit or delete action is offered.
7. Filtering `sales_order` + `order_approved` shows approved orders; entries approved with a credit override are summarized as "approved with a credit limit override", so overridden orders are identifiable for management review.

**Evidence:** `dashboard.test.js` - audit trail is restricted to management and admin; filters by entity, action, and date. Audit events are also asserted across approvals, deliveries, invoices, and payments tests.
