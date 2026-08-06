# Third-party vendor register

| Vendor | Role/purpose | Data | Trigger | Production requirement |
|---|---|---|---|---|
| MongoDB host | Processor/database | Accounts, orders, consent evidence | API use | DPA, region review, encryption, backups |
| Razorpay | Payment processor | Order/payment reference and payer details | Explicit online-payment action | Live agreement, webhook secret, PCI scope confirmation |
| Shipping adapter | Fulfilment processor | Recipient/address/order parcel data | Shipment creation | DPA, webhook authentication, retention terms |
| SMTP/SMS adapter | Communications processor | Email/mobile and notification content | Configured transactional delivery | DPA, verified sender, unsubscribe rules for marketing |
| Remote media hosts | Content/marketing provider | IP, user agent, request metadata | Image content; campaign video only after marketing consent | License evidence and first-party CDN migration |
| BigDataCloud-compatible endpoint | Reverse geocoding | Coordinates | Explicit “use current location” action | Privacy/transfer review and visible user disclosure |

No tag manager, behavioral analytics, session replay or advertising pixel is enabled. Adding one requires privacy/security review, inventory update, admin-approved vendor allowlist and consent-gated loading.
