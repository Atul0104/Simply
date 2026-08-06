# Perfurm production audit

Audit date: 6 August 2026  
Scope: backend, storefront, Customer, Admin and Super Admin flows, legacy fulfilment compatibility, tests, configuration and deployment.

## Executive assessment

Perfurm is a functional full-stack marketplace prototype, not yet a production-complete commerce platform. It has broad feature coverage, but several flows lack the durability and concurrency guarantees required for real money and stock. The safest strategy is incremental hardening on the current React, FastAPI and MongoDB stack.

Production launch status: **blocked** until the P0 items below are completed and staging acceptance tests pass.

## Current architecture

- React 19 SPA, React Router, Tailwind CSS, Radix UI, Axios, Framer Motion and Recharts.
- FastAPI with Pydantic, JWT bearer authentication and Motor/MongoDB.
- Razorpay initiation and backend signature verification.
- Customer and permission-aware Admin/Super Admin portals; legacy seller/delivery routes redirect away.
- Development-only preview database through `mongomock-motor`.
- Backend logic is primarily in one 150+ KB `server.py`; the storefront is also oversized.

## Existing feature inventory

### Customer

- Registration, password login, OTP scaffolding, forgot/reset password and logout.
- Profile, addresses, preferences, wishlist, recently viewed, cart and checkout screens.
- Catalogue, search suggestions, product details, reviews and serviceability display.
- Orders, tracking, return requests and support tickets.

### Admin-operated fulfilment

- Seller onboarding/approval, products, inventory, warehouses and store settings.
- Orders, shipping labels, delivery assignment, return policy, analytics and payouts.
- Delivery profile, assigned orders and delivery updates.

### Admin

- Seller approval, users, analytics, payouts, coupons and notifications.
- Homepage visibility, hero banners, ticker, offer cards, bank offers and footer content.
- Ticket management and platform settings.

### Safeguards already present

- Public registration cannot create admin or delivery roles.
- Passwords are hashed and a JWT secret is required.
- Client order prices, names, seller IDs and totals are ignored.
- Inventory decrements use an atomic quantity predicate with rollback of prior lines.
- Order/payment reads enforce ownership.
- Razorpay amount comes from the internal order.
- Demo OTP disclosure is opt-in.

## Gap and risk register

### P0 — production blockers

1. Payment webhook, refund and reconciliation logic is implemented and covered by provider fakes, but real Razorpay staging credentials and signed webhook end-to-end qualification are still required before accepting money.
2. Checkout, payment capture and release paths now use multi-document transactions with idempotency claims; the exact staging replica-set topology must still pass the qualification script and concurrent load test.
3. OTP/reset challenges are durable and hashed, but real email/SMS/WhatsApp provider delivery remains unconfigured.
4. Variant inventory is authoritative for newly modeled variants, but the real MongoDB multi-document transaction path still requires replica-set staging qualification.
5. Reversible migrations exist, but they must be rehearsed against a staging copy and multi-size inventory must be reconciled manually.
6. Granular admin permissions are enforced, but the remaining admin screens must be expanded for every delegated operational role.

### P1 — required before general availability

- Single-brand Admin catalogue authoring now covers perfume attributes, SEO, bottle-size prices, initial stock and later audited quantity adjustments; bulk import/export remains outstanding.
- Search needs a real search index, analytics and optional typo tolerance.
- Tax and COD policy still need jurisdiction-specific calculation and invoice qualification; prices and shipping are server-authoritative and snapshotted.
- Order transition validation, status history, customer cancellation and whole-order single-seller return/RMA workflows are implemented; item-level multi-seller RMAs and exchange fulfilment remain.
- Current/reserved/available inventory, movement ledger, return restocking and damaged-stock disposition are implemented; quarantine inspection and bulk import/export remain.
- Reviews enforce delivered verified purchases, one review per purchased order line, moderation visibility and history; customer review authoring UX and admin replies/statistics need further expansion.
- Customer data export, password rotation, durable deletion review and retention-gated transactional anonymization are implemented; jurisdiction-specific retention values still require legal approval and file-storage validation remains.
- Customer filtering, timed disable/block/reactivation, session revocation and audited promotional-credit grants are implemented. Credit redemption as a checkout tender remains a separate launch decision and is not currently deducted from orders.
- Notifications now use a durable preference-aware outbox with retries and dead-letter state; real SMTP/SMS credentials and staging delivery evidence remain outstanding.
- Product structured data, sitemap and canonical URLs are implemented; server rendering/prerendering remains incomplete.

