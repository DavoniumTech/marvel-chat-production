# Marvel Chat — Launch Next Steps

This package is the repaired **frontend production candidate** built against the supplied current Marvel Chat backend contract. It keeps the existing frontend filenames and architecture.

## Confirmed in the build

- Firebase project: `project-ec531e09-e3fd-4408-a35`
- Cloud Functions region: `europe-west1`
- Production domain: `marvelchat.davoniumtech.com`
- Production reCAPTCHA Enterprise App Check site key is configured.
- Frontend callable catalog matches the 52 callable exports in the supplied backend source.
- `dispatchNotificationPush` is not incorrectly treated as a callable; it is a Firestore trigger.
- Chat, Home, Skills, Market, Following, Notifications, and R2 media calls use the real backend interfaces exposed by the supplied backend.
- The frontend uses `ReCaptchaEnterpriseProvider` for the production App Check key.

## Required backend step before public Home traffic

The frontend Home queries use `visibility == "public"` and `status == "active"` together with `createdAt` ordering. The supplied `firestore.indexes.json` is empty. Validate and deploy the required composite index from the backend project before relying on the Home feed in production.

From Cloud Shell:

```bash
cd /home/dawudaminu444444/Marvel-Chat-V1-0
cat firestore.indexes.json
firebase deploy --only firestore:indexes
```

If Firebase reports a missing composite index during a live read, use the exact index definition or console link Firebase provides. Do not invent an alternate index.

## Firestore rules caution

The local `firestore.rules` file was corrected during the backend repair, but it was **not** blindly redeployed. Compare the local source with the live rules before deploying rules. A rules deployment replaces the project's ruleset, so do not use a whole-project deployment as a shortcut.

## Windows CMD: update GitHub

Open Command Prompt and enter the existing production repository directory. Do not create a second repository and do not force-push.

```cmd
cd C:\path	o\marvel-chat-production
git status
git pull
```

Copy the contents of this frontend package into that repository, keeping the real filenames. Then:

```cmd
git add index.html js css assets manifest.json sw.js _headers docs
git diff --cached
git commit -m "Repair production frontend integration"
git push origin main
```

Use the repository's actual default branch if it is not `main`.

## Cloudflare / custom domain

The supplied ZIPs did not contain a Cloudflare Worker or Wrangler configuration, so the Worker-side implementation cannot be certified from source here. Keep authenticated Firebase traffic, Firestore data, callable responses, private chat data, notifications, and private media URLs out of indiscriminate CDN caching.

After GitHub Pages has published the new files, use the existing Cloudflare configuration for `marvelchat.davoniumtech.com`. Purge affected static assets only when necessary. Do not introduce a second proxy layer.

## Final real-browser test

After deployment, test from a fresh/private browser session:

1. Open `https://marvelchat.davoniumtech.com/`.
2. Confirm the console has no App Check initialization error.
3. Sign up/login and restore the session after refresh.
4. Load Home and confirm posts/Moments appear.
5. Use exact username search in Chat.
6. Create/open a direct thread with another real account.
7. Send, receive, mark read, and delete a message.
8. Complete provider setup and create a real Skills listing.
9. Create a Market store, open the store, create a product, set stock, activate the product, and verify discovery.
10. Test on both desktop and phone.

Only after these live tests pass should the release be described as production-ready.
