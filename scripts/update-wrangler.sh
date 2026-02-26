#!/bin/bash
# update-wrangler.sh - Update wrangler to latest version in all packages
# Usage: ./scripts/update-wrangler.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "Updating wrangler to latest version..."
echo ""

# Find all package.json files containing wrangler (exclude node_modules)
PACKAGES=()
while IFS= read -r pkg; do
  if grep -q '"wrangler"' "$pkg"; then
    PACKAGES+=("$pkg")
  fi
done < <(find . -name 'package.json' -not -path '*/node_modules/*' | sort)

if [ ${#PACKAGES[@]} -eq 0 ]; then
  echo "No packages with wrangler dependency found."
  exit 0
fi

echo "Found wrangler in ${#PACKAGES[@]} package(s):"
echo ""

# Get current global version
GLOBAL_CURRENT=$(wrangler --version 2>/dev/null || echo "not installed")
echo "Global version: $GLOBAL_CURRENT"
echo ""

# Update each package
ANY_UPDATED=false
for pkg in "${PACKAGES[@]}"; do
  pkg_dir="$(dirname "$pkg")"
  rel="${pkg_dir#./}"
  label="${rel:-.}"

  CURRENT=$(cd "$pkg_dir" && pnpm list wrangler --depth=0 2>/dev/null | grep "wrangler" | awk '{print $2}' || echo "unknown")
  echo "  $label (current: $CURRENT)"

  (cd "$pkg_dir" && pnpm update wrangler@latest)

  NEW=$(cd "$pkg_dir" && pnpm list wrangler --depth=0 2>/dev/null | grep "wrangler" | awk '{print $2}' || echo "unknown")
  if [ "$CURRENT" != "$NEW" ]; then
    echo "    → Updated: $CURRENT → $NEW"
    ANY_UPDATED=true
  else
    echo "    → Already at latest ($NEW)"
  fi
  echo ""
done

# Update global wrangler
echo "Updating global wrangler..."
if command -v pnpm &> /dev/null; then
  pnpm add -g wrangler@latest 2>/dev/null || echo "  (global update failed - continuing)"
elif command -v npm &> /dev/null; then
  npm install -g wrangler@latest 2>/dev/null || echo "  (global update failed - continuing)"
fi

GLOBAL_NEW=$(wrangler --version 2>/dev/null || echo "not installed")
echo ""

if $ANY_UPDATED || [ "$GLOBAL_CURRENT" != "$GLOBAL_NEW" ]; then
  echo "✓ Wrangler updated!"
  echo "  Global: $GLOBAL_CURRENT → $GLOBAL_NEW"
  echo ""
  echo "Next steps:"
  echo "  1. Test the update: pnpm run typecheck"
  echo "  2. Stage changes: git add -u"
  echo "  3. git commit -m 'chore: update wrangler to latest'"
else
  echo "✓ Wrangler is already at the latest version in all packages"
  echo "  Global: $GLOBAL_CURRENT"
fi
echo ""
