# Perfurm Pending Task Register

Last reviewed: 2026-08-07  
Current release decision: **Staging-ready; not approved for production.**  
Source documents: `PRODUCTION_AUDIT.md`, `PRODUCTION_CHECKLIST.md`, `LOAD_TEST_REPORT.md`, privacy/security documentation and the current repository audit.

## Status legend

- [ ] Pending
- [~] In progress or partially implemented
- [x] Completed and verified
- **P0** blocks production or live payments
- **P1** required before general availability
- **P2** post-launch scale, quality or maintainability improvement

## P0 — production and live-payment blockers

### Production environment and database

- [ ] Provision an authenticated MongoDB replica set with TLS in production-like staging.
- [ ] Configure production database users using least privilege and remove mock-database access.
- [ ] Run `backend/scripts/qualify_transactions.py` against the exact staging topology.
- [ ] Test concurrent checkout, inventory reservation, payment capture, cancellation and reservation expiry using real MongoDB transactions.
- [ ] Create automated encrypted database backups and define retention.
- [ ] Complete a documented backup-restore drill and record recovery time/data-loss results.
- [ ] Run all reversible migrations against a staging copy of production-shaped data.
- [ ] Generate and verify unique product slugs and SKUs.
- [ ] Map legacy bottle sizes into authoritative product variants.
- [ ] Reconcile current, reserved and available stock for every size/SKU.
- [ ] Confirm every migration rollback before production execution.

### Razorpay and financial processing

- [ ] Obtain separate Razorpay staging and live credentials.
- [ ] Add credentials only through the deployment secret manager/environment variables.
- [ ] Register the signed Razorpay webhook URL.
- [ ] Test successful payment creation, authorization and capture.
- [ ] Test failed, abandoned, timed-out and customer-cancelled payments.
- [ ] Test duplicate requests and verify checkout idempotency.
- [ ] Test duplicate, delayed and out-of-order webhooks.
- [ ] Test full and partial refunds through Razorpay staging.
- [ ] Verify refund/webhook reconciliation after transient provider failures.
- [ ] Confirm no raw card information is stored or logged.
- [ ] Reconcile platform order totals, gateway payment totals and refund totals.
- [ ] Keep live payment methods disabled until the payment acceptance report is signed off.

### Shipping provider

- [ ] Select the production carrier/aggregator.
- [ ] Execute the required DPA/service agreement and review data retention.
- [ ] Configure shipping API URL, token and webhook secret through environment variables.
- [ ] Adapt the provider-neutral shipping contract to the selected provider where necessary.
- [ ] Test serviceability, rate calculation and delivery estimates.
- [ ] Test AWB and shipping-label creation.
- [ ] Test pickup scheduling and pickup cancellation.
- [ ] Test shipment cancellation before dispatch.
- [ ] Test tracking events through delivered status.
- [ ] Test signed, duplicate and out-of-order shipping webhooks.
- [ ] Test reverse pickup and return shipment flows.
- [ ] Verify customer address/phone exposure is restricted to required fulfilment data.

### Transactional communications

- [ ] Select and configure the production email provider/SMTP service.
- [ ] Verify sending domain, SPF, DKIM and DMARC.
- [ ] Select and configure the production SMS/WhatsApp provider if required.
- [ ] Test OTP and password-reset delivery without exposing OTPs in responses or logs.
- [ ] Test order, payment, packing, shipment, delivery, cancellation, return and refund notifications.
- [ ] Test retries, provider outages and dead-letter processing.
- [ ] Verify marketing messages respect account preferences and consent requirements.
- [ ] Configure alerting for blocked or failed notification jobs.

### Production configuration and deployment

- [ ] Populate `.env.production.example` values in a real secret manager; never commit live secrets.
- [ ] Run `backend/scripts/validate_release_env.py .env --require-commerce-providers` successfully.
- [ ] Set final HTTPS site/API origins and restricted CORS origins.
- [ ] Set production business legal name, GSTIN, address and operating business record.
- [ ] Verify Secure, HttpOnly, SameSite, domain and path attributes for session cookies.
- [ ] Verify CSRF protection through the final same-origin/reverse-proxy deployment.
- [ ] Configure TLS certificates and HSTS.
- [ ] Deploy immutable frontend/backend artifacts rather than development servers.
- [ ] Configure Nginx/load balancer health checks, timeouts, compression and static caching.
- [ ] Complete deployment, rollback and database-change rehearsal.
- [ ] Assign production operations ownership and on-call contacts.

