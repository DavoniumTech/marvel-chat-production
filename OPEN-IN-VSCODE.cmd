@echo off
setlocal
cd /d "%~dp0"
where code >nul 2>nul
if errorlevel 1 (
  echo VS Code command 'code' was not found in PATH.
  echo Open this folder manually in VS Code:
  echo %cd%
  pause
  exit /b 1
)
code .
