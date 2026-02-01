#!/bin/bash
# bump-version.sh - Update version across all Hanawa CMS files
# Usage: ./scripts/bump-version.sh 0.1.0

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 0.1.0"
  exit 1
fi

NEW_VERSION="$1"

echo "Bumping version to $NEW_VERSION..."

# 1. package.json
echo "  → package.json"
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json

# 2. wrangler.jsonc (APP_VERSION)
echo "  → wrangler.jsonc"
sed -i '' "s/\"APP_VERSION\": \"[^\"]*\"/\"APP_VERSION\": \"$NEW_VERSION\"/" wrangler.jsonc

# 3. Sync pnpm-lock.yaml
echo "  → pnpm-lock.yaml (pnpm install)"
pnpm install --silent

echo ""
echo "✓ Version bumped to $NEW_VERSION"
echo ""
echo "Files updated:"
echo "  - package.json"
echo "  - pnpm-lock.yaml"
echo "  - wrangler.jsonc"
echo ""
echo "Next steps:"
echo "  1. git add . && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  2. git tag -a v$NEW_VERSION -m 'v$NEW_VERSION'"
echo "  3. git push origin main --tags"
echo "  4. npm run deploy"
echo ""
echo "  5. Create release WITH DETAILED NOTES:"
echo "     gh release create v$NEW_VERSION --title 'v$NEW_VERSION - Description' --notes '\$(cat <<EOF"
echo "     ## Features"
echo "     - Feature description"
echo "     ## Improvements"
echo "     - Improvement description"
echo "     **Full Changelog**: https://github.com/eSolia/codex/compare/vPREV...v$NEW_VERSION"
echo "     EOF"
echo "     )'"
echo ""
echo "⚠️  NEVER use --generate-notes alone. Always write detailed release notes!"