### P2 — maintainability and scale

- Split backend into config, schemas, routes, services, repositories and integrations.
- Add a centralized frontend API client and query cache; a global error boundary is now installed.
- Role portals are code-split and core catalogue/admin lists are paginated; continue removing unbounded legacy list APIs.
- Resolve remaining hook warnings and expand the new Playwright/axe coverage beyond Chromium and core storefront/auth/admin paths.
- Expand current readiness/Prometheus operational metrics with centralized traces, exception reporting and business-event dashboards.

## Confirmed defects

- `/api/products/bestsellers` was shadowed by `/api/products/{product_id}`.
- Category filters downloaded all products and used random mock rating results.
- Authentication validation arrays could be rendered as React children and crash the page.
- Product imagery was cropped/oversized on several responsive screens.
- Public responses lacked correlation IDs and baseline security headers.
- Production configuration did not reject mock database/demo OTP modes.

## First hardening phase completed

- Production guards for mock database, demo OTP and weak JWT secrets.
- Request IDs, standard HTTP error envelope, security headers and database health probe.
- Perfume catalogue attributes, variants, lifecycle flags, ratings and SEO fields.
- Backend combined filtering, sorting and pagination with catalogue indexes.
- Cost-price sanitization across every public product and catalogue API.
- Stable `/api/catalog/bestsellers` route and storefront integration.
- Debounced, URL-persisted, backend-driven category filters without random data.
- Genuine perfume sizes/fragrance families plus loading, empty and retry states.
- Docker, Compose, Nginx caching and GitHub Actions CI.
- Catalogue, security-header and existing security tests.
- Customer-scoped order idempotency keys and checkout integration.
- Transactional order/inventory/fee/notification persistence on real MongoDB, with preview compensation and abandoned-reservation expiry.
- Transactional payment capture/failure/cancellation inventory transitions and a replica-set qualification probe.
- Expanded order lifecycle, validated transitions, status history and cancellation stock restoration.
- Signed, idempotent Razorpay webhook ingestion with payment-event and status histories.
- Retry-safe payment-order creation and idempotent payment verification.
- Short-lived access tokens plus rotated, hashed HttpOnly refresh sessions.
- Session listing/revocation, logout invalidation and password-reset session revocation.
- Database-backed HMAC-hashed OTP challenges with TTL expiry and no OTP logging.
- Persistent per-IP/per-identity authentication throttles and non-enumerating reset requests.
- Backend-enforced strong password policy.
- Authoritative variant pricing and separate current/reserved/available inventory at checkout.
- Variant reservation finalization, cancellation restoration and append-only inventory movement history.
- Reversible, transaction-backed catalogue migration with dry-run and conservative stock reconciliation flags.
- Idempotent full/partial Razorpay refund creation and webhook reconciliation.
- Responsive admin order/refund operations with server-side pagination and filtering.
- Database-managed pincode serviceability that fails closed, plus audited admin rule APIs.
- Granular delegated admin roles, permission-aware navigation and backend path authorization.
- Responsive super-admin staff provisioning and shipping-rule operations screens.
- Responsive seller perfume studio with taxonomy, scent notes, content, SEO, commercial fields and safe variant synchronization.
- Cross-seller product-manager console for audited activation and merchandising flags; sellers cannot self-feature products.
- Reversible RBAC migration with explicit super-admin designation.
- Dynamic sitemap/robots, canonical/Open Graph metadata, product structured data and a noindexed 404/private portal experience.
- Durable email/SMS notification outbox with preference filtering, idempotent jobs, stale-claim recovery, exponential retry, dead-letter operations and an admin status console.
- Worker-aware readiness plus authenticated Prometheus metrics for HTTP traffic, notification backlog and reserved orders.
- Server-authoritative coupon checkout with validated date/value rules, global and per-customer limits, transactional redemption counters, order discount snapshots, cancellation release and discounted seller-fee allocation.
- Reversible coupon-limit migration and checkout regression coverage; successful logins now clear failed-attempt counters without weakening repeated-failure throttling.
- Return/cancellation requests now enforce ownership, policy windows, delivered/cancellable order states, one active request per order, strict administrative transitions and granular order-manager permission.
- Return merchandise and refundable-value snapshots are immutable; received goods require an explicit restock/damaged disposition, update inventory once, append movement/audit history, and synchronize the customer-visible order timeline.
- Lazy-loaded role portals, a global recovery boundary, keyboard skip navigation and reduced-motion support.
- Playwright plus axe quality gates for desktop, tablet and mobile Chromium covering runtime errors, horizontal overflow, serious accessibility violations, authentication and an admin permission workflow.
- Initial JavaScript reduced from approximately 417 KB to 110 KB gzip; large role features are emitted as on-demand chunks.
- Verified-purchase reviews now require a delivered matching order line, reject duplicates, remain private pending moderation, maintain moderation history and refresh public rating aggregates.
- Responsive review moderation is permission-gated for delegated staff, and helpful votes are authenticated and idempotent.
- Carrier label creation can be delegated to an environment-configured provider; signed idempotent status webhooks update shipment/order timelines, and tracking reads enforce order ownership.
- Customer account controls now provide authenticated password rotation with refresh-session revocation, a sensitive-field-filtered portable JSON export, and password-confirmed deletion requests blocked by active orders.
- Targeted coupons now support first purchase, delivered-order milestones and explicit customers; public coupon responses exclude private assignments and authenticated customers receive only eligible codes.
- Environment-configured reverse geocoding, secret-free Admin integration readiness, stricter release validation and current-location address confirmation are implemented.
- Latest local verification: 41 backend tests pass, the optimized frontend builds, and the desktop/tablet/mobile Chromium quality matrix passes after targeted mobile carousel revalidation. External-provider certification remains gated on real staging credentials.
- Privacy operations now have a paginated permission-gated admin queue, delegated review, Super-Admin-only fulfilment, checkout blocking after approval, configurable retention windows and transactional anonymization with audit history.

