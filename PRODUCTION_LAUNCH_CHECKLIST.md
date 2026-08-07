# Production launch checklist

- [ ] Real Atlas transaction abort/commit evidence recorded.
- [ ] Razorpay test-mode order, signed/delayed webhook and full/partial refund evidence recorded.
- [ ] Payment reconciliation runbook rehearsed by engineering and finance.
- [ ] Backup restore and product/variant/inventory counts reconciled.

## Critical approval

- [ ] Atlas replica set, indexes, transactions, backup and restore drill proven.
- [ ] Razorpay sandbox/live configuration, capture, failure, duplicate webhook and refund reconciliation proven.
- [ ] Shiprocket adapter, label, pickup, tracking, cancellation, NDR/RTO and reverse return proven.
- [ ] Brevo sending domain, OTP and order templates, retry/dead-letter alert proven.
- [ ] Cloudinary licensed-media migration and upload/delete controls proven.
- [ ] Cloudflare TLS/WAF/rate/cache policy and Turnstile risk flows proven.
- [ ] Legal approval for GST/invoice, privacy/cookies, retention, returns and customer communications.

## Quality and operations

- [ ] CI/build/tests/security scans green on the release commit.
- [ ] Production environment validator green and secrets stored outside Git.
- [ ] Load/spike/soak targets approved; replica/worker counts and rollback configured.
- [ ] Better Stack uptime/log alerts and on-call escalation tested.
- [ ] GA4/PostHog disabled until consent-aware implementation is verified.
- [ ] Cross-browser, physical-device and accessibility acceptance signed.
- [ ] Support, fulfilment, refund and incident owners trained.

Launch remains blocked while any critical box is unchecked.
