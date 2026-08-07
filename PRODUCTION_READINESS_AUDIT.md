# Perfurm production-readiness audit

## Phase 1 commerce qualification update

Code enforces environment-bound databases, startup connectivity checks, pooled MongoDB connections, critical indexes, explicit reservation timestamps, and captured-payment reconciliation. A verified late capture cannot commit expired inventory. Real Atlas transactions, Razorpay staging flows and backup restore remain `CONFIGURATION_REQUIRED` until credentials are supplied and drills are recorded.

Last reviewed: 7 August 2026. This is the release-owner view; detailed implementation history remains in `PRODUCTION_AUDIT.md`.

## Architecture

- React 19/Create React App storefront and role portals, with React Router, Axios, Tailwind and Radix UI.
- FastAPI modular-monolith API backed by Motor/MongoDB. Commerce logic currently remains concentrated in `backend/server.py`.
- MongoDB variant inventory, reservations, immutable order price snapshots, movement history and transaction support.
- HttpOnly rotating refresh session plus short-lived in-memory access token; double-submit CSRF protection on refresh/logout.
- Provider-neutral shipping HTTP adapter, Razorpay payment adapter, SMTP/SMS notification outbox and signed webhooks.
- Docker/Nginx deployment, CI, request IDs, health/readiness/metrics and controlled overload handling.

## Risk register

### Critical release blockers

1. Real MongoDB Atlas replica-set transactions, backup/restore and concurrent final-item checkout are not yet staging-qualified.
2. Razorpay test/live credentials and signed webhook delivery have not been certified end-to-end.
3. The selected Shiprocket contract needs a provider-specific adapter and staging certification; the generic adapter is not proof of Shiprocket compatibility.
4. Transactional email is not production-qualified. OTP login must not launch until delivery and domain authentication are verified.
5. Licensed media is still served from external hosts in places; migrate it to the controlled CDN before launch.

### High

- `backend/server.py` and several React pages are oversized. Split them incrementally behind tests; do not perform a risky rewrite before launch.
- Create React App is legacy and public product pages are client-rendered. Plan a Vite/SSR or prerender migration after commerce qualification.
- Physical iOS/Android, Firefox and WebKit checkout testing remains outstanding.
- Legal approval is required for tax, invoice, privacy, returns, retention and cookie wording.
- Wishlist functional-consent classification needs a legal/product decision.

### Medium

- Continue centralizing frontend API calls and resolving React hook warnings.
- Add Cloudinary, Brevo, Turnstile, GA4 and Better Stack adapters only when selected and credentialed.
- Expand item-level exchange, NDR/RTO and provider reconciliation operations.

## Improvements verified

Server-authoritative pricing, variant inventory, atomic stock predicates, checkout idempotency, payment/shipping webhook signatures, refund idempotency, order transitions, IDOR tests, admin permissions, audit records, consent evidence, security headers, safe error envelopes, database indexes, public caching, load shedding and worker separation are implemented. Development mocks are rejected in staging/production.

## Launch decision

Status: **blocked for real customer payments**. The application is suitable for production-like staging after real environment validation. Do not enable Razorpay live mode until every critical blocker above has evidence attached to the launch checklist.
