# Test Plan

## B2B Order & Payment Management System

**Version:** 1.0  
**Date:** 2026-11-12  
**Scope:** MVP Order-to-Cash workflow, role-based access, reporting, and audit trail.

---

## 1. Objectives

1. Verify that every critical Order-to-Cash workflow behaves according to `PRD.md` and the business rules (BR-001 – BR-032).
2. Verify transaction integrity: no partial writes, no negative stock, no duplicate invoices, no over-allocation.
3. Verify role-based access control for all six roles.
4. Verify that dashboard and audit figures are derived from real transactions and respect role visibility.
5. Produce repeatable evidence for portfolio review and future regression testing.

## 2. Scope

### In scope

- Authentication, logout, session protection.
- User management and role assignment.
- Customer, product, category, and warehouse master data.
- Inventory balances, movements, and manual adjustments.
- Sales order creation, editing, submission, cancellation.
- Supervisor approval and rejection, credit exposure warning and override, stock reservation.
- Partial delivery, dispatch, confirmation, delivery exceptions and resolution.
- Invoice generation, issuance, voiding, re-invoicing, overdue detection.
- Payment recording, partial payment, multi-invoice allocation, over-allocation guards.
- Dashboard KPIs, date/customer filters, role-based section visibility.
- Audit trail recording, viewing, and filtering.

### Out of scope

- Tax calculation, e-invoicing integration, payment gateway, bank reconciliation, general ledger.
- Payment allocation reversal (post-MVP).
- Load, penetration, and disaster-recovery testing.
- Multi-currency and consolidated invoicing.

## 3. Test Levels

| Level | Purpose | Tooling |
|---|---|---|
| Unit-level logic | Calculations, status derivation, filter normalization | Exercised through service calls in integration tests |
| Integration | HTTP routes, RBAC, validation, database writes, transactions | Jest + Supertest against an in-memory SQLite database |
| Manual smoke | Visual layout, navigation, empty states, form usability | Browser session against the local server |
| UAT | End-to-end business scenarios with role hand-offs | Documented in `uat-scenarios.md`, backed by automated tests |

## 4. Environment

| Item | Value |
|---|---|
| Runtime | Node.js v24.13.1 |
| Package manager | npm 11.8.0 |
| Framework | Express 5 + EJS (server-rendered) |
| Database | SQLite via better-sqlite3 |
| Test runner | Jest 30 + Supertest 7 |
| Test database | In-memory SQLite (`DATABASE_PATH=:memory:`) |
| CSRF | Disabled only under `NODE_ENV=test` |
| Command | `npm test` (`jest --runInBand`) |

The test database is migrated and seeded for every suite. Each suite owns its process because Jest runs serially (`--runInBand`) and the database module is a singleton.

## 5. Test Data

- 6 users, one per role (sales, supervisor, warehouse, finance, management, admin).
- 8 fictional customers with different payment terms (7–45 days) and credit limits.
- 15 active products across 3 categories, opening stock in warehouse `WH-JKT`.
- Transactions are created inside the tests so each suite controls its own state.
- No production or personal data is used.

## 6. Entry and Exit Criteria

### Entry criteria

- Migrations and seed data run without errors.
- The application starts with `npm start`.
- All routes are registered and role guards are in place.

### Exit criteria

- 100% of automated tests pass.
- Every P0/P1 requirement has at least one automated or documented UAT check.
- No open Critical or High defects.
- Dashboard and audit pages pass manual smoke checks.
- Test evidence and defect log are committed.

## 7. Coverage Strategy

| Area | Primary tests |
|---|---|
| Auth and RBAC | `tests/integration/auth.test.js` |
| Master data and inventory | `tests/integration/master-data.test.js` |
| Order lifecycle | `tests/integration/orders.test.js` |
| Approval, credit, reservation | `tests/integration/approvals.test.js` |
| Delivery and exceptions | `tests/integration/deliveries.test.js` |
| Invoicing and receivables | `tests/integration/invoices.test.js` |
| Payments and allocation | `tests/integration/payments.test.js` |
| Dashboard and audit trail | `tests/integration/dashboard.test.js` |

Traceability from scenarios to requirements is maintained in `uat-scenarios.md`.

## 8. Defect Management

| Severity | Definition | Required action |
|---|---|---|
| Critical | Data corruption, unauthorized financial action, workflow completely blocked | Fix before release |
| High | A core business rule is violated but data remains recoverable | Fix before release |
| Medium | Incorrect display or a workaround exists | Fix or document before release |
| Low | Cosmetic or wording issue | Backlog |

Defects are logged in `defect-log.md` with reproduction steps, root cause, resolution, and the regression test that prevents recurrence.

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Concurrency on SQLite | Two approvals could compete for stock | Approval runs in one transaction and locks stock through conditional updates; covered by a competing-approval test |
| Floating-point money | Rounding differences in balances | Values rounded to 2 decimals; balances use a 0.005 tolerance |
| Date-dependent tests | Overdue scenarios depend on "today" | Tests create invoices with explicit past dates and derive due dates from customer terms |
| Seed drift | Tests rely on specific seed records | Tests reference seed data intentionally; seed changes must update affected tests |
| In-memory DB singleton | Parallel suites would share state | Jest runs with `--runInBand` |
