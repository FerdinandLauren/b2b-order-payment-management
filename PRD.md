# Product Requirements Document (PRD)
# B2B Order & Payment Management System

**Version:** 1.2  
**Project Type:** Business Information System  
**Domain:** B2B Distribution, Order Management, Inventory, Fulfillment, Invoicing, and Accounts Receivable  
**Product Status:** Initial Specification

---

## 1. Product Overview

### 1.1 Product Description

B2B Order & Payment Management System is a web-based business information system designed to manage and monitor the end-to-end operational process of a B2B distribution company.

The system integrates several important business processes, starting from customer order creation, order validation, approval, inventory reservation, delivery management, invoice generation, payment recording, and accounts receivable monitoring.

The main objective is to provide a centralized platform that connects sales, warehouse, and finance operations while ensuring that every transaction follows defined business rules.

Unlike a conventional e-commerce application, this system focuses on business-to-business transactions, where orders may involve negotiated prices, customer-specific payment terms, approval workflows, credit limits, partial deliveries, and partial payments.

### 1.2 Business Problem

Many distribution companies still manage their operational processes using spreadsheets, separate applications, and manual communication.

This creates several problems:

- Inconsistent customer and order information.
- Limited visibility into available inventory.
- Delays in order approval.
- Difficulty monitoring delivery progress.
- Disconnected sales and finance records.
- Difficulty tracking unpaid and overdue invoices.
- Errors when recording customer payments.
- Lack of transaction history and accountability.
- Limited visibility for management when making operational decisions.

The system aims to address these problems by integrating the order-to-cash process into one centralized application.

### 1.3 Product Vision

To create an integrated B2B operational management platform that improves transaction visibility, process consistency, inventory control, and financial monitoring.

### 1.4 Product Objectives

1. Centralize customer, product, order, delivery, invoice, and payment information.
2. Improve visibility throughout the order-to-cash process.
3. Reduce manual operational errors through business rules and validation.
4. Improve inventory allocation and fulfillment monitoring.
5. Connect delivered products with invoice generation.
6. Improve monitoring of outstanding receivables and customer payments.
7. Provide management with useful operational and financial information.
8. Maintain transaction history for accountability and auditing.

---

## 2. Target Users and Stakeholders

The system is designed for several operational departments within a B2B distribution company.

| User Role | Responsibilities |
|---|---|
| Sales Staff | Manage customer orders and monitor order progress. |
| Sales Supervisor | Review, approve, or reject customer orders. |
| Warehouse Staff | Manage stock allocation, delivery preparation, and dispatch. |
| Finance Staff | Generate invoices, record payments, and monitor receivables. |
| Management | Monitor business performance and operational activities. |
| System Administrator | Manage users, roles, and system configurations. |

### 2.1 User Access Principles

Each role should have access only to the features required for its responsibilities.

For example:
- Sales Staff can create and submit orders.
- Sales Supervisors can approve or reject orders.
- Warehouse Staff can manage delivery operations.
- Finance Staff can manage invoices and payments.
- Management can access reports and dashboards.
- Administrators can manage system configuration and user permissions.

---

## 3. Project Scope

### 3.1 In Scope

The initial version focuses on the following modules.

**A. Authentication and User Management**
- User login and logout.
- Role-based access control.
- User account management.
- Permission validation.

**B. Customer Management**
- Create customer records.
- Update customer information.
- View customer details.
- Manage customer status.
- Configure payment terms.
- Configure customer credit limits.

**C. Product and Inventory Management**
- Product catalog management.
- Product categories.
- SKU management.
- Warehouse inventory overview.
- On-hand stock monitoring.
- Reserved stock monitoring.
- Available stock calculation.
- Stock movement history.

**D. Sales Order Management**
- Create sales orders.
- Add multiple products to an order.
- Calculate order totals.
- Manage draft orders.
- Submit orders for approval.
- View order status.
- Cancel eligible orders.

**E. Order Approval Management**
- Supervisor approval queue.
- Approve orders.
- Reject orders.
- Record rejection reasons.
- Validate stock availability.
- Validate customer credit policy.

**F. Delivery and Fulfillment Management**
- Create delivery records.
- Manage delivery status.
- Support partial deliveries.
- Record dispatched quantities.
- Monitor remaining quantities.
- Track fulfillment progress.

