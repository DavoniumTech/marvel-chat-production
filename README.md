# Marvel Chat Frontend Release Candidate — 2026-10-13

Existing vanilla HTML/CSS/JS frontend; not a rebuild. Firebase project `project-ec531e09-e3fd-4408-a35`, Functions region `europe-west1`, domain `marvelchat.davoniumtech.com`.

Included: faster auth shell, Home first page 5 + cursor pages of 3 with spinner and short cache, lazy media read URLs, larger media carousel, expandable captions, like/save state, saved-post shelf, paged comments contract, More/Feedback/Sign out entries, legal return controls, profile photo and Skills/Market photo flows through private media APIs, multi-step onboarding, text-only chat composer and supported message/thread controls, and 50-section legal drafts with contact placeholders.

Static checks passed: `bash scripts/validate.sh`, Node syntax checks for all `js/*.js`, and frontend callable names matched backend source exports. These are not production end-to-end tests. See `docs/RELEASE-TEST-MATRIX-20261013.md` and `DEPLOYMENT.md`.
