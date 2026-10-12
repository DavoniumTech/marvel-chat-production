# Marvel Chat — Frontend Release Candidate

Davonium Technologies · 12 October 2026

This package retains the vanilla HTML/CSS/JavaScript frontend and current Firebase project wiring. It includes responsive UI updates, a smaller initial Home batch, media carousel/caption behavior, notification badge refresh, legal-page navigation, and the Feedback menu route.

## Environment

- Firebase project: `project-ec531e09-e3fd-4408-a35`
- Functions region: `europe-west1`
- App: `marvelchat.davoniumtech.com`
- Media: private Cloudflare R2 signed upload/read flow

## Important limits

- A frontend static validation pass does not prove authentication, App Check, callable operations, R2 upload/deletion, or push notifications work end to end.
- The global 2 MiB-per-user-per-day quota and full R2 orphan cleanup are **not certified by this package**; keep the bucket private and verify server-side enforcement before public launch.
- Profile-photo editing and the unused user-profile callable aliases are not claimed to be implemented end-to-end in this frontend release.
- Do not put Firebase Admin credentials, Cloudflare secrets, service-account keys, or private tokens in this frontend.

## Windows

Use `DEPLOYMENT.md` and `PUBLISH-MARVEL-CHAT-FRONTEND.cmd` for Windows CMD instructions.
