# Payment reconciliation runbook

Use this when Razorpay and Perfurm disagree, especially when a payment is captured after an inventory reservation expires or inventory finalization fails.

## Detect and triage

- Open `GET /api/admin/payments/reconciliation` as Super Admin.
- Correlate the internal order ID, provider order ID, payment ID and event ID.
- Verify the payment in Razorpay; never request or store card data.
- Check reservation status and current variant availability.
- Never charge again or blindly confirm an order whose inventory is not guaranteed.

## Resolve

If inventory can be guaranteed, use the normal audited inventory/order controls. Otherwise initiate one idempotent refund and notify the customer. For unmatched webhooks, establish a safe provider-to-order match or escalate. Record actor, reason, provider references and timestamps.

## Close

Verify provider and internal amounts match, inventory is non-negative, reservation was committed or released once, refunds do not exceed captured payment, and the customer has one final outcome. Escalate repeated mismatches, signature failures or unavailable MongoDB transactions. Never include secrets, JWTs, OTPs, passwords or card data in logs/tickets.
