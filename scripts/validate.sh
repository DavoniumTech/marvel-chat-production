#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== MARVEL CHAT FRONTEND VALIDATION ==="
python3 - <<'PY2'
import json
from pathlib import Path
json.loads(Path("manifest.json").read_text())
print("MANIFEST_JSON=PASS")
PY2

for file in $(find js -type f -name "*.js" | sort); do
  node --check "$file"
done

test -f index.html
test -f sw.js
test -f _headers
test -f robots.txt
test -f sitemap.xml
test -f terms.html
test -f privacy.html
test -f community-guidelines.html
test -f assets/brand/icon-192.png
test -f assets/brand/icon-512.png
test -f assets/brand/davonium-technologies-logo.png

python3 - <<'PY3'
from pathlib import Path
roots = [Path("index.html"), Path("js"), Path("css"), Path("terms.html"), Path("privacy.html"), Path("community-guidelines.html"), Path("README.md")]
forbidden = ["No Facebook", "No Apple", "No Microsoft"]
for path in roots:
    files = [path] if path.is_file() else sorted(path.rglob("*"))
    for file in files:
        if not file.is_file() or file.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            continue
        text = file.read_text(errors="ignore")
        if "TimeTrust" in text:
            raise SystemExit(f"Forbidden legacy product name found: {file}")
        for phrase in forbidden:
            if phrase.lower() in text.lower():
                raise SystemExit(f"Forbidden third-party product copy found: {file}: {phrase}")
print("PUBLIC_COPY_CHECK=PASS")
PY3

echo "PUBLIC_COPY_CHECK=PASS"
echo "JS_SYNTAX=PASS"
echo "STRUCTURE=PASS"
echo "VALIDATION_COMPLETE=PASS"
