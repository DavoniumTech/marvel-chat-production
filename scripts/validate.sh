#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== MARVEL CHAT PRODUCTION FRONTEND VALIDATION ==="
python3 - <<'PY'
import json
from pathlib import Path
manifest = json.loads(Path("manifest.json").read_text(encoding="utf-8"))
assert manifest.get("display") in {"standalone", "minimal-ui"}
assert any(icon.get("sizes") == "192x192" for icon in manifest.get("icons", []))
assert any(icon.get("sizes") == "512x512" for icon in manifest.get("icons", []))
print("MANIFEST_JSON=PASS")
PY

while IFS= read -r -d '' file; do
  node --check "$file"
done < <(find js -type f -name '*.js' -print0 | sort -z)

for file in index.html sw.js _headers robots.txt sitemap.xml terms.html privacy.html community-guidelines.html community.html assets/brand/icon-192.png assets/brand/icon-512.png assets/brand/davonium-technologies-logo.png PUBLISH-MARVEL-CHAT-FRONTEND.cmd PUBLISH-MARVEL-CHAT-FRONTEND.ps1; do
  test -f "$file" || { echo "MISSING_REQUIRED_FILE=$file"; exit 1; }
done

python3 - <<'PY0'
from pathlib import Path
import hashlib
root = Path(".")
manifest = root / "SOURCE-MANIFEST.sha256"
if not manifest.exists():
    raise SystemExit("SOURCE_MANIFEST=FAIL: missing manifest")
entries = {}
for raw in manifest.read_text(encoding="utf-8").splitlines():
    if not raw.strip():
        continue
    digest, relative = raw.split(None, 1)
    entries[relative.strip()] = digest
actual = {
    p.as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in root.rglob("*")
    if p.is_file() and p != manifest and ".git" not in p.parts and "node_modules" not in p.parts
}
missing = sorted(set(actual) - set(entries))
extra = sorted(set(entries) - set(actual))
wrong = sorted(name for name in set(actual) & set(entries) if actual[name] != entries[name])
if missing or extra or wrong:
    print("SOURCE_MANIFEST=FAIL")
    if missing: print("Unlisted files:", missing)
    if extra: print("Missing files:", extra)
    if wrong: print("Hash mismatch:", wrong)
    raise SystemExit(1)
print("SOURCE_MANIFEST=PASS")
PY0

python3 - <<'PY'
from pathlib import Path
import json, re, hashlib
api = Path("js/api.js").read_text(encoding="utf-8")
app = Path("js/app.js").read_text(encoding="utf-8")
state = Path("js/state.js").read_text(encoding="utf-8")
sw = Path("sw.js").read_text(encoding="utf-8")
headers = Path("_headers").read_text(encoding="utf-8")
index = Path("index.html").read_text(encoding="utf-8")
chunk_match = re.search(r"const names = \[(.*?)\];", api, re.S)
assert chunk_match, "Frontend callable catalog not found"
chunk = chunk_match.group(1)
forbidden = {"dispatchNotificationPush"}
names = {x.strip().strip('"') for x in chunk.split(",") if x.strip()}
assert not (names & forbidden), "Trigger must not be in callable frontend catalog"
assert '"getPublicProfiles"' in chunk and '"submitFeedback"' in chunk
assert "httpsCallable(functions, name)" in api
assert "6LcYItwtAAAAAFWkMn7GYro06LuG3VMR1K0U1Xgb" in Path("js/config.js").read_text(encoding="utf-8")
assert 'api.getHomeFeed({limit: 3' in app and 'state.homeCursor = feed?.nextCursor || null' in app
assert 'scope:"people_posts"' in app, "Home search must use People + Posts scope"
assert 'option value="people_posts"' in app and 'option value="users"' in app
assert 'Find people, skills, products, and shops.' not in app
assert 'getMyMediaDailyUsage' in api
assert 'https://www.davoniumtech.com/' in app and 'support@davoniumtech.com' in Path("terms.html").read_text(encoding="utf-8")
assert 'beforeinstallprompt' in app and 'navigator.onLine' in app
assert 'marvel-chat-shell-20261015-1' in sw
assert 'key.startsWith("marvel-chat-shell-")' in sw, "Activation must not delete other origin caches"
assert 'candidate.origin === self.location.origin' in sw, "Notification URLs must be same-origin only"
assert 'same-origin-allow-popups' in headers, "Keep Google popup auth policy"
assert 'id="connection-status"' in index and 'id="pwa-update-status"' in index
assert 'api.registerDevice' in app and 'api.unregisterDevice' in app, "Existing push token backend integration must remain"
assert 'https://www.davoniumtech.com/contact' in app
print("CALLABLE_CATALOG_CHECK=PASS")
print("APP_CHECK_CONFIG_CHECK=PASS")
print("HOME_FEED_CONTRACT_CHECK=PASS")
print("SEARCH_SCOPE_CHECK=PASS")
print("CORPORATE_LINKS_CHECK=PASS")
print("PWA_INSTALL_OFFLINE_UPDATE_CHECK=PASS")
print("SERVICE_WORKER_CACHE_AND_NAVIGATION_CHECK=PASS")
print("FCM_BACKEND_CONTRACT_PRESERVED=PASS")
PY

if grep -RniE --exclude='*.png' --exclude='*.jpg' --exclude='*.jpeg' --exclude='*.webp' 'TimeTrust|No Facebook|No Apple|No Microsoft|example\.com|placeholder production' index.html js css terms.html privacy.html community-guidelines.html; then
  echo "PUBLIC_COPY_CHECK=FAIL"
  exit 1
fi

echo "PUBLIC_COPY_CHECK=PASS"
echo "JS_SYNTAX=PASS"
echo "STRUCTURE=PASS"
echo "VALIDATION_COMPLETE=PASS"
