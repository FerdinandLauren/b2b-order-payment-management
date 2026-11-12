# Project Plan
# B2B Order & Payment Management System

**Version:** 1.8  
**Project Methodology:** Iterative Development  
**Planning Approach:** Balanced  
**Project Objective:** Build a functional B2B Order-to-Cash Management System with strong business process documentation.

---

## 1. Project Overview

This project aims to develop an integrated business information system for managing B2B distribution operations.

The development process prioritizes business analysis, system requirements, process modeling, and business logic before moving into application implementation.

The final result should demonstrate both business understanding and technical implementation capabilities.

## 2. Development Principles

1. Business requirements must be understood before implementation.
2. Every major feature must have documented acceptance criteria.
3. Business rules must be implemented consistently.
4. Data integrity is more important than unnecessary technical complexity.
5. The application must support different user roles.
6. Each milestone must produce a demonstrable result.
7. The system must be tested using realistic business scenarios.
8. Scope must remain focused on the MVP.

---

## 3. Project Milestones

### Milestone 0 — Project Initialization

**Objective:** Establish the project foundation.

Tasks:
- [x] Create PRD.md.
- [x] Create PLAN.md.
- [x] Create DESIGN.md.
- [x] Define project scope.
- [x] Define project assumptions.
- [x] Select the technology stack (Node.js + Express + SQLite + EJS).
- [x] Create technical design document (`docs/technical-design.md`).
- [x] Create GitHub repository.
- [x] Establish repository conventions.

**Technology stack (decided 2026-11-12):** Node.js + Express + SQLite (better-sqlite3) + EJS, with a layered modular architecture (routes → controllers → services → repositories → models). See `docs/technical-design.md`.

Expected Deliverables:
- Project documentation.
- Repository structure.
- Technology stack decision.

Exit Criteria:

The project scope, objectives, and system boundaries are clearly documented.

### Milestone 1 — Business Analysis and Requirements Engineering

**Objective:** Define the business processes and functional requirements.

Tasks:
- [x] Identify stakeholders.
- [x] Define user roles and responsibilities.
- [x] Analyze the current business problems.
- [x] Create the As-Is business process.
- [x] Design the To-Be business process.
- [x] Define the Order-to-Cash workflow.
- [x] Identify business process exceptions.
- [x] Define business rules.
- [x] Create use cases.
- [x] Create user stories.
- [x] Define acceptance criteria.
- [x] Create requirements traceability matrix.

Expected Deliverables:
- Stakeholder matrix.
- As-Is process diagram.
- To-Be process diagram.
- Business rules documentation.
- Functional requirements.
- User stories.
- Acceptance criteria.
- Requirements traceability matrix.

Exit Criteria:

Every major business process has a defined actor, workflow, business rules, and expected outcome.

### Milestone 2 — System Design and Architecture

**Objective:** Translate business requirements into a technical design.

Tasks:
- [x] Define system architecture.
- [x] Define application modules.
- [x] Design database entities.
- [x] Create Entity Relationship Diagram.
- [x] Define database relationships.
- [x] Define role-based access control.
- [x] Design application navigation.
- [x] Design main application screens.
- [x] Define transaction workflows.
- [x] Define application use cases.
- [x] Document important architecture decisions.

Expected Deliverables:
- System architecture diagram.
- ERD.
- Database schema.
- Module specifications.
- Role permission matrix.
- UI wireframes.
- Application workflow documentation.

Exit Criteria:

The system architecture and database structure are sufficiently defined to begin implementation.

### Milestone 3 — Application Foundation and Authentication

**Objective:** Establish the application environment.

Tasks:
- [x] Initialize the application.
- [x] Configure database connection.
- [x] Configure environment variables.
- [x] Implement authentication.
- [x] Implement user management.
- [x] Implement role-based access control.
- [x] Create shared layout and navigation.
- [x] Create reusable UI components.
- [x] Implement initial seed data.
- [x] Establish testing configuration.

Expected Deliverables:
- Running application.
- Login and logout.
- User management.
- Role-based navigation.
- Database foundation.

Exit Criteria:

Authorized users can sign in and access the appropriate application areas.

### Milestone 4 — Master Data and Inventory Management

**Objective:** Implement foundational business data.

Tasks:
- [x] Implement customer management.
- [x] Implement customer payment terms.
- [x] Implement customer credit limit fields.
- [x] Implement product management.
- [x] Implement product categories.
- [x] Implement warehouse management.
- [x] Implement inventory balances.
- [x] Implement available stock calculation.
- [x] Implement stock movement history.
- [x] Implement validation.
- [x] Create automated tests.