**G. Invoice Management**
- Generate invoices from delivered quantities.
- Manage invoice records.
- Calculate invoice due dates.
- Track invoice status.
- Monitor outstanding balances.
- Void eligible invoices.

**H. Payment Management**
- Record customer payments.
- Allocate payments to invoices.
- Support partial payments.
- Monitor unallocated payments.
- Track payment history.
- Update invoice balances.

**I. Dashboard and Reporting**
- Sales order overview.
- Order status summary.
- Inventory overview.
- Delivery monitoring.
- Invoice monitoring.
- Outstanding receivables.
- Overdue invoice monitoring.
- Recent business activities.

**J. Audit Trail**
- Record important system activities.
- Track transaction changes.
- Record the user responsible for each action.
- Maintain timestamps and transaction references.

### 3.2 Out of Scope

The following features are excluded from the initial MVP:

- Real payment gateway integration.
- Automatic bank reconciliation.
- Automatic tax calculation and tax configuration.
- Government electronic invoicing integration.
- Full accounting general ledger.
- Tax filing and regulatory compliance.
- GPS-based delivery tracking.
- Supplier procurement management.
- Advanced demand forecasting.
- Multi-company consolidation.
- Complex multi-currency management.
- Native mobile applications.

These features may be considered for future development.

---

## 4. Business Process Overview

The application follows the Order-to-Cash (O2C) business process.

### 4.1 Main Business Workflow

1. Sales Staff selects an active customer.
2. Sales Staff creates a sales order.
3. Products and quantities are added to the order.
4. The system validates customer information, product availability, and order details.
5. Sales Staff submits the order.
6. Sales Supervisor reviews the order.
7. Supervisor approves or rejects the order.
8. Approved orders trigger inventory reservation.
9. Warehouse Staff prepares and dispatches products.
10. Delivery records are updated.
11. Finance Staff generates an invoice based on delivered quantities.
12. Finance Staff records incoming customer payments.
13. Payments are allocated to the corresponding invoices.
14. The system updates invoice balances and payment statuses.
15. Management monitors operational and financial performance through the dashboard.

### 4.2 Business Process Exceptions

The system must also handle exceptional situations:

- Orders rejected by supervisors.
- Orders cancelled before fulfillment.
- Insufficient inventory.
- Partial product delivery.
- Delivery discrepancies.
- Partial customer payments.
- Overpayments.
- Unallocated payments.
- Overdue invoices.
- Invalid payment allocations.

---

## 5. Functional Requirements

### 5.1 Authentication and Authorization

| ID | Requirement | Priority |
|---|---|---|
| FR-001 | Users can authenticate using registered accounts. | Must |
| FR-002 | Users can log out securely. | Must |
| FR-003 | The system implements role-based access control. | Must |
| FR-004 | Unauthorized users cannot access restricted functions. | Must |
| FR-005 | Administrators can manage user accounts. | Should |

### 5.2 Customer Management

| ID | Requirement | Priority |
|---|---|---|
| FR-006 | Users can create customer records. | Must |
| FR-007 | Users can update customer information. | Must |
| FR-008 | Users can view customer details. | Must |
| FR-009 | The system maintains unique customer codes. | Must |
| FR-010 | The system stores customer payment terms. | Must |
| FR-011 | The system stores customer credit limits. | Must |
| FR-012 | Inactive customers cannot be used for new orders. | Must |

### 5.3 Product and Inventory Management

| ID | Requirement | Priority |
|---|---|---|
| FR-013 | Administrators can manage product records. | Must |
| FR-014 | Every product has a unique SKU. | Must |
| FR-015 | The system displays inventory by warehouse. | Must |
| FR-016 | The system calculates available stock. | Must |
| FR-017 | The system tracks reserved stock. | Must |
| FR-018 | The system records inventory movements. | Must |
| FR-019 | The system prevents stock reservation beyond available quantities. | Must |
| FR-020 | Authorized users can perform stock adjustments with reasons. | Should |

### 5.4 Sales Order Management

| ID | Requirement | Priority |
|---|---|---|
| FR-021 | Sales Staff can create draft sales orders. | Must |
| FR-022 | An order can contain multiple product lines. | Must |
| FR-023 | The system calculates order subtotals and totals. | Must |
| FR-024 | Draft orders can be edited. | Must |
| FR-025 | Sales Staff can submit orders for approval. | Must |
| FR-026 | Users can view order details and status. | Must |
| FR-027 | Eligible orders can be cancelled with a reason. Orders with partial deliveries can cancel only their remaining undelivered quantities. | Must |
| FR-028 | The system records order history. | Must |

