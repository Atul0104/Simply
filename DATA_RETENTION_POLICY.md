# Data retention policy

| Record | Default | Disposal/control |
|---|---:|---|
| Refresh sessions | 30 days or revocation | TTL/cleanup after expiry |
| Consent history | 7 years recommended evidence window | Scheduled deletion after approved legal period |
| Current anonymous consent | Consent expiry + 30 days | Delete expired anonymous records |
| Orders/invoices/tax evidence | 2555 days default | Anonymize/delete when legal hold ends |
| Payment reservations | 20 minutes | Worker releases stock; retain order audit as required |
| Notification jobs | 90 days after terminal state | Aggregate metrics, delete payload |
| Rate-limit records/OTP | Minutes to hours | TTL index/cleanup |
| Campaign events | 13 months | Aggregate then delete identifiers |
| Account deletion request | 30-day grace | Anonymize eligible profile data; preserve legally required records |

Legal hold overrides automated deletion and must be documented, approved and audited. Owners must test deletion jobs in staging quarterly.
