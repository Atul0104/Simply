# Consent management

The UI loads `/api/privacy/consent/config`, validates stored expiry and three policy versions, then displays equal **Reject optional**, **Manage choices**, and **Accept all** actions when no current choice exists. Necessary is fixed on. Choices are stored locally and appended server-side; authenticated records are associated with the customer, while anonymous identifiers and user agents are hashed.

Optional code must call `hasConsent(category)` before creating storage, sending measurement events, or loading third-party media/scripts. Current gates cover creator tracking/media and delayed payment checkout loading. Consent changes dispatch `perfurm:consent-changed`; withdrawal clears the audited optional-storage allowlist. GPC forces analytics, marketing and personalization off.

Admin reads use `/api/admin/privacy/consent/config`. Only a super administrator may publish changes; prior versions and an audit event are retained. Arbitrary JavaScript is never accepted. Publishing a new consent-policy version invalidates old browser choices.

Failure mode: if configuration cannot load, optional integrations remain off and no banner decision is fabricated. This is privacy-safe but should alert operations.
