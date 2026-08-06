# Perfurm

Perfurm is a single-brand perfume-commerce application built with React, FastAPI and MongoDB. The supported application profiles are Customer, Admin and Super Admin. Legacy seller and delivery data models remain for fulfilment compatibility, but those users do not have public application portals.

## Capabilities

- Responsive catalogue, search, bottle-size pricing, wishlist, cart and recommendations.
- Address book with validated Indian addresses, current-location lookup and serviceability.
- Server-authoritative checkout, coupons, Razorpay/COD, inventory reservations and order tracking.
- Reviews, returns, notifications, invoices, tax snapshots and shipping labels.
- Admin catalogue, inventory, order/refund, customer, coupon, offer, CMS and analytics operations.
- Super Admin staff/RBAC, privacy operations, audit records and complete Admin-mode access.
- Short-lived access tokens, rotating HttpOnly refresh sessions, throttling, security headers and provider webhook verification.

## Documentation

- [Application manual](APPLICATION_MANUAL.md)
- [Deployment, provider setup and rollback](DEPLOYMENT.md)
- [Production audit and launch gates](PRODUCTION_AUDIT.md)
- Interactive API documentation: `http://localhost:8000/docs` outside production

## Local development

1. Copy `.env.example` to `.env` and replace `JWT_SECRET_KEY`.
2. Use `USE_MOCK_DB=true` only for a disposable local preview, or start MongoDB as a replica set.
3. Install the backend: `python -m pip install -r backend/requirements.txt`.
4. Run `python -m uvicorn server:app --app-dir backend --reload --port 8000`.
5. Run `npm ci` and `npm start` from `frontend`.
6. Open `http://localhost:3000`; health is `http://localhost:8000/health`.

Preview credentials are development-only: `customer@example.com / customer123` and `admin@perfurm.com / admin123`.

## Quality gates

```powershell
python -m pytest -q
cd frontend
npm ci
npm run build
npm run test:e2e
```

CI compiles the API, runs the complete backend suite, audits production frontend dependencies, builds an optimized frontend, and runs responsive Chromium/axe checks.

## Going live

Never commit a real `.env`. Copy `.env.production.example` into the deployment platform’s secret manager, fill every required value, then run:

```powershell
python backend/scripts/validate_release_env.py .env --require-commerce-providers
python backend/scripts/qualify_transactions.py
```

Real checkout must stay disabled until Razorpay test capture/refund/webhook reconciliation, shipping label/webhook qualification, notification delivery, MongoDB transactions, migrations, backup restore, and the acceptance suite pass in staging. See [DEPLOYMENT.md](DEPLOYMENT.md) for exact provider and deployment steps.
