# Production checklist

- [ ] Legal approves Privacy/Cookie policies, lawful bases, retention and vendors.
- [ ] Release environment validator passes with live commerce providers.
- [ ] MongoDB authentication, TLS, replica set, backup and restore drill pass.
- [ ] HTTPS, HSTS, CORS, cookie flags, CSRF and webhook signatures pass staging tests.
- [ ] Consent matrix/GPC/withdrawal/version/expiry and no-preconsent-request tests pass.
- [ ] Customer/Admin/Super Admin authorization and cross-tenant negative tests pass.
- [ ] Catalogue → size price/inventory → cart → address → coupon → payment/COD → order → invoice/label → shipping/refund passes on mobile and desktop.
- [ ] Accessibility, supported browsers, performance budgets and error states pass.
- [ ] Monitoring, alerts, on-call, incident response and rollback are rehearsed.
- [ ] SAST/dependency/secret/DAST scans have no unresolved critical/high issues.
- [ ] Remote assets are licensed and migrated to a controlled CDN.
- [ ] Product owner, engineering, security, privacy/legal and operations sign off.

Current decision: **not approved for production** until the open blockers in `PRODUCTION_AUDIT.md` are closed; staging qualification is appropriate.
