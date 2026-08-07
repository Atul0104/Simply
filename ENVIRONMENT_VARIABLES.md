# Environment variables

Use `.env.example` locally and the staging/production examples as secret-manager templates. Do not commit populated values.

Core groups are runtime/public origins (`APP_ENV`, `PUBLIC_*`, `CORS_ORIGINS`), MongoDB, JWT/session/cookie security, consent-policy versions/expiry/GPC, tax/legal identity, notification providers, Razorpay, shipping, metrics, reverse geocoding and the frontend API/CSRF names.

Capacity controls include `WEB_CONCURRENCY`, `UVICORN_LIMIT_CONCURRENCY`, `UVICORN_BACKLOG`, `MAX_INFLIGHT_REQUESTS`, `REQUEST_QUEUE_TIMEOUT_MS`, `PUBLIC_CACHE_TTL_SECONDS`, `MONGO_MAX_POOL_SIZE`, `MONGO_MIN_POOL_SIZE`, `MONGO_WAIT_QUEUE_TIMEOUT_MS` and `MONGO_SERVER_SELECTION_TIMEOUT_MS`. Tune them from staging measurements rather than increasing every limit. Scaled web services use `RUN_BACKGROUND_WORKERS=false`; the dedicated worker container owns scheduled jobs.

Production rules: `USE_MOCK_DB=false`, `ENABLE_DEMO_OTP=false`, `COOKIE_SECURE=true`, a 32+ character random JWT key, narrow HTTPS origins, authenticated replica-set MongoDB, a separate metrics token, live verified webhook secrets and valid business identity. Keep `COOKIE_SAMESITE=lax` unless the deployment architecture and CSRF assessment require another value. Increment policy versions only with approved policy text. Run `backend/scripts/validate_release_env.py` before release.
