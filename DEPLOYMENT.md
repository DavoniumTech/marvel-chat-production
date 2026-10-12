# Marvel Chat frontend release candidate — Windows CMD / GitHub

This archive contains the website files at its root. It is a static vanilla HTML/CSS/JavaScript app; no frontend npm build is required.

## Extract from Windows Downloads

Open Command Prompt (Win+R, type `cmd`) and run:

```bat
cd /d "%USERPROFILE%\Downloads"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%USERPROFILE%\Downloads\MARVEL-CHAT-FRONTEND-RELEASE-20261012-v2.zip' -DestinationPath '%USERPROFILE%\Downloads\Marvel-Chat-Frontend-Release-20261012-v2' -Force"
cd /d "%USERPROFILE%\Downloads\Marvel-Chat-Frontend-Release-20261012-v2"
dir
```

## Push a review branch from CMD

Run `PUBLISH-MARVEL-CHAT-FRONTEND.cmd` from the extracted folder. It prompts for the HTTPS URL of the **existing frontend GitHub repository**, clones into a new staging folder in Downloads, creates a new branch, copies this release over the matching files, runs Git whitespace checks, and pushes the branch. It does not force-push or merge to the live branch.

After pushing, review the branch on GitHub and create a pull request. Do not merge or publish until the backend preflight and the real-user smoke tests pass. The GitHub push by itself does not prove the Cloudflare/Pages deployment has been triggered.

## Release validation

Run `bash scripts/validate.sh` from Git Bash. The package is validated for static structure and JavaScript syntax; that is not a substitute for live Firebase/R2 end-to-end tests.

## Known backend dependency

The frontend expects `markNotificationRead` to delete/dismiss a notification and expects the current `getPublicProfiles` callable for chat peer identity. The paired backend candidate changes only `markNotificationRead`; do not run a blanket Functions deployment. The deployed `getMyMediaDailyUsage` source was not included in the supplied master export and must remain untouched.
