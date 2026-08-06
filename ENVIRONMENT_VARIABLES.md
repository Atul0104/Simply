# Environment variables

Use `.env.example` locally and the staging/production examples as secret-manager templates. Do not commit populated values.

Core groups are runtime/public origins (`APP_ENV`, `PUBLIC_*`, `CORS_ORIGINS`), MongoDB, JWT/session/cookie security, consent-policy versions/expiry/GPC, tax/legal identity, notification providers, Razorpay, shipping, metrics, reverse geocoding and the frontend API/CSRF names.

Production rules: `USE_MOCK_DB=false`, `ENABLE_DEMO_OTP=false`, `COOKIE_SECURE=true`, a 32+ character random JWT key, narrow HTTPS origins, authenticated replica-set MongoDB, a separate metrics token, live verified webhook secrets and valid business identity. Keep `COOKIE_SAMESITE=lax` unless the deployment architecture and CSRF assessment require another value. Increment policy versions only with approved policy text. Run `backend/scripts/validate_release_env.py` before release.
