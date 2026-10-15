# Marvel Chat production integration audit — 15 October 2026

## Source-of-truth decisions

- `marvel-chat-production` remains the frontend source of truth. Existing route names, Firebase project settings, App Check initialization, callable API adapter, current CSS design system, R2 media uploader, and FCM registration remain in place.
- The Davonium Technologies website is used only for verified company navigation and contact links: https://www.davoniumtech.com/, https://www.davoniumtech.com/contact, support@davoniumtech.com, and +234 707 260 4426.
- Marvel Chat V3.2 was inspected for implementation ideas only. Its modular PWA installation/update pattern was adapted conceptually; its Home UI, Firestore-direct writes and Cloudinary upload pipeline were not copied into production.
- The uploaded deployed-backend inventory shows that active Functions reference several deployed source bundles. Do not deploy the entire historical bundle inventory as one Firebase project. Keep deployments function-scoped and review the source bundle mapped to each selected function.

## Integrations in this release

- Search screen is constrained to people and public posts, matching the existing Home search contract and avoiding unrelated Skills/Market search there.
- External company website and contact links are available in the global menu, Settings, and legal-page footers.
- PWA install support uses `beforeinstallprompt` when supported and provides browser-menu guidance elsewhere.
- Offline notice reports connection status without pretending cached pages provide live chat, uploads, notifications or server data.
- Service-worker cache version was bumped; activation deletes only old caches prefixed `marvel-chat-shell-`, not unrelated caches on the same origin.
- Update checking is user-triggered from Settings; if the service worker controller changes after an earlier controller existed, the app presents a refresh prompt.
- Notification click URLs are constrained to this origin. Existing production FCM token registration and backend device APIs are preserved.
- Firebase source-map requests ending in `.js.map` were not added to CSP connect-src merely to suppress DevTools warnings. They are not runtime dependencies. The existing restrictive CSP and `Cross-Origin-Opener-Policy: same-origin-allow-popups` remain.

## No backend deployment required for these changes

The changes in this integration are frontend navigation/PWA/status and corporate-link improvements. Existing backend callable names and FCM registration endpoints are unchanged. The uploaded deployed backend snapshot is provided as the current source inventory for reference; because it contains multiple source bundles used by different deployed Functions, it must not be blindly deployed as a single root. Verify current Function health separately and deploy server code only when an actual backend implementation change is needed.

## Verification

- JavaScript syntax checked with `node --check`.
- `manifest.json` parsed as JSON.
- Contract assertions cover Firebase callable catalogue, App Check, people/posts search scope, quota API and safe service-worker cache behavior.
- Live login, service-worker install/update behavior, FCM delivery, and production hosting still require testing in the deployed environment.