## P0 — security, authorization and privacy

### Security validation

- [ ] Run SAST against frontend and backend code.
- [ ] Run dependency vulnerability scanning and resolve all unaccepted critical/high findings.
- [ ] Run repository and deployment secret scanning.
- [ ] Run authenticated DAST against production-like staging.
- [ ] Test SQL/NoSQL injection, XSS, CSRF, SSRF, unsafe redirects and malicious file inputs.
- [ ] Test horizontal and vertical IDOR across customers, admins and Super Admin.
- [ ] Verify public registration can create only Customer accounts.
- [ ] Verify Admin cannot grant itself Super Admin privileges.
- [ ] Verify Super Admin-only staff, policy and destructive privacy operations.
- [ ] Test disabled/blocked accounts, timed restrictions and session revocation.
- [ ] Test brute-force, credential-stuffing, OTP and reset rate limits.
- [ ] Verify sensitive fields, tokens, passwords, OTPs and provider secrets never enter logs or public responses.
- [ ] Review production security headers and Content Security Policy through the final proxy.
- [ ] Establish incident response, vulnerability reporting and secret-rotation procedures.
- [ ] Obtain formal security sign-off.

### Consent and privacy

- [ ] Decide with privacy counsel whether wishlist storage is strictly necessary functionality.
- [ ] If wishlist is optional, gate persistence behind functional consent and provide an in-memory/no-storage fallback.
- [ ] Add Playwright network assertions proving optional requests do not occur before consent.
- [ ] Test accept all, reject optional and every granular category combination.
- [ ] Test consent withdrawal and optional-cookie/storage deletion without page reload.
- [ ] Test consent expiry and policy-version invalidation.
- [ ] Test Global Privacy Control behavior.
- [ ] Test consent synchronization for anonymous and authenticated customers.
- [ ] Verify consent evidence retention and access controls.
- [ ] Schedule `backend/scripts/cleanup_privacy_data.py` in production.
- [ ] Add legal-hold support and deletion evidence to retention automation.
- [ ] Approve Cookie Policy, Privacy Policy, lawful bases and retention periods with qualified counsel.
- [ ] Complete international-transfer and subprocessors review.
- [ ] Execute DPAs/contracts with database, hosting, payment, shipping and communications vendors.
- [ ] Migrate licensed catalogue/editorial/advertisement assets from third-party URLs to the controlled first-party CDN.
- [ ] Verify talent/image/video licence evidence is stored and linked to CMS assets.
- [ ] Obtain formal Privacy/Legal sign-off.

## P0 — performance and reliability

- [ ] Define expected traffic, peak concurrent users and orders-per-minute capacity.
- [ ] Approve service-level objectives; proposed starting targets are p95 under 750 ms for reads, p95 under 1.5 seconds for checkout APIs and error rate below 1%.
- [ ] Profile catalogue, reviews, bestsellers, search and admin list queries.
- [ ] Confirm required MongoDB indexes using production-shaped query plans.
- [ ] Remove remaining N+1 database query patterns.
- [ ] Add safe caching for public catalogue, CMS, consent configuration and merchandising reads.
- [ ] Configure and measure multiple Uvicorn workers/containers.
- [ ] Size database connection pools against worker and replica counts.
- [ ] Configure ingress concurrency/rate limits and explicit 429/503 load shedding.
- [ ] Repeat 50/200/500/1,000/1,500/2,000/5,000 request tests in production-like staging.
- [ ] Add authenticated load scenarios for login/refresh, search, address, cart quote and admin lists.
- [ ] Add isolated write-load scenarios for inventory reservation, idempotent checkout, payment webhooks and order transitions.
- [ ] Run spike and breakpoint tests.
- [ ] Run a 30–60 minute soak test while monitoring resource growth and recovery.
- [ ] Monitor CPU, memory, event-loop lag, MongoDB latency/connections, worker queues and error rate during tests.
- [ ] Meet approved latency/error SLOs and obtain performance sign-off. Current local API result fails latency qualification.

