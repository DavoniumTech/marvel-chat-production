@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PUBLISH-MARVEL-CHAT-FRONTEND.ps1" %*
exit /b %ERRORLEVEL%
