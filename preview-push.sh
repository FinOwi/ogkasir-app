#!/bin/bash
# Push www/ terbaru ke repo preview (FinOwi/ogkasir-preview) untuk review UI zgg.
# Pakai: ./preview-push.sh
set -e
cd "$(dirname "$0")"
TOKEN=$(cat ~/workspace/duitku/.github-token)
rm -rf /tmp/ogprev
mkdir -p /tmp/ogprev
cp -r app/src/main/assets/www/* /tmp/ogprev/
cd /tmp/ogprev
git init -q
git config user.name "bow" && git config user.email "bow@ogkasir"
git add -A && git commit -qm "Preview update $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git branch -M main
git push -q "https://x-access-token:${TOKEN}@github.com/FinOwi/ogkasir-preview.git" main --force
echo "== Preview terbit: https://finowi.github.io/ogkasir-preview/ =="
