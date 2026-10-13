# Marvel Chat Frontend Release — 13 October 2026

Static vanilla HTML/CSS/JavaScript. No frontend npm build is needed. Includes the existing app modules, PWA manifest/service worker, `CNAME`, optimized icons/logo, legal pages and validators.

## Windows CMD install

Download `MARVEL-CHAT-FRONTEND-RELEASE-20261013.zip` into Downloads, then:

```bat
cd /d "%USERPROFILE%\Downloads"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$zip = Join-Path $env:USERPROFILE 'Downloads\MARVEL-CHAT-FRONTEND-RELEASE-20261013.zip'; $dest = Join-Path $env:USERPROFILE 'Downloads\Marvel-Chat-Frontend-Release-20261013'; if (Test-Path $dest) { throw 'Destination already exists. Rename it or choose another destination.' }; Expand-Archive -LiteralPath $zip -DestinationPath $dest"
cd /d "%USERPROFILE%\Downloads\Marvel-Chat-Frontend-Release-20261013"
PUBLISH-MARVEL-CHAT-FRONTEND.cmd
```

The publisher uses `https://github.com/DavoniumTech/marvel-chat-production.git` and the known staging clone in Downloads. It fetches `main` over HTTP/1.1, creates branch `marvel-chat-release-20261013`, copies release files without mirroring/deleting unrelated files, shows staged diff, asks you to type `PUSH`, and pushes only that review branch. If the staging clone has uncommitted changes or points to a different repository, it stops safely. Do not force-push.

## Cloudflare publication

Review the PR and merge to `main` only after review and smoke tests. A branch push alone does not update production. Verify Cloudflare Workers Builds remains connected to this GitHub repository with `main` as production branch, and confirm a new deployment reaches Ready before assuming it is live.

## Validation and known gaps

`bash scripts/validate.sh` and Node `--check` for all `js/*.js` pass. Live Firebase/Auth/R2/FCM tests remain required. Home currently pages public posts only; follower-only feed merging is not complete. Moment viewer remains modal-based (not a full-screen story player with a 15-second timer). Comment ranking by likes is not implemented. Legal pages have placeholders for support email/legal contact and require company review. Skill/Market/Profile media and global quota/R2 cleanup require live smoke tests.
