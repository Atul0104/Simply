# Architecture

> Current shape: a production-hardened modular monolith. Commerce correctness is implemented in FastAPI/MongoDB, but `backend/server.py` remains an acknowledged maintainability hotspot. Extraction into routes/services/repositories/provider adapters must be incremental and protected by the existing API tests; a pre-launch rewrite is explicitly rejected.

```text
Browser (React, consent/auth/cart)
  | HTTPS /api + bearer access token; refresh/CSRF cookies
  v
FastAPI (validation, RBAC, commerce workflows, audit/outbox)
  |                 |                    |
MongoDB          Razorpay             Shipping/SMTP/SMS
system of record signed webhooks      configured adapters
```

Production web processes run multiple Uvicorn workers with bounded admission concurrency. Reservation expiry and notification delivery run in a separate singleton worker service; they must not be enabled inside horizontally scaled web workers. MongoDB pool sizes and timeouts are environment controlled. Approved anonymous public reads use a short per-worker encoded-response cache and Nginx microcache; authenticated/admin routes remain `no-store`. Overload is rejected quickly with retryable HTTP 503 and monitored through Prometheus counters.

The customer storefront and the Admin/Super Admin portal are route-separated. Super Admin inherits admin capabilities and controls staff/policy publication. The API is authoritative for users, products, inventory, offers, orders, consent and reports. Browser local storage is limited to audited continuity/preferences; no session credential is persisted there.

Payment and inventory operations use server-side totals, idempotency and reservation states. Notifications use an outbox worker. Consent is deny-by-default for optional behavior, versioned, append-only for evidence and synchronized to authenticated accounts.
