# Marvel Chat Production Frontend — 15 October 2026 integration release

This release starts from the uploaded `marvel-chat-production` frontend as the source of truth. It does not replace the production UI with Marvel Chat V3.2 and does not switch media storage from private Cloudflare R2 to Cloudinary.

## Additions

- People-and-posts-only global search scope, matching Home discovery.
- Official Davonium Technologies links in the app menu, Settings and legal-page footers.
- PWA install prompt when supported, with browser-menu guidance as a fallback.
- Offline status banner and user-triggered service-worker update check.
- Bumped static-shell cache version; only the app's own old cache namespace is deleted.
- Push-notification click targets are restricted to this origin. Existing Firebase Messaging/device registration remains unchanged.
- Source audit documenting which V3.2 ideas were adopted and which were deliberately not copied.

## Validation

Run `bash scripts/validate.sh` in a bash-capable environment with Node.js installed. Passing static checks does not substitute for live Firebase Auth, FCM, Cloudflare deployment and mobile-device tests.
