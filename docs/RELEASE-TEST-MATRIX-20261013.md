# Marvel Chat release test matrix — 13 October 2026

Use disposable accounts/content.

| Area | Test | Expected result | Status |
|---|---|---|---|
| Auth | Email/Google cold + warm login | Intended state restored, no extra sign-in while session valid | Live test required |
| Home | Load 5 then scroll/paginate | Spinner; 3 next items; no duplicates; cache on return | Static checked; live test required |
| Post media | 1 image and multi-media | Large media/carousel and signed URL | Live test required |
| Like/save | Like/unlike, save/unsave, saved shelf | server-consistent state, saved content owner-only | index + live test required |
| Comments | First/next page, private post authorization | stable cursor pages; unauthorized caller denied | function/rules/index check required |
| Moments | Create/edit/delete disposable text/photo | photo opens; edit preserves media; cleanup is real | Live test required; viewer is still modal |
| Profile photo | Upload/replace and view cross-surface | signed image in Profile/Home/Chat/Moment | Live test required |
| Chat | DM identity, edit/delete message, pin/hide thread | text-only and server authorization enforced | Live test required |
| Skills | Provider onboarding + listing image/request | correct provider identity; request reaches provider | Live test required |
| Market | Store + product with required photo | persisted product and private photo | Live test required |
| Quota | uploads totaling 2 MiB across all engines | server rejects excess, UTC reset, retries don't double count | Critical live test |
| R2 cleanup | Delete disposable content; shared reference case | only unreferenced object removed | Critical live test |
| Notifications | initial unread badge and dismiss | badge accurate; active item disappears | Function deployed; UI test required |
| Legal | open/back each page | returns to app state; placeholders filled | placeholders/legal review |
| PWA/offline | cold/warm/offline/switch account | shell usable, no private cache leak, truthful failure state | Device test required |