Expected Deliverables:
- Customer module.
- Product module.
- Warehouse module.
- Inventory overview.
- Stock movement records.

Exit Criteria:

Users can maintain master data and monitor inventory accurately.

### Milestone 5 — Sales Order Management

**Objective:** Implement order creation and submission.

Tasks:
- [x] Create sales order list.
- [x] Create sales order details page.
- [x] Create order creation form.
- [x] Support multiple order lines.
- [x] Implement product selection.
- [x] Implement quantity validation.
- [x] Implement order total calculation.
- [x] Implement draft editing.
- [x] Implement order submission.
- [x] Implement order status management.
- [x] Implement order history.
- [x] Add automated tests.

Expected Deliverables:
- Sales order module.
- Order creation workflow.
- Order submission workflow.
- Order status tracking.

Exit Criteria:

Sales Staff can create and submit valid orders.

**Status:** Completed. Sales orders support draft creation, multi-line editing, submission, role-based visibility, full and partial cancellation with mandatory reasons, and order history. Manual cancellation rights follow the Sales Staff (own draft only) / Sales Supervisor (eligible orders) model.

### Milestone 6 — Order Approval and Inventory Reservation

**Objective:** Implement supervisor approval and inventory control.

Tasks:
- [x] Create approval queue.
- [x] Implement order review screen.
- [x] Implement approval action.
- [x] Implement rejection action.
- [x] Implement rejection reason validation.
- [x] Implement inventory availability validation.
- [x] Implement customer credit exposure validation.
- [x] Implement stock reservation.
- [x] Implement reservation release.
- [x] Implement partial order cancellation. *(Delivered in M5 for submitted/approved orders.)*
- [x] Implement approval history.
- [x] Implement audit events.
- [x] Test concurrent reservation scenarios.

Expected Deliverables:
- Approval management module.
- Inventory reservation functionality.
- Approval history.
- Audit records.

Exit Criteria:

Orders can only be approved when the configured business rules are satisfied.

**Status:** Completed. Supervisors review submitted orders in a dedicated queue with line-level credit exposure and stock panels, approve with stock reservation in the default warehouse, or reject with a mandatory reason. Self-approval is blocked, approval history and audit events are recorded, and the in-transaction stock re-check prevents competing approvals from over-reserving.

### Milestone 7 — Delivery and Fulfillment Management

**Objective:** Connect approved orders to warehouse operations.

Tasks:
- [x] Create warehouse fulfillment queue.
- [x] Implement delivery creation.
- [x] Implement delivery detail page.
- [x] Support partial deliveries.
- [x] Implement dispatched quantity tracking.
- [x] Implement remaining quantity calculation.
- [x] Implement stock dispatch.
- [x] Implement delivery status management.
- [x] Prevent over-delivery.
- [x] Update sales order fulfillment status.
- [x] Add automated tests.

Expected Deliverables:
- Delivery management module.
- Fulfillment tracking.
- Inventory dispatch integration.

Exit Criteria:

Warehouse Staff can dispatch products while maintaining correct inventory and order balances.

**Status:** Completed. Warehouse Staff see a fulfillment queue of approved orders with remaining quantities, create partial deliveries, dispatch stock, confirm delivery, and handle delivery exceptions. Over-delivery is blocked, dispatches require the approval reservation, order status updates on confirmation, and cancelled exceptions reverse stock movements.

### Milestone 8 — Invoice and Accounts Receivable Management

**Objective:** Implement invoicing and financial monitoring.

Tasks:
- [x] Create invoice list.
- [x] Create invoice detail page.
- [x] Generate invoices from delivered quantities.
- [x] Prevent duplicate invoicing.
- [x] Calculate invoice totals.
- [x] Calculate due dates.
- [x] Implement invoice issue action.
- [x] Implement invoice status calculation.
- [x] Implement outstanding balance calculation.
- [x] Implement overdue invoice identification.
- [x] Implement invoice void workflow if included.
- [x] Add automated tests.

Expected Deliverables:
- Invoice management module.
- Accounts receivable module.
- Invoice status monitoring.

Exit Criteria:

Finance Staff can generate invoices from eligible deliveries and monitor receivables accurately.

### Milestone 9 — Payment Management

**Objective:** Implement customer payment recording and allocation.

Tasks:
- [x] Create payment list.
- [x] Create payment entry form.
- [x] Implement payment recording.
- [x] Implement payment allocation interface.
- [x] Support multiple invoice allocations.
- [x] Support partial payments.
- [x] Calculate unallocated payment amounts.
- [x] Calculate outstanding invoice balances.
- [x] Prevent over-allocation.
- [x] Implement payment history.
- [x] Update invoice status after allocation.
- [x] Add automated tests.

