# Marvel Chat Production — 15 October 2026 frontend integration

## Production source

The current `marvel-chat-production` repository and UI remain the source of truth. This release adds only front-end corporate navigation/PWA reliability changes and search-scope tightening. It does not change callable names or server contracts.

## Windows CMD publisher

1. Extract the frontend ZIP to a new folder under Downloads.
2. Synchronize the existing production checkout if it is behind:

```bat
git -C "%USERPROFILE%\Downloads\marvel-chat-production" pull --ff-only origin main
git -C "%USERPROFILE%\Downloads\marvel-chat-production" status -sb
```

3. Run the included publisher with the known checkout:

```bat
cd /d "%USERPROFILE%\Downloads\Marvel-Chat-Production-Integration-20261015"
PUBLISH-MARVEL-CHAT-FRONTEND.cmd "%USERPROFILE%\Downloads\marvel-chat-production"
```

It validates the repository URL, `main` / `origin/main`, cleanliness and branch synchronization. It requires the explicit confirmations `CONFIRM-PRODUCTION-BRANCH` and `PUBLISH-MARVEL-CHAT`. It does not force-push or mirror-delete destination files.

## Backend status

This integration does not introduce backend API or data-schema changes. The supplied deployed-backend snapshot is a mapping of source bundles used by currently active second-generation Functions; do not unzip all historical bundles into one Firebase `functions` root and deploy them wholesale, because that could downgrade functions which were deployed from different source revisions. Verify the live inventory in Cloud Shell instead:

```bash
gcloud config set project project-ec531e09-e3fd-4408-a35
gcloud functions list --v2 --regions=europe-west1 --project=project-ec531e09-e3fd-4408-a35 --format="table(name,state,updateTime)"
```

A backend deployment is not required for the company links, search UI, install prompt, offline shell banner, service-worker cache namespace, or same-origin notification click handling. The existing FCM endpoints remain in use.

## Cloudflare

After a successful Git push, wait for the new Build deployment under Workers & Pages → `marvel-chat-production` → Deployments to show Ready. A Git push alone does not prove production has updated.

## Live test checklist

- Email and Google sign-in, session persistence and sign-out.
- Global Search: People and posts / People only; no Skills or Market option.
- Open Terms, Privacy and Community Guidelines; external company/contact links open in a new tab.
- Settings → Install and Check for updates (browser/device support varies).
- Go offline and online: message explains that live data/uploads require connectivity; cached shell and legal pages can load.
- Enable browser notifications and verify device registration plus an actual push on supported devices.
- Check light and dark theme, phone portrait/landscape, tablets, and laptop/desktop bottom navigation.
