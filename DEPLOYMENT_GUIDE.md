# Deployment guide

1. Copy the relevant environment example into the platform secret manager and replace every placeholder; never upload a populated file to Git.
2. Provision authenticated replica-set MongoDB, TLS ingress, frontend/API services and provider webhook URLs.
3. Run environment validation, backend tests and `npm run build`; apply reviewed migrations/seed operations once.
4. Deploy to staging, execute `PRODUCTION_CHECKLIST.md`, cookie/security testing and provider sandbox orders.
5. Back up the database, deploy immutable artifacts, run `/health` and `/ready`, then smoke-test consent, login and checkout.
6. Monitor errors, latency, worker queues, payment/shipping webhook failures and consent-config errors. Roll back the artifact—not the database—unless a documented migration rollback is safe.

Changing backend environment values requires a restart. Changing `REACT_APP_*` values requires rebuilding the frontend.

The Compose deployment starts a multi-worker API and one dedicated background-worker service. Scale API containers only after sizing MongoDB connection pools (`replicas × web workers × max pool size`) within the database connection budget. Never enable `RUN_BACKGROUND_WORKERS` on scaled web containers. Confirm Nginx returns `X-Cache-Status` only for approved public GET routes and never caches authentication, customer, checkout or admin responses.
