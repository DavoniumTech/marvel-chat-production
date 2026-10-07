# Marvel Chat — Production Frontend Candidate

Davonium Technologies

This package is the current Marvel Chat frontend candidate. It preserves the vanilla JavaScript application and current Firebase/Cloud Functions/R2 architecture while upgrading the presentation for a polished social-platform experience.

## Product structure

Primary destinations:

- Home
- Chat
- Marvel Skills
- Marvel Market
- Profile

Secondary utilities include Search, Notifications, Settings, legal pages, and seller/provider onboarding.

## Home experience

Home intentionally follows a familiar social-feed hierarchy:

1. Marvel Chat brand/header.
2. Polygon Moments/Stories row with an Add button.
3. Compact post composer.
4. Community feed.
5. Floating plus action for post creation.

The brand icon and ordinary user avatars are square. Polygon styling is reserved for Moments/Stories.

## Media

The verified backend permits up to 10 media IDs on one Home post and limits each media item to 2 MiB. This frontend accepts photos and supported video formats, compresses images before upload, and attempts native browser video re-encoding before the signed R2 upload.

The backend currently does not define a trustworthy 2 MiB-per-day quota. The frontend therefore does not invent a client-only daily quota.

## Backend alignment

The frontend uses the current backend names and contracts, including:

- `createPost`
- `createMoment`
- `createMediaUpload`
- `finalizeMediaUpload`
- `createMediaReadUrls`
- `createChatThread`
- `sendMessage`
- `markThreadRead`
- `registerDevice`
- `unregisterDevice`
- `ensureUserProfile`
- `updateProfile`
- `updateUserSettings`
- Skills and Market functions already exposed by the current API adapter.

Chat uses the current `participantIds` contract for direct threads.

## Browser configuration

`js/config.js` contains the public App Check site key and public FCM Web Push VAPID key supplied for the current Firebase project.

No server secret belongs in this package.

## Domain

Production hostname:

`https://marvelchat.davoniumtech.com/`

A `CNAME` file is included for GitHub Pages.

## Important production boundary

This is a **production candidate**, not a claim of certification. Real-browser certification still covers the custom domain, HTTPS, Firebase Authentication authorized domain, App Check behavior, R2 CORS, browser push, and live end-to-end feature testing.

See `docs/PRODUCTION-SETUP-20261007.md` for the exact release runbook.
