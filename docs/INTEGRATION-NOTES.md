# Engineering Integration Notes

## Product-facing rules

- The public product name is `Marvel Chat`.
- Internal build or version identifiers must not appear in customer-facing UI or public documentation.
- Customer-facing errors should be translated into plain-language messages.
- No unsupported capability should be represented as active.

## Current frontend integration points

- Firebase Authentication: email/password and Google provider.
- Cloud Functions: callable adapter for the known backend export inventory.
- Firestore reads: bounded queries for Home, Chat, Skills, Market, and Notifications.
- App Check: initialized during browser startup with the existing production reCAPTCHA Enterprise public web site key using ReCaptchaEnterpriseProvider.
- Chat: participant-scoped thread query with `participantUids` and compatibility fallback to `participantIds`.
- Moments: own active Moment first, followed active Moments next, without unrelated Moment cards.
- Market: discovery through the `discoverMarketProducts` callable; categories are a frontend browsing layer until exact category query contracts are enabled.
- Notifications: root notification query plus summary fallback; browser push requires deployment-time web-push configuration.

## Remaining production certification

- Authorize the production domain and local development domain in Firebase Authentication.
- Verify production App Check at the live domain; the existing production reCAPTCHA Enterprise site key is already configured in js/config.js.
- Verify exact seller/shop write payloads against the deployed backend.
- Verify exact provider/Skills write payloads against the deployed backend.
- Verify the secure R2 browser upload contract before enabling photo publishing.
- Complete browser end-to-end tests.
- Resolve any remaining backend deployment quota or function health issues before public launch.
