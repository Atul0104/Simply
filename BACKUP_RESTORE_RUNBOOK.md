# Backup and restore runbook

> Phase 1 status: `CONFIGURATION_REQUIRED`. No Atlas credentials or eligible backup target were available, so no restore success is claimed. Before production, run this drill on staging and record snapshot time, restore target, collection counts and approver. Confirm the Atlas tier supports the required cloud backup/point-in-time restore capability.

## Backup

Use MongoDB Atlas continuous backup or scheduled snapshots for production. Before migrations/releases create an on-demand snapshot and record cluster, timestamp, encryption and retention. Exported backups must be encrypted, access-controlled and excluded from Git.

## Restore drill

1. Declare an incident and freeze writes if consistency is at risk.
2. Select the last verified recovery point; restore into an isolated cluster first.
3. Validate migration version, collection/index counts, users, products, variant inventory, orders, payment events, refunds and audit logs.
4. Reconcile Razorpay and Shiprocket records from the recovery point forward.
5. Point staging at the restored database and run smoke/concurrency tests.
6. Production cutover requires incident commander and business approval. Rotate credentials if compromise is possible.

## Targets

Initial proposed RPO: 24 hours; RTO: 8 hours. These are not guarantees until a timed restore drill proves them. Run quarterly drills and retain evidence. Application migrations support dry-run/pre/post validation; rollback is by documented migration reversal or snapshot restore, never ad-hoc destructive edits.