### 5.5 Order Approval

| ID | Requirement | Priority |
|---|---|---|
| FR-029 | Supervisors can view pending approval requests. | Must |
| FR-030 | Supervisors can approve submitted orders. | Must |
| FR-031 | Supervisors can reject submitted orders. | Must |
| FR-032 | Rejection requires a reason. | Must |
| FR-033 | Approved orders trigger inventory reservation. | Must |
| FR-034 | Approval validates available stock. | Must |
| FR-035 | The system calculates customer credit exposure and warns the supervisor when it exceeds the customer's credit limit. | Must |

### 5.6 Delivery and Fulfillment

| ID | Requirement | Priority |
|---|---|---|
| FR-036 | Warehouse Staff can view approved orders. | Must |
| FR-037 | Warehouse Staff can create delivery records. | Must |
| FR-038 | The system supports partial deliveries. | Must |
| FR-039 | The system records dispatched quantities. | Must |
| FR-040 | The system calculates remaining quantities. | Must |
| FR-041 | The system prevents over-delivery. | Must |
| FR-042 | Inventory balances are updated after dispatch. | Must |

### 5.7 Invoice Management

| ID | Requirement | Priority |
|---|---|---|
| FR-043 | Finance Staff can generate invoices from delivered quantities. | Must |
| FR-044 | Every invoice has a unique invoice number. | Must |
| FR-045 | The system calculates invoice totals. | Must |
| FR-046 | Invoice due dates follow customer payment terms. | Must |
| FR-047 | Finance Staff can issue eligible invoices. | Must |
| FR-048 | The system tracks outstanding invoice balances. | Must |
| FR-049 | The system identifies overdue invoices. | Must |
| FR-050 | Authorized Finance Staff can void invoices with reasons. | Should |

### 5.8 Payment Management

| ID | Requirement | Priority |
|---|---|---|
| FR-051 | Finance Staff can record customer payments. | Must |
| FR-052 | Payment records include date, amount, method, and reference. | Must |
| FR-053 | Payments can be allocated to invoices. | Must |
| FR-054 | The system supports partial payments. | Must |
| FR-055 | The system calculates unallocated payment amounts. | Must |
| FR-056 | The system prevents over-allocation. | Must |
| FR-057 | Invoice balances update after payment allocation. | Must |
| FR-058 | The system maintains payment history. | Must |

### 5.9 Dashboard and Reporting

| ID | Requirement | Priority |
|---|---|---|
| FR-059 | The dashboard displays sales order summaries. | Must |
| FR-060 | The dashboard displays order status distribution. | Must |
| FR-061 | The dashboard displays fulfillment progress. | Must |
| FR-062 | The dashboard displays outstanding receivables. | Must |
| FR-063 | The dashboard displays overdue invoices. | Must |
| FR-064 | The dashboard displays recent business activities. | Must |
| FR-065 | Users can filter reports by date and customer. | Should |

### 5.10 Audit Trail

| ID | Requirement | Priority |
|---|---|---|
| FR-066 | The system records important business activities. | Must |
| FR-067 | Audit records contain user and timestamp information. | Must |
| FR-068 | Ordinary users cannot modify audit records. | Must |

### 5.11 Credit Override and Invoicing Rules

| ID | Requirement | Priority |
|---|---|---|
| FR-069 | The system warns the supervisor when customer credit exposure exceeds the credit limit, displaying the credit limit, current exposure, and excess amount. | Must |
| FR-070 | A supervisor may approve an order that exceeds the credit limit only through an explicit override with a mandatory justification. | Must |
| FR-071 | Overridden orders are identifiable in management reports. | Must |
| FR-072 | Invoices are generated per delivery; one delivery generates at most one invoice. | Must |
| FR-073 | Invoice quantities must match the actual delivered quantities. | Must |
| FR-074 | A delivery cannot generate duplicate invoices. | Must |

---

## 6. Business Rules

