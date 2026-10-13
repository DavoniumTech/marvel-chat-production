# Marvel Chat frontend release candidate — 13 October 2026

## Included
- Optimized logo/app icons at intended dimensions, preserving paths.
- Lightweight code-inspired welcome motif and reduced-motion styling.
- Home first page 5, next pages 3, spinner/manual fallback, brief in-memory cache and lazy signed media URLs.
- One-large-item carousel for multi-media posts and expandable captions.
- Like/save feedback, Home saved-post library, paged comment callable contract.
- Feedback and More menu additions, Sign out at bottom, in-app legal back/close behavior.
- Profile photo, Skills listing and Market product image forms use private media APIs.
- Seller 8-step and provider 5-step onboarding; text-only chat with bottom composer and message/thread actions.
- Terms, Privacy and Community Guidelines drafts each contain 50 numbered sections and contact placeholders.

## Validation
`bash scripts/validate.sh` passed; all `js/*.js` passed Node syntax checks; all frontend callable names match the paired backend source exports.

## Not yet verified in production
No end-to-end test has run against Firebase, R2, App Check, FCM or the production browser. Current Home query pages public posts only; follower-only posts are not merged. Moment viewer remains modal (no full-screen timed player). Comment likes/ranking are not implemented. Contact placeholders and legal review remain. Test quota races, R2 reference-aware delete, Skills/Market/Profile media, chat per-user deletions and required indexes before public launch.
