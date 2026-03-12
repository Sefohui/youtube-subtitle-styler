#!/bin/bash
# deploy.sh — build Firefox and Chrome zips, commit and push to GitHub

set -e

# ── Parse flags ───────────────────────────────────────────────────────────────
BUMP=false
BUILD_ONLY=false
RELEASE=false
RELEASE_NOTES=""
REMAINING=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --bump)    BUMP=true;    shift ;;
    --build)   BUILD_ONLY=true; shift ;;
    --release) RELEASE=true; shift ;;
    --notes)   RELEASE_NOTES="$2"; shift 2 ;;
    *)         REMAINING+=("$1"); shift ;;
  esac
done

MESSAGE="${REMAINING[*]:-Update extension}"

# ── Handle --bump flag ────────────────────────────────────────────────────────
if [ "$BUMP" = true ]; then
  CURRENT=$(grep '"version"' manifest.json | sed 's/.*"version": *"\(.*\)".*/\1/')
  echo "Current version: $CURRENT"
  printf "New version: "
  read NEW_VERSION
  if [ -z "$NEW_VERSION" ]; then
    echo "No version entered, aborting."
    exit 1
  fi
  sed -i '' "s/\"version\": \"${CURRENT}\"/\"version\": \"${NEW_VERSION}\"/" manifest.json
  echo "Updated manifest.json: $CURRENT -> $NEW_VERSION"
fi

VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\(.*\)".*/\1/')
RELEASES="releases"

echo "Building v${VERSION}..."
mkdir -p "$RELEASES"

# ── Generate PNG icons from SVG for Chrome ───────────────────────────────────
echo "Generating PNG icons..."
for size in 16 32 48 128; do
  magick icons/icon.svg -resize ${size}x${size} icons/icon-${size}.png
done

# ── Firefox build (PNG icons, full manifest with gecko settings) ──────────────
echo "Generating Firefox manifest..."
python3 - <<'EOF'
import json

with open("manifest.json") as f:
    m = json.load(f)

for size in ["16", "32", "48", "128"]:
    if "icons" in m:
        m["icons"][size] = f"icons/icon-{size}.png"
    if "action" in m and "default_icon" in m["action"]:
        m["action"]["default_icon"][size] = f"icons/icon-{size}.png"

with open("manifest.firefox.json", "w") as f:
    json.dump(m, f, indent=2)
EOF

FF_ZIP="${RELEASES}/youtube-subtitle-styler-v${VERSION}-firefox.zip"
echo "Packaging Firefox build -> $FF_ZIP"

cp manifest.json manifest.source.json
cp manifest.firefox.json manifest.json

zip -r "$FF_ZIP" \
  manifest.json \
  content.js \
  background.js \
  popup.html \
  popup.js \
  options.html \
  options.js \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-128.png \
  -x "*.DS_Store"

cp manifest.source.json manifest.json
rm manifest.firefox.json manifest.source.json

# ── Chrome build (PNG icons, stripped manifest) ───────────────────────────────
echo "Generating Chrome manifest..."
# Build a Chrome manifest: swap icon references to .png and remove browser_specific_settings
python3 - <<'EOF'
import json, re

with open("manifest.json") as f:
    m = json.load(f)

# Replace .svg icon paths with .png
def replace_icons(obj):
    if isinstance(obj, dict):
        return {k: replace_icons(v) for k, v in obj.items()}
    if isinstance(obj, str) and obj.endswith(".svg"):
        base = obj.replace("icon.svg", "")
        # Will be set per-size below
        return obj.replace("icon.svg", "icon.svg")  # placeholder, handled below
    return obj

for size in ["16", "32", "48", "128"]:
    if "icons" in m:
        m["icons"][size] = f"icons/icon-{size}.png"
    if "action" in m and "default_icon" in m["action"]:
        m["action"]["default_icon"][size] = f"icons/icon-{size}.png"

# Remove Firefox-specific keys
m.pop("browser_specific_settings", None)

with open("manifest.chrome.json", "w") as f:
    json.dump(m, f, indent=2)
EOF

CHROME_ZIP="${RELEASES}/youtube-subtitle-styler-v${VERSION}-chrome.zip"
echo "Packaging Chrome build -> $CHROME_ZIP"

# Temporarily rename manifest for zipping
cp manifest.json manifest.firefox.json
cp manifest.chrome.json manifest.json

zip -r "$CHROME_ZIP" \
  manifest.json \
  content.js \
  background.js \
  popup.html \
  popup.js \
  options.html \
  options.js \
  icons/icon-16.png \
  icons/icon-32.png \
  icons/icon-48.png \
  icons/icon-128.png \
  -x "*.DS_Store"

# Restore original manifest
cp manifest.firefox.json manifest.json
rm manifest.firefox.json manifest.chrome.json

echo "Created:"
echo "  $FF_ZIP"
echo "  $CHROME_ZIP"

if [ "$BUILD_ONLY" = true ]; then
  echo "Build complete. Skipping AMO upload, GitHub release, and git push."
  exit 0
fi

# ── Upload to Firefox Add-ons (AMO) ──────────────────────────────────────────
if [ -n "$AMO_JWT_ISSUER" ] && [ -n "$AMO_JWT_SECRET" ]; then

  # Generate a JWT token using Python stdlib (no external packages needed)
  AMO_JWT=$(python3 - <<EOF
import json, hmac, hashlib, base64, time, os

def b64url(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

issued = int(time.time())
header  = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(',', ':')))
payload = b64url(json.dumps({
    "iss": os.environ["AMO_JWT_ISSUER"],
    "jti": str(issued),
    "iat": issued,
    "exp": issued + 300,
}, separators=(',', ':')))

