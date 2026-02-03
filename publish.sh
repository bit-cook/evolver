#!/bin/bash
set -e

# publish.sh - One-shot sync for Evolver (GitHub + ClawHub)
# Usage: ./publish.sh "Commit message"

if [ -z "$1" ]; then
  echo "❌ Error: Missing commit message."
  echo "Usage: ./publish.sh \"Your commit message\""
  exit 1
fi

MSG="$1"

echo "========================================"
echo "🚀 Evolver Publisher"
echo "========================================"

# 1. Git Sync
echo "🐙 [1/2] Syncing to GitHub..."
git add skills/evolver
# Only commit if there are changes
if ! git diff-index --quiet HEAD --; then
    git commit -m "$MSG"
    echo "   - Committed changes."
else
    echo "   - No file changes detected, proceeding to push..."
fi
git push
echo "   - Pushed to remote."

# 2. ClawHub Publish
echo "📦 [2/2] Publishing to ClawHub..."
# Note: --version patch will auto-increment the version in package.json
# We capture the output to verify success
clawhub publish skills/evolver \
  --slug evolver \
  --name "Evolution Engine" \
  --version patch \
  --changelog "$MSG"

echo "========================================"
echo "✅ Done! Evolver is live."
echo "========================================"