## Required implementation sequence

1. Qualify payment capture, webhook reconciliation and refunds against Razorpay staging credentials.
2. Order idempotency, state machine, MongoDB transactions and reservation expiry.
3. Variant inventory ledger and checkout migration.
4. Configure notification providers and durable delivery jobs.
5. Granular RBAC and append-only audit log.
6. Complete catalogue/admin taxonomy authoring.
7. Taxes, shipping, invoices, returns and refund calculations.
8. SEO/prerendering, performance, observability and full staging E2E qualification.

## Data migration requirement

New fields are backward compatible through defaults. Before production, a versioned migration must generate unique slugs, map legacy sizes to variants, backfill perfume attributes, create variant inventory and verify SKU/slug uniqueness. No destructive migration was run during this audit.

## Launch decision gate

Do not enable real payments until all P0 items pass staging integration tests using gateway test credentials and signed webhook fixtures. Never use preview accounts or seed data outside development.

## Current verification limitation

Docker is not installed in the present workstation environment, so the replica-set Compose topology and `backend/scripts/qualify_transactions.py` could not be executed here. Unit and integration behavior is proven with the Mongo-compatible preview database, but production transaction readiness remains gated on running the qualification script and concurrent checkout tests against the exact staging topology.

The automated responsive/accessibility matrix currently uses Chromium device emulation. Physical iOS/Android testing plus Firefox and WebKit coverage remain launch checks. The legacy Create React App build chain also reports npm advisories (no critical findings, but high findings exist in build-time transitive packages); migrate or upgrade the build toolchain instead of applying a forced dependency rewrite without regression testing.

The carrier adapter uses a documented provider-neutral JSON contract. A selected carrier must be qualified against that contract in staging; provider-specific authentication, pickup scheduling, cancellation and reverse-shipment schemas may require an adapter before launch.
