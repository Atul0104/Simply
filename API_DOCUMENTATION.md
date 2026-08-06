# API documentation

Development exposes FastAPI OpenAPI at `/docs`; production intentionally disables it. All application endpoints are under `/api`.

Privacy endpoints:

- `GET /privacy/consent/config` — public effective versions, expiry, copy and enabled categories.
- `POST /privacy/consent` — append a version-matched anonymous or authenticated decision.
- `GET /privacy/consent/me` — current authenticated decision.
- `GET /admin/privacy/consent/config` — admin read.
- `PUT /admin/privacy/consent/config` — super-admin publication with history/audit.
- `GET /admin/privacy/consent/history` — super-admin version history.

Authentication returns a short-lived bearer token and sets rotating refresh/CSRF cookies. `/auth/refresh` and `/auth/logout` require `X-CSRF-Token` matching the CSRF cookie. Payment and shipping webhooks require provider signatures and idempotency. Consult generated OpenAPI for schemas/statuses and `APPLICATION_MANUAL.md` for business flows.