msg = f"{header}.{payload}"
sig = b64url(hmac.new(os.environ["AMO_JWT_SECRET"].encode(), msg.encode(), hashlib.sha256).digest())
print(f"{msg}.{sig}")
EOF
)

  ADDON_ID="youtube-subtitle-styler@extension"

  # Check the latest version already on AMO
  AMO_VERSION=$(curl -s \
    "https://addons.mozilla.org/api/v5/addons/addon/${ADDON_ID}/versions/?ordering=-created&page_size=1" \
    -H "Authorization: JWT ${AMO_JWT}" \
    | python3 -c "import sys,json; data=json.load(sys.stdin); print(data['results'][0]['version'] if data.get('results') else '')" 2>/dev/null || echo "")

  if [ "$AMO_VERSION" = "$VERSION" ]; then
    echo "Skipping AMO upload — v${VERSION} is already uploaded."
  else
    echo "Uploading v${VERSION} to AMO (current on AMO: ${AMO_VERSION:-none})..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "https://addons.mozilla.org/api/v5/addons/${ADDON_ID}/versions/" \
    -H "Authorization: JWT ${AMO_JWT}" \
    -F "upload=@${FF_ZIP}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
      echo "Uploaded to AMO! — awaiting review."
    elif [ "$HTTP_CODE" = "409" ] || [ "$HTTP_CODE" = "404" ]; then
      echo "Skipping AMO upload — v${VERSION} is already uploaded to AMO."
    else
      echo "AMO upload failed (HTTP $HTTP_CODE):"
      echo "$BODY"
      exit 1
    fi
  fi
else
  echo "Skipping AMO upload (AMO_JWT_ISSUER and AMO_JWT_SECRET not set)."
fi

# ── Create GitHub release ────────────────────────────────────────────────────
if [ "$RELEASE" = true ]; then
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "Skipping GitHub release (GITHUB_TOKEN not set)."
  else
    REPO="Sefohui/youtube-subtitle-styler"

    # Check if a release already exists for this version
    EXISTING=$(curl -s \
      "https://api.github.com/repos/${REPO}/releases/tags/v${VERSION}" \
      -H "Authorization: Bearer ${GITHUB_TOKEN}")

    RELEASE_ID=$(echo "$EXISTING" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

    if [ -n "$RELEASE_ID" ]; then
      echo "Release v${VERSION} already exists — updating..."

      # Update description if --notes was provided
      if [ -n "$RELEASE_NOTES" ]; then
        RELEASE_BODY=$(python3 -c "import json; print(json.dumps('${RELEASE_NOTES}'))")
        curl -s -X PATCH \
          "https://api.github.com/repos/${REPO}/releases/${RELEASE_ID}" \
          -H "Authorization: Bearer ${GITHUB_TOKEN}" \
          -H "Content-Type: application/json" \
          -d "{\"body\": ${RELEASE_BODY}}" > /dev/null
      fi

      # Delete existing zip assets so we can re-upload
      echo "$EXISTING" | python3 -c "
import sys, json
assets = json.load(sys.stdin).get('assets', [])
for a in assets:
    print(a['id'])
" | while read ASSET_ID; do
        curl -s -X DELETE \
          "https://api.github.com/repos/${REPO}/releases/assets/${ASSET_ID}" \
          -H "Authorization: Bearer ${GITHUB_TOKEN}"
      done

      UPLOAD_URL="https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets"
    else
      echo "Creating GitHub release v${VERSION}..."
      RELEASE_BODY=$(python3 -c "import json; print(json.dumps('${RELEASE_NOTES}'))")
      RELEASE_RESPONSE=$(curl -s -X POST \
        "https://api.github.com/repos/${REPO}/releases" \
        -H "Authorization: Bearer ${GITHUB_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "{\"tag_name\": \"v${VERSION}\", \"name\": \"v${VERSION}\", \"body\": ${RELEASE_BODY}}")

      RELEASE_ID=$(echo "$RELEASE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
      UPLOAD_URL="https://uploads.github.com/repos/${REPO}/releases/${RELEASE_ID}/assets"

      if [ -z "$RELEASE_ID" ]; then
        echo "Failed to create GitHub release:"
        echo "$RELEASE_RESPONSE"
        exit 1
      fi
    fi

    # Upload Firefox zip
    curl -s -X POST "${UPLOAD_URL}?name=$(basename $FF_ZIP)" \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Content-Type: application/zip" \
      --data-binary "@${FF_ZIP}" > /dev/null

    # Upload Chrome zip
    curl -s -X POST "${UPLOAD_URL}?name=$(basename $CHROME_ZIP)" \
      -H "Authorization: Bearer ${GITHUB_TOKEN}" \
      -H "Content-Type: application/zip" \
      --data-binary "@${CHROME_ZIP}" > /dev/null

    echo "GitHub release v${VERSION} updated with Firefox and Chrome zips."
  fi
fi

# ── Git commit and push ───────────────────────────────────────────────────────
echo "Staging all changes..."
git add .

if git diff --cached --quiet; then
  echo "Nothing to commit. Working tree is clean."
  exit 0
fi

echo "Committing: \"$MESSAGE\""
git commit -m "$MESSAGE"

echo "Pushing to GitHub..."
git push

echo "Done!"
