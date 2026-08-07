# Testing strategy

## Automated gates

- Backend: pytest unit/integration tests for auth, RBAC/IDOR, catalogue, variants, concurrency-safe inventory, coupons, payments/webhooks, shipping, returns, reviews, privacy and invoices.
- Frontend: optimized build plus Playwright/axe flows across desktop, tablet and mobile Chromium.
- Security: CodeQL, Dependabot, npm critical audit, environment validation and OWASP ZAP against staging.
- Performance: batch load, spike and 30–60 minute soak against production-like staging; report p50/p95/p99, errors, saturation and database latency.

## Required launch matrix

Registration, verification, login/logout/refresh, reset, search, variants, cart, coupon, current/saved address, COD, Razorpay sandbox, order/invoice/tracking, cancellation, item return/refund and review. Repeat operational actions as Customer, delegated Admin and Super Admin. Add Firefox/WebKit and physical iOS/Android evidence.

Provider tests cover unavailable, timeout, invalid/duplicate/delayed webhook and reconciliation. Financial and inventory tests must assert database state, not only UI messages. Production smoke tests never create fake paid transactions.
