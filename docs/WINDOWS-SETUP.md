# Windows 10 — Extract and Open in VS Code

Assuming the ZIP is saved as:

`C:\\Users\\YOUR_NAME\\Downloads\\MARVEL-CHAT-FRONTEND-PRODUCTION-CANDIDATE-20261007.zip`

Open Command Prompt and run:

```cmd
cd /d C:\\Users\\YOUR_NAME\\Downloads
powershell -NoProfile -Command "Expand-Archive -LiteralPath 'MARVEL-CHAT-FRONTEND-PRODUCTION-CANDIDATE-20261007.zip' -DestinationPath 'marvel-chat-final' -Force"
cd /d C:\\Users\\YOUR_NAME\\Downloads\\marvel-chat-final\\marvel-chat-frontend
code .
```

Or extract normally with File Explorer, enter the extracted folder, and double-click `OPEN-IN-VSCODE.cmd`.

The expected project root contains `index.html`, `js`, `css`, `assets`, `docs`, and `manifest.json`.
