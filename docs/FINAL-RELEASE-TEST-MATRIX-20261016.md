# Release test matrix — 2026-10-16

| Area | Smoke test | Expected result |
|---|---|---|
| Auth | Sign in with Google; reload; sign out | Session behaves consistently, and menu closes |
| Home | Load first three posts; load more; follow user | Bounded pages; follows affect feed; no full-feed reload |
| Moments | Open followed account's Moment; create own Moment | Direct-follow story visibility and avatar crop work |
| Post composer | Select text; Bold/Normal; publish text+media | Formatting renders as formatting, not visible markup |
| Carousel | Swipe forward/back repeatedly; refresh nearby media URL | Current slide stays selected |
| Chat | Composer on mobile; pin/archive/hide; edit/delete message | Composer at viewport bottom; preferences and message actions persist |
| Market | Create product; attach multiple photos; open shop; save product | No CORS error; product links to shop; photos and save persist |
| Skills | Create/edit/delete service | Service author/provider is correct; deletion removes public listing |
| Profile | Open followers and following lists | Bounded lists render and counts are clickable |
| Push | Enable explicitly; send test notification foreground/background | Delivery works on supported device after permission |
| Quota | Use media in more than one feature on same test account | Shared limit stays 2 MiB in rolling 24 hours; server rejects extra upload |

Use disposable test accounts and media for destructive actions. Any failed smoke test is a release blocker for that feature.