Expected Deliverables:
- Payment management module.
- Payment allocation workflow.
- Updated receivables monitoring.

Exit Criteria:

Finance Staff can record payments and allocate them without violating financial business rules.

### Milestone 10 — Dashboard and Reporting

**Objective:** Provide operational and management visibility.

Tasks:
- [x] Create dashboard layout.
- [x] Implement sales order KPIs.
- [x] Implement order status distribution.
- [x] Implement inventory overview.
- [x] Implement fulfillment monitoring.
- [x] Implement outstanding receivables summary.
- [x] Implement overdue invoice monitoring.
- [x] Implement recent activity feed.
- [x] Implement date filters.
- [x] Implement customer filter.
- [x] Enforce role-based visibility for finance, inventory, and audit sections.
- [x] Implement audit trail viewer with entity, action, and date filters.
- [x] Verify dashboard calculations.
- [x] Add automated tests.

Expected Deliverables:
- Management dashboard.
- Operational dashboard components.
- Financial summary.
- Reporting filters.

Exit Criteria:

Dashboard information reflects actual system transactions and is not based on hard-coded values.

### Milestone 11 — Testing and Quality Assurance

**Objective:** Validate system functionality and business process consistency.

Tasks:
- [ ] Create test plan.
- [ ] Create UAT scenarios.
- [ ] Execute authentication tests.
- [ ] Execute role permission tests.
- [ ] Execute customer and product tests.
- [ ] Execute sales order tests.
- [ ] Execute approval tests.
- [ ] Execute inventory tests.
- [ ] Execute partial delivery tests.
- [ ] Execute invoice tests.
- [ ] Execute payment allocation tests.
- [ ] Execute exception scenarios.
- [ ] Verify audit records.
- [ ] Fix identified defects.
- [ ] Document test evidence.

Expected Deliverables:
- Test plan.
- UAT scenarios.
- Test execution results.
- Defect records.
- Quality assurance report.

Exit Criteria:

All critical business workflows pass their acceptance criteria.

### Milestone 12 — Documentation and Portfolio Preparation

**Objective:** Prepare the project for public demonstration.

Tasks:
- [ ] Complete README.md.
- [ ] Document installation instructions.
- [ ] Document environment configuration.
- [ ] Document system architecture.
- [ ] Document database design.
- [ ] Prepare demo accounts.
- [ ] Prepare fictional demo data.
- [ ] Capture application screenshots.
- [ ] Prepare demo workflow.
- [ ] Document limitations.
- [ ] Document future enhancements.
- [ ] Publish repository.

Expected Deliverables:
- Complete GitHub repository.
- Application screenshots.
- Demo instructions.
- Technical documentation.
- Business process documentation.
- Portfolio case study.

Exit Criteria:

A reviewer can understand the business problem, run the application, and follow the complete order-to-cash process.

### 3.1 Progress Tracking

| Milestone | Status | Notes |
|---|---|---|
| M0 — Project Initialization | Completed | Repository, stack, schema, and seed data in place |
| M1 — Business Analysis and Requirements Engineering | Completed | PRD.md defines stakeholders, processes, rules, and requirements |
| M2 — System Design and Architecture | Completed | DESIGN.md + `docs/technical-design.md` |
| M3 — Application Foundation and Authentication | Completed | Login, RBAC, user management, shared layout; auth tests passing |
| M4 — Master Data and Inventory Management | Completed | Customers, products, categories, warehouses, inventory, movements, adjustments; 19 tests passing |
| M5 — Sales Order Management | Completed | Order list, detail, create/edit, submit, cancel, history; 33 tests passing |
| M6 - Order Approval and Inventory Reservation | Completed | Approval queue, credit/stock review, approve/reject, reservation; 43 tests passing |
| M7 - Delivery and Fulfillment Management | Completed | Fulfillment queue, partial delivery, dispatch, confirmation, exceptions; 51 tests passing |
| M8 - Invoice and Accounts Receivable Management | Completed | Invoice list/detail, generation from delivered shipments, draft issue, void/re-invoice, overdue tracking, receivables stats; 59 tests passing |
| M9 - Payment Management | Completed | Payment list/detail, recording, multi-invoice allocation, partial payments, unallocated tracking, over-allocation guards; 66 tests passing |
| M10 — Dashboard and Reporting | Completed | Role-aware dashboard (orders, fulfillment, inventory, receivables, overdue invoices, activity), date/customer filters, audit trail viewer; 73 tests passing |
| M11 — Testing and Quality Assurance | Not Started | |
| M12 — Documentation and Portfolio Preparation | Not Started | |

