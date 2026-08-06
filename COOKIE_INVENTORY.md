# Cookie and browser-storage inventory

Reviewed: 2026-08-06. Re-audit after every SDK, payment, campaign-media, authentication, or policy change.

| Name / request | Type | Category | Purpose | Lifetime | Set by | Before consent |
|---|---|---|---|---|---|---|
| `perfurm_refresh` | HttpOnly cookie | Necessary | Rotating authenticated session | 30 days | API | Yes, after sign-in |
| `perfurm_csrf` | readable cookie | Necessary | Double-submit CSRF token | 30 days | API | Yes, after sign-in |
| `perfurm_consent_v1` | localStorage | Necessary | Current consent choice/version/expiry | 180 days maximum | UI | Yes |
| `perfurm_consent_subject` | localStorage | Necessary | Random consent-record correlation identifier | Until browser deletion | UI | Yes |
| `cart` | localStorage | Necessary | Requested shopping-cart continuity | Until cleared/order | UI | Yes |
| `wishlist` | localStorage | Functional | Saved fragrances | Until cleared | UI | Only after functional consent (migration pending; see audit) |
| `recentlyViewed` | localStorage | Personalization | Recent product recommendations | Until cleared | UI | No; cleared on withdrawal |
| `perfurm_offer_popup_*` | sessionStorage | Functional | Avoids repeating a dismissed offer | Tab session | UI | No |
| `perfurm_visitor_id` | localStorage | Analytics | Campaign view/click/like correlation | Until withdrawal | UI | No |
| Razorpay checkout script | network/script | Necessary at checkout | User-requested online payment | Checkout session | Razorpay | Only after payment action |
| Remote campaign video | network/media | Marketing | Creator advertising media | Page session | Campaign host | No |
| Unsplash/remote catalogue images | network/image | Necessary content | Product/editorial imagery | Provider cache policy | Content host | Yes; migrate to first-party CDN before launch |

Known optional vendor cookies (`_ga`, `_gid`, `_gat`, `_fbp`) are removed on withdrawal if a future approved integration creates them. No analytics/tag-manager SDK is currently configured.
