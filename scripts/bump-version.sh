#!/bin/bash
# bump-version.sh - Update version across all project files
# Usage: ./scripts/bump-version.sh 0.4.0
#
# Discovers and updates version in:
#   - package.json (root + immediate subdirectories)
#   - wrangler.jsonc APP_VERSION (anywhere in project)
#   - openapi.yaml (anywhere in project)
#   - wrangler dependency (all packages)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

if [ -z "$1" ]; then
  echo "Usage: $0 <new-version>"
  echo "Example: $0 0.4.0"
  exit 1
fi

NEW_VERSION="$1"

echo "Bumping version to $NEW_VERSION..."
echo ""

# 1. Update "version" in package.json files (root + one level deep)
echo "  → Updating package.json version"
FOUND_PKG=false
while IFS= read -r pkg; do
  if grep -q '"version"' "$pkg"; then
    rel="${pkg#./}"
    echo "    → $rel"
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" "$pkg"
    FOUND_PKG=true
  fi
done < <(find . -maxdepth 2 -name 'package.json' -not -path '*/node_modules/*' | sort)
if ! $FOUND_PKG; then
  echo "    (no package.json with version field found)"
fi

# 2. Update APP_VERSION in all wrangler.jsonc files
echo "  → Updating wrangler.jsonc APP_VERSION"
FOUND_WRANGLER=false
while IFS= read -r wrangler; do
  if grep -q 'APP_VERSION' "$wrangler"; then
    rel="${wrangler#./}"
    echo "    → $rel"
    sed -i '' "s/\"APP_VERSION\": \"[^\"]*\"/\"APP_VERSION\": \"$NEW_VERSION\"/" "$wrangler"
    FOUND_WRANGLER=true
  fi
done < <(find . -name 'wrangler.jsonc' -not -path '*/node_modules/*' | sort)
if ! $FOUND_WRANGLER; then
  echo "    (no wrangler.jsonc with APP_VERSION found)"
fi

# 3. Update version in openapi.yaml files
echo "  → Updating openapi.yaml version"
FOUND_SPEC=false
while IFS= read -r spec; do
  rel="${spec#./}"
  echo "    → $rel"
  sed -E -i '' "s/version: [0-9]+\.[0-9]+\.[0-9]+/version: $NEW_VERSION/" "$spec"
  FOUND_SPEC=true
done < <(find . -name 'openapi.yaml' -not -path '*/node_modules/*' | sort)
if ! $FOUND_SPEC; then
  echo "    (no openapi.yaml found — skipping)"
fi

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
echo "Next steps:"
echo "  1. Update SECURITY.md version history (if applicable)"
echo "  2. git add . && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "  3. git tag -a v$NEW_VERSION -m 'v$NEW_VERSION'"
echo "  4. git push origin main --tags"
echo "  5. Deploy"
echo "  6. Create release WITH DETAILED NOTES (never use --generate-notes alone)"
echo ""
