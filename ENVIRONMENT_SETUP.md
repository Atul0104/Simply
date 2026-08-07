# Environment setup

1. Copy `.env.example` for development, `.env.staging.example` for staging or `.env.production.example` for production.
2. Store real values in the hosting secret manager; never commit `.env`.
3. Development: install `backend/requirements.txt`, run `python -m uvicorn server:app --app-dir backend --reload --port 8000`, then `npm start` in `frontend`.
4. Staging/production: set `USE_MOCK_DB=false`, `ENABLE_DEMO_OTP=false`, secure cookie values, explicit HTTPS origins, authenticated replica-set `MONGO_URL`, random `JWT_SECRET_KEY` and `METRICS_TOKEN`.
5. Run `python backend/scripts/validate_release_env.py <env-file> --require-commerce-providers`.
6. Run migrations in dry-run, back up, apply, validate and record the version.
7. Deploy the API, worker and frontend; verify `/health`, `/ready`, protected `/metrics`, login, quote and provider webhooks.

Only `REACT_APP_*` variables enter the browser bundle. All database, payment, shipping, email and media secrets are server-only.
