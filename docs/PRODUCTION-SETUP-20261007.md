# Marvel Chat — Production Setup Runbook

## 1. Current browser configuration

`js/config.js` is configured with the public reCAPTCHA Enterprise site key and public FCM Web Push VAPID key supplied for this project.

The browser must never contain Firebase Admin credentials, service-account JSON, Cloudflare R2 secrets, or FCM private credentials.

## 2. Verified media contract

The current backend supports Home posts with up to 10 media IDs. Each media item is limited to 2 MiB by the backend. Supported MIME types are JPEG, PNG, WebP, GIF, MP4, WebM and QuickTime.

This frontend compresses raster images before upload and attempts native browser video re-encoding before upload. GIFs that are already within the backend limit are preserved to avoid destroying animation. A video that cannot be compressed by the browser is not silently uploaded over the backend limit.

The current backend does not define an authoritative 2 MiB-per-day quota. This frontend does not invent a client-only daily quota. A daily quota would need backend enforcement to be trustworthy.

## 3. GitHub Pages domain

The production hostname is:

`marvelchat.davoniumtech.com`

A root `CNAME` file is included in this package with that exact hostname.

In GitHub:

1. Open the Marvel Chat repository.
2. Open `Settings` → `Pages`.
3. Under `Custom domain`, enter `marvelchat.davoniumtech.com`.
4. Save.
5. Keep GitHub Pages source set to the branch/folder containing the frontend package contents.
6. Wait for DNS and HTTPS provisioning.

For DNS at the domain registrar, create:

- Type: `CNAME`
- Host/Name: `marvelchat`
- Target/Value: `davoniumtech.github.io`

Do not create a CNAME pointing to the repository name.

## 4. Firebase Authentication authorized domain

Firebase Console → Authentication → Settings → Authorized domains → Add domain:

`marvelchat.davoniumtech.com`

Keep the existing Firebase domains needed by the project.

## 5. App Check

Google Cloud reCAPTCHA/Fraud Defense must have the production hostname allowed on the Web key:

`marvelchat.davoniumtech.com`

Firebase Console → App Check → `marvel chat v 1` → Fraud Defense/reCAPTCHA Enterprise should use the same public site key.

Do not add `localhost` to the production reCAPTCHA key.

## 6. Browser push

Firebase Console → Project Settings → Cloud Messaging → Web Push certificates must contain the VAPID key pair used to produce the public key in `js/config.js`.

The frontend gets the Firebase Installation ID and FCM registration token, then calls the existing `registerDevice` backend contract with `deviceId`, `installationId`, `token`, `platform` and `browser`.

## 7. R2 browser upload

The frontend uses the current signed flow:

`createMediaUpload` → signed PUT to R2 → `finalizeMediaUpload` → `createPost`/`createMoment`

The production R2 bucket must allow browser CORS for the production site to perform PUT requests to signed URLs. Do not expose R2 credentials in browser code.

## 8. Windows local checks

From the extracted frontend root in CMD:

```cmd
node --check js\app.js
node --check js\firebase.js
node --check js\media.js
node --check js\ui.js
bash scripts\validate.sh
```

If `bash` is not available on Windows, run the Node syntax checks individually and use the included `scripts/validate.sh` from Git Bash or Cloud Shell.

For simple UI-only local testing:

```cmd
cd /d C:\path\to\marvel-chat-frontend
python -m http.server 5500
```

Then open:

`http://127.0.0.1:5500/`

Production App Check and browser push should be certified on the HTTPS custom domain, not assumed from localhost.

## 9. GitHub upload workflow

Upload the contents of the `marvel-chat-frontend` folder to the GitHub Pages source branch/folder. Do not upload the outer ZIP as the published site unless the repository workflow explicitly extracts it.

Before pushing, confirm:

- `index.html` is at the published site root.
- `js/config.js` contains only public browser configuration values.
- `CNAME` contains `marvelchat.davoniumtech.com`.
- `sw.js` is at the published site root.
- `assets/brand/` is present.

## 10. Certification order

1. DNS resolves.
2. GitHub Pages serves the site.
3. HTTPS is active.
4. Firebase Authentication authorized domain accepts the production hostname.
5. App Check obtains a valid browser token on the production hostname.
6. Email/password login works.
7. Google sign-in works.
8. Home reads posts and Moments.
9. Chat creates a direct thread and sends messages.
10. Skills reads active listings.
11. Market reads discovery results.
12. Profile reads and updates the authenticated profile.
13. Home media upload works through R2.
14. Browser push registration works.
15. A real FCM notification reaches a second test device.

Production-ready should only be declared after these gates are exercised in a real browser.
