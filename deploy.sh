#!/bin/bash
# deploy.sh — build zip, commit and push all changes to GitHub

set -e

# Use provided commit message or fall back to a default
MESSAGE="${1:-Update extension}"

# Read version from manifest.json
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\(.*\)".*/\1/')
ZIP_FILE="releases/youtube-subtitle-styler-v${VERSION}.zip"

echo "Building v${VERSION}..."
mkdir -p releases

zip -r "$ZIP_FILE" \
  manifest.json \
  content.js \
  background.js \
  popup.html \
  popup.js \
  icons/ \
  -x "*.DS_Store"

echo "Created $ZIP_FILE"

echo "Staging all changes..."
git add .

# Check if there's anything to commit
if git diff --cached --quiet; then
  echo "Nothing to commit. Working tree is clean."
  exit 0
fi

echo "Committing: \"$MESSAGE\""
git commit -m "$MESSAGE"

echo "Pushing to GitHub..."
git push

echo "Done!"