## P1 — complete commerce operations

### Catalogue and inventory

- [ ] Add safe CSV/XLSX product bulk import with validation preview and row-level errors.
- [ ] Add product/catalogue bulk export.
- [ ] Add inventory bulk adjustment/import with idempotency and audit history.
- [ ] Add damaged/quarantine inventory inspection and release/disposal workflow.
- [ ] Confirm variant pricing and stock update correctly for every supported bottle size.
- [ ] Validate unique SKU, barcode, slug and product identifiers.
- [ ] Complete taxonomy, fragrance-family, note, concentration, gender and occasion reference data.
- [ ] Add controlled media upload, optimization, alt text, licensing and CDN publication.
- [ ] Test scheduled/coming-soon catalogue publication and expiry.

### Search and discovery

- [ ] Introduce a production search index or dedicated full-text search implementation.
- [ ] Add typo tolerance, synonyms, fragrance-note search and relevance tuning.
- [ ] Add safe search analytics only after appropriate consent.
- [ ] Add zero-result suggestions and merchandising controls.
- [ ] Verify filters, sorting and pagination at production catalogue size.

### Tax, invoice and COD

- [ ] Obtain tax/accounting approval for GST calculation and inclusive/exclusive catalogue pricing.
- [ ] Validate intra-state and inter-state tax behavior.
- [ ] Validate shipping, discounts, coupons, refunds and rounding on invoices.
- [ ] Configure and enforce final COD eligibility and fee policy.
- [ ] Verify invoice numbering, legal identity and immutable invoice snapshots.
- [ ] Qualify PDF invoices and marketplace-style shipping stickers on mobile and desktop.
- [ ] Test invoice re-download and corrected/refund documentation.

### Orders, returns and customer credits

- [ ] Decide whether item-level partial returns are required before launch.
- [ ] Implement item-level return/refund calculations if required.
- [ ] Decide whether exchanges are required and implement exchange fulfilment if approved.
- [ ] Complete reverse-logistics integration and disposition workflow.
- [ ] Decide whether promotional credit can be redeemed at checkout.
- [ ] If enabled, implement transactional credit reservation, deduction, cancellation restoration and refund accounting.
- [ ] Verify every order state transition, administrator action and customer notification.
- [ ] Test inventory restoration exactly once for cancellation, payment failure and return restocking.

### Reviews and support

- [ ] Improve customer review-authoring UX for delivered order items.
- [ ] Add Admin review replies if approved.
- [ ] Add review statistics and moderation reporting.
- [ ] Test duplicate prevention, verified-purchase checks and helpful-vote idempotency.
- [ ] Configure production customer-support contact information and hours.
- [ ] Define ticket SLAs, escalation, assignment and closure reporting.

## P1 — complete acceptance testing

- [ ] Run registration, login, logout, password reset and session refresh end to end.
- [ ] Run Customer/Admin/Super Admin positive and negative authorization matrices.
- [ ] Run catalogue → bottle size/price/stock → cart → address → serviceability → coupon → payment/COD → order → invoice/label → tracking → cancellation/return/refund end to end.
- [ ] Verify offer eligibility for guest, first order, milestone and explicitly targeted users.
- [ ] Verify address validation and current-location permission/error/correction flows.
- [ ] Verify empty cart, wishlist and orders recommendation states.
- [ ] Test network loss, API timeout, provider outage, duplicate submission and retry UX.
- [ ] Run responsive tests on physical Android and iPhone devices.
- [ ] Run Chromium, Firefox and WebKit/Safari browser coverage.
- [ ] Test desktop, laptop, tablet and mobile breakpoints without horizontal overflow.
- [ ] Complete keyboard, screen reader, focus, zoom, contrast and reduced-motion accessibility testing.
- [ ] Resolve all critical/serious accessibility findings.
- [ ] Test frontend error boundary and user-friendly API validation messages.
- [ ] Add React unit/component tests; the frontend currently has no unit-test files.
- [ ] Expand Playwright coverage for consent, checkout, orders, admin operations and Super Admin staff management.
- [ ] Obtain product-owner/user acceptance sign-off.

## P1 — monitoring and operations

