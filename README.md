# Marvel Chat — Modern Frontend Production Candidate

Davonium Technologies

This package is a modernized frontend candidate built against the current Marvel Chat frontend direction and the live backend project.

It preserves the vanilla JavaScript stack and the existing backend boundaries while upgrading the product presentation toward a polished, responsive social/platform experience inspired by the supplied Marvel Chat reference boards.

## Live Firebase alignment

- Firebase project: `project-ec531e09-e3fd-4408-a35`
- Web App ID: `1:960686800050:web:f3c7abb87660d9d2e0ddab`
- Functions region: `europe-west1`
- Cloud Functions v2 callable API adapter
- Firestore reads/listeners where permitted
- Cloudflare R2 signed media upload/read flow

## Primary product areas

Home, Chat, Marvel Skills, Marvel Market, Profile.

Search, Notifications, Settings, legal pages, and onboarding remain secondary utilities.

## UI direction

The interface uses:

- strong desktop application chrome
- mobile bottom navigation
- polished card hierarchy
- modern light and dark themes
- premium violet/blue product accent language
- responsive social feed composition
- secure photo-post workflow with upload preview
- readable chat presentation
- accessible buttons, labels, and focus-friendly interactions

The supplied reference images were used as visual direction, not copied as application assets.

## Security note

Do not disable Firebase App Check to make testing convenient. The production reCAPTCHA Enterprise/App Check web site key is configured in `js/config.js`.

Never put Firebase Admin credentials, service-account files, Cloudflare R2 private credentials, or other private secrets in this frontend.

## Windows

See `OPEN-IN-VSCODE.cmd` and `docs/LAUNCH-CHECKLIST.md`.


Production media: browser-side image/video optimization runs before the real R2 signed upload, while the backend remains authoritative for the 2 MiB per-user daily quota.
