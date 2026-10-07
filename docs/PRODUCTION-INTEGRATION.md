# Marvel Chat Production Frontend Integration

This package is the repaired frontend built against the current uploaded Marvel Chat backend contract.

## Confirmed in the source repair

- Firebase project: `project-ec531e09-e3fd-4408-a35`
- Functions region: `europe-west1`
- Production domain: `marvelchat.davoniumtech.com`
- App Check uses the existing production reCAPTCHA Enterprise web site key.
- Callable catalog matches the current backend inventory; the Firestore-triggered `dispatchNotificationPush` is intentionally not treated as a callable.
- Chat sends through `createChatThread`, `sendMessage`, `markThreadRead`, and `deleteMessage`.
- Skills provider setup/listings use the real Skills callables.
- Market store/product/inventory/availability/commerce requests use the real Market callables.
- Media uploads use the real R2 ticket/finalize/read-URL flow.
- Home reads are bounded and request public/active documents only.
- Service worker cache version was advanced and dynamic authenticated data is not cached.

## Backend follow-up before final public launch

The Home public/active feed queries use two equality filters plus `createdAt` ordering. The current backend `firestore.indexes.json` supplied with the project is empty, so the required composite indexes must be validated/deployed from the backend project before relying on those queries in production.

The local `firestore.rules` follow-rule placement was corrected during the backend repair, but rules were intentionally not blindly redeployed during the frontend build. Validate the local rules against the live rules before deploying them.

The browser push VAPID key remains blank, so push registration is not advertised as enabled by this frontend.

Cloudflare Worker/Wrangler source was not included in the supplied frontend/backend ZIPs, so edge-worker behavior still requires live Cloudflare-side verification.
