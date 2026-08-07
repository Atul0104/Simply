# Testing guide

Backend: run the configured pytest suite from the repository root with the project Python environment and mock database. Frontend: `npm test -- --watchAll=false`; production compilation: `npm run build`. End-to-end tests use Playwright against isolated test data and must cover customer, admin and super-admin positive/negative flows.

Release suites include validation boundaries, authentication/session rotation/CSRF, RBAC/IDOR, consent network inspection, catalogue/inventory concurrency, coupon eligibility, checkout totals, payment/webhook idempotency, order transitions, invoice/label generation, notifications, privacy requests, responsive layouts and accessibility. Tests must not depend on live provider credentials or real customer data.

Local repeatable load batches are provided by `node backend/scripts/load_test.mjs`. Configure only authorized targets through `LOAD_TEST_BASE_URL`, paths through `LOAD_TEST_PATHS`, and bounded concurrency through `LOAD_TEST_MAX_SOCKETS`. See `LOAD_TEST_REPORT.md`; local preview numbers are diagnostic and cannot qualify production capacity.

Spike and soak scenarios use `node backend/scripts/stress_test.mjs`. Stages use `concurrency:seconds`, for example `$env:STRESS_TEST_STAGES='50:10,200:10,500:10'`. A 30-minute soak is `$env:STRESS_TEST_STAGES='100:1800'`. Run long tests only against isolated production-like staging with monitoring and explicit authorization.