- [ ] Select and integrate centralized exception reporting.
- [ ] Add distributed request tracing across API and provider calls.
- [ ] Build dashboards for latency, error rates, order conversion, payment failures, inventory reservations, notification backlog and webhook failures.
- [ ] Configure alerts for API readiness, database failure, queue buildup and provider outages.
- [ ] Create runbooks for payment mismatch, stuck inventory, failed shipment, notification backlog and consent-config failure.
- [ ] Define on-call schedules and escalation contacts.
- [ ] Test incident response, rollback and disaster recovery.
- [ ] Confirm logs are access-controlled, privacy-safe and retained for approved periods.

## P1 — SEO and production web delivery

- [ ] Introduce server rendering or prerendering for important catalogue/product pages if SEO requirements demand it.
- [ ] Validate canonical URLs, sitemap, robots and structured product data on the final domain.
- [ ] Add real social-sharing images hosted on the controlled CDN.
- [ ] Run Lighthouse/Core Web Vitals testing against optimized production assets.
- [ ] Configure CDN caching, image formats, responsive image sizes and cache invalidation.
- [ ] Verify all external links, legal pages and footer content.

## P2 — architecture and maintainability

- [ ] Split `backend/server.py` into configuration, models/schemas, routers, services, repositories, workers and provider adapters.
- [ ] Add a centralized typed frontend API client.
- [ ] Add server-state/query caching and standardized loading/error handling.
- [ ] Remove remaining direct or legacy access-token fallbacks from individual pages.
- [ ] Remove or isolate legacy Seller and Delivery Partner UI/code paths that are not supported application profiles.
- [ ] Continue converting unbounded legacy list endpoints to server-side pagination.
- [ ] Resolve all remaining React hook dependency warnings.
- [ ] Upgrade/migrate from the legacy Create React App build chain without forced dependency changes.
- [ ] Establish frontend/backend linting, formatting and type-checking gates.
- [ ] Add contract tests for payment, shipping, notification and geocoding adapters.
- [ ] Add automated API compatibility and migration tests.
- [ ] Document architecture decisions for authentication, consent, inventory, payments and notifications.

## Release approvals

- [ ] Engineering confirms migrations, tests, observability and rollback are complete.
- [ ] Application Security confirms no unresolved unaccepted critical/high vulnerabilities.
- [ ] Privacy/Legal approves policies, consent, vendors, retention and data transfers.
- [ ] Finance/Tax approves invoices, GST, refunds, settlement and COD behavior.
- [ ] Operations approves shipping, notification providers, monitoring and incident runbooks.
- [ ] Product owner approves desktop/mobile experience and end-to-end business flows.
- [ ] Final production go/no-go review is completed and recorded.

## Completed baseline — do not reopen without a regression

- [x] Customer, Admin and Super Admin are the supported public profiles.
- [x] Public registration is restricted to Customer accounts.
- [x] Strong passwords, short-lived access tokens and rotating HttpOnly refresh sessions are implemented.
- [x] Refresh/logout CSRF validation and origin checking are implemented.
- [x] Server-authoritative bottle-size pricing, inventory reservations and order totals are implemented.
- [x] Order idempotency, lifecycle history and payment/shipping webhook verification are implemented.
- [x] Admin product, inventory, order, user, offer, CMS, review and privacy operations exist.
- [x] Coupon eligibility supports guest/public offers, first purchase, milestones and selected customers.
- [x] Invoice and shipping-label generation paths exist.
- [x] Versioned consent, reject/accept/manage, GPC, withdrawal and optional campaign gating are implemented.
- [x] Cookie/privacy/security/deployment documentation exists.
- [x] Backend verification passes with 44 tests.
- [x] Optimized frontend production build succeeds.
- [x] Repeatable local load/stress harness and results exist.

## Next recommended execution order

1. Production-like MongoDB staging and migrations.
2. Razorpay staging qualification.
3. Shipping provider qualification.
4. SMTP/SMS provider qualification.
5. Performance remediation and production-like load testing.
6. Security/authorization/consent testing and remediation.
7. Tax, legal and privacy approval.
8. Complete cross-browser/mobile end-to-end acceptance.
9. Monitoring, backup, incident response and rollback rehearsal.
10. Formal production go/no-go approval.
