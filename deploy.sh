#!/bin/bash
# deploy.sh — commit and push all changes to GitHub

set -e

# Use provided commit message or fall back to a default
MESSAGE="${1:-Update extension}"

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
