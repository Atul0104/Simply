# Architecture

```text
Browser (React, consent/auth/cart)
  | HTTPS /api + bearer access token; refresh/CSRF cookies
  v
FastAPI (validation, RBAC, commerce workflows, audit/outbox)
  |                 |                    |
MongoDB          Razorpay             Shipping/SMTP/SMS
system of record signed webhooks      configured adapters
```

The customer storefront and the Admin/Super Admin portal are route-separated. Super Admin inherits admin capabilities and controls staff/policy publication. The API is authoritative for users, products, inventory, offers, orders, consent and reports. Browser local storage is limited to audited continuity/preferences; no session credential is persisted there.

Payment and inventory operations use server-side totals, idempotency and reservation states. Notifications use an outbox worker. Consent is deny-by-default for optional behavior, versioned, append-only for evidence and synchronized to authenticated accounts.
