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

if grep -RniE --exclude='*.png' --exclude='*.jpg' --exclude='*.jpeg' --exclude='*.webp' 'TimeTrust|No Facebook|No Apple|No Microsoft|example\.com|placeholder production' index.html js css terms.html privacy.html community-guidelines.html; then
  echo "PUBLIC_COPY_CHECK=FAIL"
  exit 1
fi

python3 - <<'PY3'
from pathlib import Path
import re
api = Path("js/api.js").read_text()
chunk = re.search(r"const names = \[(.*?)\];", api, re.S).group(1)
forbidden = {"dispatchNotificationPush"}
names = {x.strip().strip("\"") for x in chunk.split(",") if x.strip()}
assert not (names & forbidden), "Trigger was incorrectly added to callable frontend catalog."
assert "6LcYItwtAAAAAFWkMn7GYro06LuG3VMR1K0U1Xgb" in Path("js/config.js").read_text()
print("CALLABLE_CATALOG_CHECK=PASS")
print("APP_CHECK_CONFIG_CHECK=PASS")
PY3

echo "PUBLIC_COPY_CHECK=PASS"
echo "JS_SYNTAX=PASS"
echo "STRUCTURE=PASS"
echo "VALIDATION_COMPLETE=PASS"
