# Marvel Chat frontend release candidate — 12 October 2026

## Applied changes

- Fixed auth persistence initialization ordering; sign-in and sign-up wait for the persistence setup before calling Firebase Auth.
- Renders the authenticated application shell as soon as Firebase restores the user, then loads the Firestore profile, follow stats, route content and unread summary in the background.
- Moved following IDs/counters and unread notification summary off the blocking first authenticated render.
- Added a 60-second Home memory cache and cursor pagination in batches of 10 posts; only a small number of post media entries are hydrated per batch.
- Restricted Home search to the backend `home` scope (People + Posts).
- Moved post text after media and added state-backed Show more/Show less captions.
- Changed multi-item post media from a two-column thumbnail grid to a large single-item carousel with touch-swipe and previous/next controls plus position count.
- Added an in-app legal viewer that returns to the exact signup/current screen without a full document navigation.
- Added Feedback UI wired to `submitFeedback`; added Feedback and Sign out at the bottom of the More menu.
- Updated Chat list identity hydration through the currently deployed `getPublicProfiles` contract.
- Reduced the brand icon PNG dimensions to the manifest's intended 192/512 sizes, optimized them, and bumped the service-worker cache key.

## Not certified / remaining release blockers

This package is a targeted release candidate, not proof every reported feature is fixed. No live browser/device test was possible here. In particular: the supplied backend export omits the implementation source for the currently deployed `getMyMediaDailyUsage`; the global 2 MiB/day quota is not demonstrated as server-enforced by the included media source; R2 deletion/orphan reconciliation needs end-to-end testing; product image upload, complete profile-photo experience, comment pagination, sender profile-photo signing in every context, Moments edit/expiry UX, follow-only feed merging, full thread preference/delete-for-self controls, push delivery and live OAuth branding remain verification/work items.

The legal pages now contain 50 substantive sections each, but company contact details, age policy, retention periods, moderation/appeal process and jurisdiction must be confirmed by the company and reviewed by qualified counsel before public publication.


## v2 contract correction

- Feedback submits `category` (`bug`, `suggestion`, or `feedback`) to match the current backend's `submitFeedback` contract.
- Removed unused frontend callable aliases that are not exported by the current master backend; added catalog entries for existing `editMessage` and `updateMoment` callables.
- Added a Windows CMD helper to clone the existing GitHub repository, publish a review branch, and avoid force-push/automatic live-branch replacement.
- Updated docs to state explicitly that global daily media quota, profile-photo editing, R2 deletion/orphan cleanup, and full end-to-end behavior still require testing/implementation.
