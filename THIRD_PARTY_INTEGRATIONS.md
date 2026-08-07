# Third-party integrations

Set `DATABASE_ENVIRONMENT` equal to `APP_ENV`; a stored database identity prevents staging and production sharing a database. Set `ONLINE_PAYMENTS_ENABLED=true` only with all three Razorpay variables. Only the key ID reaches checkout; secrets and raw provider errors remain backend-only.

| Provider | Purpose | Cost | Current state | Required configuration |
|---|---|---:|---|---|
| MongoDB Atlas | transactional data | Free with limits | adapter implemented; staging proof required | `MONGO_URL`, `DB_NAME` |
| Razorpay | payments/refunds | Pay per use | implemented with signed webhook/idempotency | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| Shiprocket | fulfilment | Pay per use | generic shipping contract only | `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD` or `SHIPROCKET_API_TOKEN`; webhook secret |
| Brevo | transactional email | Free with limits | SMTP outbox can use Brevo; API adapter not selected | `BREVO_API_KEY` or SMTP values, sender identity |
| Cloudinary | controlled media | Free with limits | configuration placeholder; upload adapter pending | cloud name, API key and secret |
| Cloudflare | DNS/CDN/TLS/WAF | Free | deployment configuration required | account-side DNS, TLS, WAF and cache rules |
| Turnstile | abuse protection | Free | keys/placeholders; endpoint integration pending | site key and secret key |
| GA4 | consented ecommerce analytics | Free | planned | `GA_MEASUREMENT_ID` |
| Better Stack | uptime/log drain | Free with limits | planned; Prometheus/readiness exist | `BETTERSTACK_SOURCE_TOKEN` |
| PostHog | optional product analytics | Free with limits / paid later | disabled | key and host |
| MSG91 | future SMS OTP | Pay per use | future adapter | `MSG91_AUTH_KEY` |

## Provider behavior

Razorpay and shipping webhooks are HMAC verified and deduplicated. Provider failures leave orders in recoverable states and are visible to operations. Notification delivery uses bounded retry/dead-letter states and never blocks checkout. HTTP integrations require explicit timeouts. Credentials must be different in staging and production, rotated through the secret manager, and never returned by readiness APIs.

Before launch, configure provider dashboards, exact webhook URLs under `PUBLIC_API_URL`, signature secrets, test fixtures, alerting, outage drills and reconciliation ownership. No unconfigured provider should be described as connected.