| ID | Business Rule |
|---|---|
| BR-001 | Only active customers can create new orders. |
| BR-002 | Only active products can be added to new orders. |
| BR-003 | Order quantities must be greater than zero. |
| BR-004 | Order totals must be calculated consistently. |
| BR-005 | Only submitted orders can be approved or rejected. |
| BR-006 | Order approval requires sufficient available inventory. |
| BR-007 | Approved orders reserve the required inventory quantities. |
| BR-008 | Rejected orders do not reserve inventory. |
| BR-009 | Eligible cancellations release remaining inventory reservations. |
| BR-010 | Delivery quantities cannot exceed remaining order quantities. |
| BR-011 | Dispatch decreases on-hand stock and reserved stock. |
| BR-012 | Only delivered quantities that have not already been invoiced can be invoiced. One delivery generates at most one invoice. |
| BR-013 | Invoice numbers must be unique. |
| BR-014 | An issued invoice cannot be edited directly. |
| BR-015 | An invoice is Paid when its outstanding balance reaches zero. |
| BR-016 | An invoice is Partially Paid when some payment has been allocated but a balance remains. |
| BR-017 | An invoice is Overdue when its due date has passed and it has an outstanding balance. |
| BR-018 | Payment allocations must belong to the same customer as the payment. |
| BR-019 | Payment allocations cannot exceed the payment's unallocated amount. |
| BR-020 | Payment allocations cannot exceed the invoice's outstanding balance. |
| BR-021 | Rejections, cancellations, and void operations require reasons. |
| BR-022 | Important status transitions must be recorded in the audit trail. |
| BR-023 | Credit exposure = outstanding issued invoice balances + approved orders not yet invoiced + the current order under approval. The current order is not double-counted when it becomes approved. |
| BR-024 | When credit exposure exceeds the customer's credit limit, the system warns the supervisor; approval requires an explicit override with a mandatory justification. |
| BR-025 | Override decisions are recorded in the audit trail with reason, user, and timestamp. |
| BR-026 | A delivery line cannot be invoiced more than once. |
| BR-027 | A Sales Supervisor cannot approve or reject an order they created. |
| BR-028 | Only orders with no dispatched deliveries can be cancelled. |
| BR-029 | A delivery exception can be resolved to delivered or cancelled; cancelling after dispatch reverses the stock movement and restores the reservation. |
| BR-030 | Orders with no deliveries can be fully cancelled; orders with partial deliveries can cancel only their remaining undelivered quantities. Delivered quantities remain unchanged and invoicable. |
| BR-031 | Cancellation releases inventory reservations only for the cancelled (undelivered) quantities; cancellation of delivered or invoiced quantities is prevented. |
| BR-032 | Cancellation details (reason, user, timestamp) are recorded in the audit trail, and credit exposure is recalculated after cancellation. |

### 6.1 Credit Limit Policy

The system must evaluate customer credit exposure when an order is submitted for approval.

For the MVP, credit exposure is defined as:

Outstanding issued invoice balances + approved orders not yet invoiced + the current order under approval.

If the calculated exposure exceeds the configured customer credit limit:

- The system displays a clear warning showing the credit limit, existing exposure, current order value, projected exposure, and excess amount.
- The order is **not** automatically blocked.
- The Sales Supervisor may reject the order or approve it through an explicit override.
- An override requires a mandatory justification.
- The override decision (reason, user, timestamp) is recorded in the audit trail.
- Overridden orders are identifiable in management reports.

If the exposure is within the credit limit, the normal approval workflow applies.

Credit exposure calculations must be transaction-safe and must not double-count orders or invoices. When an order is approved, it moves from "current order under approval" into "approved orders not yet invoiced" and is not counted twice. Partially invoiced orders contribute only their remaining uninvoiced value.

This policy is a configurable prototype assumption.

### 6.2 Inventory Calculation

Available Stock = On-hand Stock - Reserved Stock

The system must ensure that reserved stock never exceeds on-hand stock.

---

## 7. Status Management

### 7.1 Sales Order Status

- Draft
- Submitted
- Approved
- Rejected
- Partially Fulfilled
- Partially Cancelled
- Fulfilled
- Cancelled

### 7.2 Delivery Status

- Draft
- Dispatched
- Delivered
- Delivery Exception
- Cancelled

### 7.3 Invoice Status

- Draft
- Issued
- Partially Paid
- Paid
- Overdue
- Void

