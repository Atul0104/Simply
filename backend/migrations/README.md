# Database migrations

Migrations default to dry-run mode and require a real MongoDB deployment. Take a verified backup before applying any migration.

For migration `001_perfume_catalog.py`:

```text
python migrations/001_perfume_catalog.py
python migrations/001_perfume_catalog.py --apply
python migrations/001_perfume_catalog.py --rollback
python migrations/001_perfume_catalog.py --rollback --apply
```

Multi-size legacy products are deliberately created with zero variant stock and `requires_inventory_review=true`; inventory must be allocated by an authorized operator before publication. This prevents migration-time overselling or accidental multiplication of stock.

Migration `002_admin_rbac.py` requires `BOOTSTRAP_SUPER_ADMIN_EMAIL` to match an existing administrator. It never guesses which account should receive unrestricted permissions.

Migration `003_coupon_redemptions.py` backfills a conservative one-use-per-customer default for legacy coupons and creates the redemption-counter indexes used by transactional checkout. Its rollback restores coupon documents while deliberately retaining redemption history for audit safety.

Migration `004_return_workflow.py` detects conflicting active requests before writes, backfills one active key per order, and creates customer, seller, and workflow indexes. Resolve every reported conflict before applying it.

Migration `007_tax_invoices.py` refuses duplicate invoice records, marks orders without an authoritative tax snapshot as invoice-ineligible, and adds immutable invoice-number and one-invoice-per-order/seller indexes. It deliberately never fabricates historical GST values.
