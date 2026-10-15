# Release notes — Marvel Chat production integration (15 Oct 2026)

- Maintained the production UI and Firebase/R2 stack; V3.2 was studied as a reference, not copied as a replacement.
- Restricted global search to people and public posts / people-only scope.
- Added verified Davonium Technologies website/contact links: https://www.davoniumtech.com/, https://www.davoniumtech.com/contact, support@davoniumtech.com, +234 707 260 4426.
- Added PWA install prompt with fallback guidance for browsers that do not expose `beforeinstallprompt`.
- Added online/offline notice and user-triggered update check.
- Added legal pages to offline static shell cache and fixed offline legal-page fallback to check the requested page before falling back to app shell.
- Service worker now deletes only older `marvel-chat-shell-*` caches and constrains notification click targets to the application origin.
- Existing FCM device registration/unregistration remains unchanged; the backend source snapshot is reference only for this frontend-only integration.
- Static validation passes; live Firebase/FCM, Cloudflare publish and mobile-device tests remain required.
