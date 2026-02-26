#!/bin/bash
# bump-version.sh - Update version across all Nexus files
# Usage: ./scripts/bump-version.sh 0.4.0

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 0.4.0"
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

# 3. static/openapi.yaml (served at /openapi.yaml, used by ReDoc)
echo "  → static/openapi.yaml"
sed -i '' "s/version: [0-9]\.[0-9]\.[0-9]/version: $NEW_VERSION/" static/openapi.yaml

# 4. Update wrangler to latest in all packages
echo "  → Updating wrangler to latest (all packages)"
while IFS= read -r pkg; do
  if grep -q '"wrangler"' "$pkg"; then
    pkg_dir="$(dirname "$pkg")"
    rel="${pkg_dir#./}"
    echo "    → ${rel:-.}/package.json"
    (cd "$pkg_dir" && pnpm update wrangler@latest --silent)
  fi
done < <(find . -name 'package.json' -not -path '*/node_modules/*' | sort)

# 5. Sync pnpm-lock.yaml
echo "  → pnpm-lock.yaml (pnpm install)"
pnpm install --lockfile-only --silent

echo ""
echo "✓ Version bumped to $NEW_VERSION"
echo ""
echo "Files updated:"
echo "  - package.json"
echo "  - pnpm-lock.yaml"
echo "  - wrangler.jsonc"
echo "  - static/openapi.yaml"
echo "  - wrangler (updated to latest in all packages)"
echo ""
echo "Next steps:"
echo "  1. Update SECURITY.md version history"
echo "  2. git add . && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  3. git tag -a v$NEW_VERSION -m 'v$NEW_VERSION'"
echo "  4. git push origin main --tags"
echo "  5. pnpm run deploy"
echo ""
echo "  6. Create release WITH DETAILED NOTES:"
echo "     gh release create v$NEW_VERSION --title 'v$NEW_VERSION - Description' --notes '\$(cat <<EOF"
echo "     ## Features"
echo "     - Feature description"
echo "     ## Improvements"
echo "     - Improvement description"
echo "     **Full Changelog**: https://github.com/eSolia/nexus/compare/vPREV...v$NEW_VERSION"
echo "     EOF"
echo "     )'"
echo ""
echo "⚠️  NEVER use --generate-notes alone. Always write detailed release notes!"
