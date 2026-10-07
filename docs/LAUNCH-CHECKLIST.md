# Marvel Chat — Launch Candidate Checklist

This package is a frontend production candidate aligned to the live Firebase project:

- Project: project-ec531e09-e3fd-4408-a35
- Firebase Web App: 1:960686800050:web:f3c7abb87660d9d2e0ddab
- Functions region: europe-west1
- Media: Cloudflare R2 signed upload/read flow
- Primary areas: Home, Chat, Marvel Skills, Marvel Market, Profile

## Important before public launch

1. Confirm `appCheckSiteKey` in `js/config.js` remains the registered production web key for `marvelchat.davoniumtech.com`.
2. Keep `vapidKey` blank until browser push is certified, or set the correct public Web Push key.
3. Confirm the production custom domain is an authorized Firebase Authentication domain.
4. Confirm the R2 CORS policy allows the production frontend origin.
5. Run the browser smoke test: login, Home feed, photo post, Chat search/open/send, Skills, Market, Profile, theme switch.

## Photo posting

Home photo posts use:

`createMediaUpload -> direct signed PUT to R2 -> finalizeMediaUpload -> createPost(mediaIds)`

The backend remains authoritative for ownership, size, MIME type, readiness, and media attachment.
