# Security

Report vulnerabilities privately to care@perfurm.com with “Security” in the subject; do not include credentials or customer data. Production requires HTTPS, authenticated MongoDB with backups, unique secret-manager values, restricted CORS, Secure cookies, webhook signature verification, least-privilege admin permissions, provider sandbox qualification and monitored audit logs.

Authentication uses short-lived bearer access tokens held in memory and rotating HttpOnly refresh cookies. Refresh/logout use double-submit CSRF validation and origin checking. Public registration creates customers only; super-admin creation is controlled by deployment bootstrap. Rate limits protect login and sensitive flows.

Never commit `.env`, payment secrets, SMTP credentials, tokens, database exports or logs containing PII. Rotate a suspected secret immediately, revoke sessions, preserve evidence and follow incident response. Dependency/static/dynamic scans and authorization tests are release gates.

Current accepted blockers are recorded in `PRODUCTION_AUDIT.md`; “build passes” is not a security approval.
