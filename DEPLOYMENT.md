# Perfurm deployment and rollback

## Local development

1. Copy `.env.example` to `.env` and replace the JWT secret.
2. Set `APP_ENV=development`. Use `USE_MOCK_DB=true` only for disposable preview data, or run MongoDB and keep it false.
3. Install backend packages: `python -m pip install -r backend/requirements.txt`.
4. From `backend`, run `python -m uvicorn server:app --reload --port 8000`.
5. From `frontend`, run `npm ci` and `npm start`.
6. Verify `http://localhost:8000/health` and `http://localhost:3000`.

Alternatively configure `.env` and run `docker compose up --build`.

## Staging

Start by copying `.env.staging.example` to a secret-managed `.env`, then run:

`python backend/scripts/validate_release_env.py .env --require-commerce-providers`

- Use an isolated MongoDB database and gateway test account.
- Set `APP_ENV=staging`, `USE_MOCK_DB=false`, `ENABLE_DEMO_OTP=false`.
- Keep access tokens short-lived and configure the refresh-token lifetime through the documented environment variables.
- Store a random JWT secret of at least 32 characters in the platform secret manager.
- Configure a separate `METRICS_TOKEN`; scrape `/metrics` with a bearer token and alert on dead notification jobs and reserved-order growth.
- Enable external notification delivery only after SMTP and/or SMS webhook credentials pass a staging delivery test.
- Restrict `CORS_ORIGINS` to the staging frontend origin.
- Build the frontend with the public HTTPS staging API URL.
- Run CI, API integration tests, responsive browser tests and signed webhook tests.
- Use a MongoDB replica set and run `python backend/scripts/qualify_transactions.py`; deployment fails if abort/commit semantics are not proven.
- Set `PAYMENT_RESERVATION_MINUTES` to the approved checkout window and verify the reservation reaper releases an abandoned test order.
- Back up the database before every migration and retain a migration manifest.
- Dry-run migrations `001_perfume_catalog.py` through `006_privacy_operations.py`; reconcile flagged inventory, designated super-admin data, duplicate active return requests and duplicate order-line reviews before applying them in order during a maintenance window.
- Set `ACCOUNT_DELETION_GRACE_DAYS` and `ORDER_PII_RETENTION_DAYS` only after legal approval; exercise request, approval, retention blocking and anonymization against synthetic staging customers.
- Set `BOOTSTRAP_SUPER_ADMIN_EMAIL`, dry-run `002_admin_rbac.py`, then apply it only after verifying the designated account.

### Tax and invoice environment

Set `TAX_PRICES_INCLUDE_GST`, `TAX_ORIGIN_STATE`, `BUSINESS_LEGAL_NAME`, `BUSINESS_GSTIN`, and `BUSINESS_ADDRESS` in the environment. Changes affect new quotes and orders only; issued invoices and existing order snapshots are immutable. Apply `backend/migrations/007_tax_invoices.py` after a verified database backup and before enabling invoice downloads.

## Production checklist

Copy `.env.production.example` into the deployment secret manager and run the same release validator before building. Keep `REACT_APP_BACKEND_URL` blank when using the included same-origin Nginx proxy.

- [ ] P0 items in `PRODUCTION_AUDIT.md` closed and staging-approved.
- [ ] HTTPS configured and HTTP redirected.
- [ ] `APP_ENV=production`; mock/demo flags false.
- [ ] Secrets loaded from a secret manager and never committed.
- [ ] CORS contains only the production storefront origin.
- [ ] MongoDB replica set, authentication, encryption and automated backups enabled.
- [ ] Transaction qualification script passes against the exact production topology.
- [ ] Razorpay keys/webhook secret configured with an HTTPS webhook.
- [ ] Set `PUBLIC_API_URL`, `SHIPPING_PROVIDER_API_URL`, `SHIPPING_PROVIDER_API_TOKEN` and a separate `SHIPPING_PROVIDER_WEBHOOK_SECRET`; verify label creation plus signed duplicate webhook delivery before enabling seller fulfilment.
- [ ] Notification queue, retry and dead-letter monitoring configured.
- [ ] `/ready` is healthy on every replica and `/metrics` is authenticated and scraped.
- [ ] Migration dry run and restore rehearsal complete.
- [ ] Privacy retention values, deletion approvers and anonymization evidence approved by legal/security owners.
- [ ] Error monitoring, metrics, uptime and payment/API/database alerts enabled.
- [ ] CDN behavior verified without caching private API responses.
- [ ] Registration, catalogue, cart, payment, order, admin and refund smoke tests pass.
- [ ] Admin creates a product with 10/30/50/100 ml variants, adjusts each quantity, and confirms checkout decrements only the selected size.

## Third-party activation runbook

All integrations are configured centrally through environment variables. Replace values in the deployment secret manager, redeploy/restart the backend, and verify `GET /api/admin/integrations/status`; no source-code edit is required.

### Razorpay

1. Create test keys first, then live keys after staging approval.
2. Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a separate `RAZORPAY_WEBHOOK_SECRET`.
3. Register `https://YOUR_API/api/payments/webhook` in Razorpay and enable payment/refund events used by the application.
4. Confirm order creation, browser checkout, signature verification, duplicate webhook delivery, failure, partial/full refund and reconciliation.

### Shipping carrier

1. Set the carrier label endpoint in `SHIPPING_PROVIDER_API_URL` and its bearer credential in `SHIPPING_PROVIDER_API_TOKEN`.
2. Set a unique `SHIPPING_PROVIDER_WEBHOOK_SECRET`; configure the carrier to send an HMAC-SHA256 signature to `https://YOUR_API/api/shipping/webhook`.
3. Qualify label/AWB creation, duplicate events, tracking transitions, cancellation and return movement using staging orders.

### Email and SMS

1. For SMTP, set host/port, exactly one of TLS or SSL, credentials and a verified `SMTP_FROM_EMAIL`.
2. For SMS, set an HTTPS `SMS_WEBHOOK_URL` and `SMS_WEBHOOK_TOKEN`; the adapter must accept the application notification JSON.
3. Keep `NOTIFICATION_DELIVERY_ENABLED=false` until staging messages arrive, retries work and dead-letter alerts are configured.

### Reverse geocoding

Set `REVERSE_GEOCODING_URL` to a provider URL containing literal `{latitude}` and `{longitude}` placeholders. Confirm HTTPS, quota, India address quality, privacy terms and mobile-browser permission behavior.

### Secrets and rotation

Never place live values in Git, images or frontend build variables. Rotate JWT, metrics, provider and webhook secrets through the platform secret manager; restart the API and retest health/readiness and signed callbacks after rotation. `REACT_APP_BACKEND_URL` is public configuration, not a secret.

## Rollback

1. Shift traffic to the previous immutable image tag.
2. Disable checkout if payment/order state may be inconsistent; never delete orders or payment events.
3. Run only the documented reverse migration. Otherwise restore the pre-deploy snapshot in isolation and reconcile before switching.
4. Replay/reconcile gateway webhooks by event ID after recovery.
5. Validate health, catalogue, authentication and a non-charge checkout smoke test.
6. Record affected orders and reconciliation results.

Never roll back by resetting the Git worktree or deleting production collections.

The catalogue migration provides a dry-run rollback and an explicit `--rollback --apply` mode. Use it only after stopping catalogue writes and verifying the migration backup collection.