---

## 4. Priority Classification

| Priority | Description |
|---|---|
| P0 | Essential features required for the core business workflow. |
| P1 | Important features that improve visibility and usability. |
| P2 | Optional enhancements that can be implemented after the MVP. |

### P0 Features
- Authentication.
- Role-based access control.
- Customer management.
- Product management.
- Inventory management.
- Sales orders.
- Order approval.
- Inventory reservation.
- Delivery management.
- Invoice generation.
- Payment recording.
- Payment allocation.
- Outstanding receivables.

### P1 Features
- Management dashboard.
- Audit trail.
- Advanced filtering.
- Overdue invoice monitoring.
- UAT documentation.
- Export functionality.

### P2 Features
- Notifications.
- Advanced reporting.
- Payment allocation reversal.
- Additional warehouse functionality.
- Customer self-service portal.

---

## 5. Recommended Repository Structure

```text
b2b-order-payment-management/
│
├── README.md
├── PRD.md
├── PLAN.md
├── DESIGN.md
│
├── docs/
│   ├── business-process/
│   │   ├── as-is-process.md
│   │   └── to-be-process.md
│   │
│   ├── requirements/
│   │   ├── user-stories.md
│   │   ├── business-rules.md
│   │   └── traceability-matrix.md
│   │
│   ├── testing/
│   │   ├── test-plan.md
│   │   └── uat-scenarios.md
│   │
│   └── decisions/
│       └── architecture-decisions.md
│
├── src/
├── database/
│   ├── migrations/
│   └── seeders/
│
├── tests/
│   ├── unit/
│   └── feature/
│
└── screenshots/
```

Adapt the folder structure to the selected framework.

---

## 6. Definition of Done

A feature is considered complete when:

- [ ] Its requirements are documented.
- [ ] Its business rules are implemented.
- [ ] Appropriate user permissions are enforced.
- [ ] Server-side validation is implemented.
- [ ] Database consistency is maintained.
- [ ] Error handling is implemented.
- [ ] Relevant automated tests pass.
- [ ] Audit events are recorded where necessary.
- [ ] Documentation is updated when necessary.

---

## 7. Recommended Demonstration Scenario

The final demonstration should follow one complete B2B transaction.

1. Create a customer.
2. Create a sales order for 20 units.
3. Submit the order for approval.
4. Approve the order.
5. Verify inventory reservation.
6. Dispatch 8 units in the first delivery.
7. Dispatch the remaining 12 units in the second delivery.
8. Generate an invoice from the first delivery (8 units).
9. Generate a second invoice from the second delivery (12 units).
10. Record a partial payment.
11. Display the remaining outstanding balance.
12. Record the final payment.
13. Verify that the invoice status becomes Paid.
14. Review the transaction audit trail.

This scenario demonstrates the integration between sales, warehouse, and finance operations.

---

## 8. Final Project Success Criteria

The project is complete when the MVP workflow is functional, critical acceptance criteria pass, business data remains consistent, and the repository contains sufficient documentation for technical and business evaluation.

---

## 9. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 2026-11-12 | Initial project plan. |
| 1.1 | 2026-11-12 | Technology stack selected; progress tracking added; demo scenario updated for per-delivery invoicing. |
| 1.2 | 2026-11-12 | Credit exposure includes the current order; partial order cancellation added to Milestone 6. |
| 1.3 | 2026-11-12 | Milestone 5 completed; partial cancellation and draft full-cancel rules delivered with order management. |
| 1.4 | 2026-11-12 | Milestone 6 completed; approval queue, line-level credit exposure, stock reservation, and self-approval guard delivered. |
| 1.5 | 2026-11-12 | Milestone 7 completed; partial deliveries, dispatch, confirmation, delivery exceptions, and fulfillment status updates delivered. |
| 1.6 | 2026-11-12 | Milestone 8 completed; per-delivery invoicing, draft issuance, void/re-invoice, overdue monitoring, and receivables stats delivered. |
| 1.7 | 2026-11-12 | Milestone 9 completed; payment recording, multi-invoice allocation, partial payments, unallocated tracking, and over-allocation guards delivered. |
| 1.8 | 2026-11-12 | Milestone 10 completed; role-aware dashboard with date/customer filters, receivables and overdue monitoring, activity feed, and audit trail viewer delivered. |
