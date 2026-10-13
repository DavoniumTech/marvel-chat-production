# Windows CMD publish steps

1. Download `MARVEL-CHAT-FRONTEND-RELEASE-20261013.zip` to Downloads.
2. Open CMD (Win+R → `cmd`) and run:

```bat
cd /d "%USERPROFILE%\Downloads"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$zip = Join-Path $env:USERPROFILE 'Downloads\MARVEL-CHAT-FRONTEND-RELEASE-20261013.zip'; $dest = Join-Path $env:USERPROFILE 'Downloads\Marvel-Chat-Frontend-Release-20261013'; if (Test-Path $dest) { throw 'Destination exists. Rename it first.' }; Expand-Archive -LiteralPath $zip -DestinationPath $dest"
cd /d "%USERPROFILE%\Downloads\Marvel-Chat-Frontend-Release-20261013"
PUBLISH-MARVEL-CHAT-FRONTEND.cmd
```

The helper pushes branch `marvel-chat-release-20261013` to the existing repository. Review the PR and merge to `main` only after smoke tests. Confirm a new Ready deployment in Cloudflare; a branch push alone does not publish production.
