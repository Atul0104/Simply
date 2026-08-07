# Incident response runbook

## Severity

- SEV-1: customer money, data exposure, widespread checkout failure or inventory corruption.
- SEV-2: material provider degradation, admin outage or elevated order errors.
- SEV-3: limited defect with workaround.

## Response

1. Appoint incident commander, operations lead and communications owner.
2. Preserve request IDs, audit logs, provider event IDs and deployment metadata without copying secrets/PII into chat.
3. Contain: disable online payment, affected provider operation or deployment; never delete evidence.
4. Diagnose using `/ready`, protected `/metrics`, structured logs, Atlas, Razorpay and shipping dashboards.
5. Recover with rollback, queued retry, reservation release or verified restore. Financial actions require idempotency and reconciliation.
6. Validate customer-visible state and inventory before reopening traffic.
7. Notify affected users/regulators according to approved legal policy.
8. Complete a blameless review with timeline, root cause, impact and owned corrective actions.

Suspected secret exposure requires immediate rotation, session revocation and audit. Payment mismatch requires pausing affected fulfilment until reconciliation completes.
