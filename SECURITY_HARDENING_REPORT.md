# Security hardening report

## Implemented

- Argon/bcrypt-compatible password hashing, strong-password validation, hashed single-use OTP challenges, expiry, attempts and persistent throttling.
- Short-lived access JWTs in memory and rotating hashed refresh sessions in HttpOnly cookies.
- CSRF token/origin checks for cookie-authenticated refresh and logout.
- Backend RBAC/permission enforcement and ownership checks for orders, addresses, returns, reviews, tickets, invoices and payment operations.
- Explicit CORS, request IDs, CSP/security headers, safe error envelopes, HTTPS/Secure-cookie production guards and no demo/mock production mode.
- HMAC verification and idempotency for payment and shipping webhooks.
- Server-authoritative price, tax, coupon, shipping and inventory calculations.
- Audit records for sensitive product, inventory, customer, privacy, refund and order actions.
- CodeQL and Dependabot configuration; CI runs backend tests, frontend build, npm critical audit and Playwright/axe.

## Open security gates

- Run CodeQL, dependency review and OWASP ZAP against the final staging origin.
- Configure Cloudflare managed WAF/rate rules and verify trusted proxy/client-IP behavior.
- Add Turnstile to risk-sensitive endpoints after real keys are available.
- Complete external penetration testing and secret-manager review.
- Review remote media, CSP domains and upload validation when Cloudinary is enabled.

Never treat a successful build as security approval. Report vulnerabilities privately using `SECURITY.md`.
