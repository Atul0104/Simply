# Cookie and consent security testing

Required staging checks:

1. Fresh profile: confirm only necessary consent/cart storage and no creator event, campaign video, Razorpay, analytics or marketing request before a choice.
2. Reject optional: reload and verify the choice persists, optional requests remain absent, and the site/cart/checkout still work.
3. Grant one category at a time; confirm only matching behavior begins. Withdraw and confirm known optional storage/cookies are removed and collection stops without reload.
4. Change a policy version and confirm the banner returns. Advance expiry and confirm the same.
5. Enable browser GPC and verify analytics/marketing/personalization cannot be saved on.
6. Inspect `perfurm_refresh`: HttpOnly, Secure in staging/production, configured SameSite/domain/path; inspect CSRF cookie and reject refresh/logout without the matching header or from an unapproved origin.
7. Attempt `necessary=false`, stale versions, malformed anonymous IDs, non-super-admin publication and arbitrary script fields; expect rejection.
8. Test keyboard navigation, focus, zoom, screen-reader labels and mobile viewport for banner/dialog.

Record browser/network evidence in the release ticket. Never test with live customer data.
