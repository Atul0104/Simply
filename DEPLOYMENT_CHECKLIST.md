# Deployment checklist

## Before deployment

- [ ] Approved commit passed CI, CodeQL, dependency audit and staging E2E.
- [ ] Environment validation passes; mocks/demo OTP are disabled.
- [ ] Atlas backup completed and migrations rehearsed in dry-run.
- [ ] Provider sandbox credentials and signed webhook endpoints verified.
- [ ] Business identity, GST, tax, shipping, returns, privacy and retention settings approved.
- [ ] Cloudflare DNS/TLS/WAF/cache rules reviewed; `/api`, checkout and account data are not cached.

## Deploy

- [ ] Deploy database migration, API replicas, one background worker, then frontend.
- [ ] Confirm graceful startup, `/health`, `/ready`, authenticated `/metrics` and log ingestion.
- [ ] Smoke test registration/login, catalogue, variant price, cart, address, coupon, COD and sandbox payment.
- [ ] Verify order, inventory ledger, invoice, notification, shipment and admin timeline.

## After deployment

- [ ] Monitor errors, p95 latency, overload rejections, payment/shipping webhooks and notification dead letters.
- [ ] Record release, migration, provider evidence and rollback decision owner.