### 7.4 Payment Status

- Recorded
- Partially Allocated
- Fully Allocated
- Reversed

Statuses must follow controlled transitions and should be derived from transaction data whenever practical.

---

## 8. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Security | The system must enforce authentication and authorization. |
| NFR-002 | Integrity | Financial and inventory operations must preserve database consistency. |
| NFR-003 | Reliability | Failed transactions must not leave partially updated records. |
| NFR-004 | Usability | The interface must provide clear validation and status information. |
| NFR-005 | Performance | Common list and detail screens should remain responsive with representative demo data. |
| NFR-006 | Maintainability | Business logic must be separated from presentation logic. |
| NFR-007 | Auditability | Important business actions must be traceable. |
| NFR-008 | Accessibility | Forms must provide labels and keyboard-accessible controls. |
| NFR-009 | Responsiveness | Core workflows must support desktop and tablet layouts. |
| NFR-010 | Privacy | Public demo data must be fictional. |

---

## 9. Acceptance Criteria

### AC-001: Create Sales Order

Given an active customer and valid products, when Sales Staff creates and submits an order, the system must save it with Submitted status.

### AC-002: Reject Sales Order

Given a submitted order, when a supervisor rejects it with a reason, the system must update its status to Rejected and record the reason.

### AC-003: Approve Sales Order

Given sufficient inventory and acceptable credit exposure, when a supervisor approves an order, the system must reserve the required stock exactly once.

### AC-004: Prevent Over-Reservation

Given 10 available units, when an order attempts to reserve 12 units, the system must reject the reservation and preserve the existing inventory balance.

### AC-005: Partial Delivery

Given an approved order for 20 units, when warehouse staff dispatches 8 units, the system must record 8 dispatched units and leave 12 units remaining.

### AC-006: Prevent Over-Delivery

Given an order with 12 units remaining, when a user attempts to dispatch 13 units, the system must reject the operation.

### AC-007: Invoice Generation

Given delivered quantities that have not been invoiced, when Finance Staff generates an invoice, the invoice must contain the correct billable quantities and source references.

### AC-008: Partial Payment

Given an invoice of 1,000 currency units, when Finance Staff allocates 400, the system must display an outstanding balance of 600.

### AC-009: Full Payment

Given an invoice with an outstanding balance of 600, when Finance Staff allocates another 600, the invoice must become Paid.

### AC-010: Prevent Over-Allocation

Given an invoice balance of 600, when a user attempts to allocate 700, the system must reject the allocation.

### AC-011: Overdue Invoice

Given an issued invoice with a positive outstanding balance and a due date in the past, the system must identify the invoice as overdue.

### AC-012: Audit Trail

Given an important business transaction, when it succeeds, the system must create an audit record containing the actor, action, timestamp, and entity reference.

---

## 10. Project Constraints and Assumptions

- The system represents one fictional distribution company.
- The initial version uses one configured currency.
- Tax calculation, tax configuration, and tax reporting are outside the MVP scope. The invoice schema is designed to support taxation in a future version.
- The initial version may use one warehouse while preserving the warehouse structure for expansion.
- Real banking and payment gateway integration are excluded.
- All customer and transaction information must be fictional.
- The project is a portfolio prototype, not a production-certified ERP.

---

## 11. Future Enhancements

Potential future capabilities include:

- Supplier and procurement management.
- Multi-warehouse stock transfers.
- Customer self-service portal.
- Automated payment reconciliation.
- ERP integration.
- Multi-currency support.
- Advanced receivables aging.
- Demand forecasting.
- Automated business notifications.

---

## 12. Project Success Criteria

The project will be considered successful when:

1. The main order-to-cash workflow is operational.
2. Business rules are enforced consistently.
3. Inventory and financial calculations are accurate.
4. Different roles have appropriate permissions.
5. Management can monitor operational and financial information.
6. The repository includes complete technical and business documentation.
7. UAT scenarios demonstrate the expected business outcomes.

---

## 13. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-11-12 | Initial specification. |
| 1.1 | 2026-11-12 | Credit limit policy changed to warning + supervisor override; per-delivery invoicing added; tax calculation moved out of MVP scope; 6-role model confirmed. |
| 1.2 | 2026-11-12 | Credit exposure now includes the current order under approval; partial order cancellation added; Partially Cancelled status added. |
