# Defect Log

## B2B Order & Payment Management System

**Period:** 2026-11-12  
**Status:** All logged defects are closed. No open Critical or High defects at release.

| ID | Severity | Area | Summary | Root cause | Resolution | Regression test |
|---|---|---|---|---|---|---|
| DEF-001 | Medium | Navigation | Sidebar "Audit Trail" link returned 404 | The link was added to the layout before the route and view existed | Added `/audit` route, controller, repository filters, and audit page in M10 | `dashboard.test.js` — audit trail is restricted to management and admin |
| DEF-002 | High | Payments | An allocation could exceed the invoice outstanding balance | Allocation validation only checked the payment's unallocated amount | Added per-invoice balance check and aggregate check; whole submission runs in one transaction | `payments.test.js` — allocations cannot exceed the payment amount or the invoice balance |
| DEF-003 | High | Invoices | Invoice stayed `issued` after a partial allocation | Invoice status was set at issuance and not recalculated after allocations | Added derived status (`issued` / `partially_paid` / `paid`) and refresh after each allocation | `payments.test.js` — partial allocation leaves an outstanding balance; multi-invoice allocation updates statuses |
| DEF-004 | High | Credit exposure | Draft invoices reduced credit exposure and appeared in receivables | The outstanding query included all non-void invoices | Limited exposure and receivables to `issued`, `partially_paid`, and `paid`; draft invoices are informational only | `invoices.test.js` — invoice generation keeps credit exposure unchanged until issued |
| DEF-005 | High | Deliveries | Cancelling a delivery exception after dispatch left stock deducted | Resolution only changed the delivery status | Resolution as `cancelled` now reverses the stock movement and restores the reservation in the same transaction | `deliveries.test.js` — resolving an exception as cancelled reverses dispatch and restores stock |
| DEF-006 | Medium | Orders | Warehouse Staff could open draft and submitted orders | The order list filtered only by fulfillment status on the detail page, not the list query | Applied the warehouse status filter to both list and detail access | `orders.test.js` — warehouse staff only see orders that have entered fulfillment |
| DEF-007 | High | Approvals | A supervisor could approve an order they created | Approval checked role but not ownership | Added an ownership guard before approval/rejection (BR-027) | `approvals.test.js` — a supervisor cannot approve an order they created |

## Defect severity summary

| Severity | Logged | Closed | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 5 | 5 | 0 |
| Medium | 2 | 2 | 0 |
| Low | 0 | 0 | 0 |
| **Total** | **7** | **7** | **0** |
