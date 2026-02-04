#!/bin/bash
# update-wrangler.sh - Update wrangler to latest version
# Usage: ./scripts/update-wrangler.sh

set -e

echo "Updating wrangler to latest version..."
echo ""

# Get current project version
CURRENT_VERSION=$(pnpm list wrangler --depth=0 2>/dev/null | grep "^wrangler" | awk '{print $2}' || echo "unknown")
echo "Current project version: $CURRENT_VERSION"

# Get current global version
GLOBAL_CURRENT=$(wrangler --version 2>/dev/null || echo "not installed")
echo "Current global version:  $GLOBAL_CURRENT"
echo ""

# Update project wrangler
echo "Updating project wrangler..."
pnpm update wrangler@latest

# Update global wrangler
echo "Updating global wrangler..."
if command -v pnpm &> /dev/null; then
  pnpm add -g wrangler@latest 2>/dev/null || echo "  (global update failed - continuing)"
elif command -v npm &> /dev/null; then
  npm install -g wrangler@latest 2>/dev/null || echo "  (global update failed - continuing)"
fi

# Get new versions
NEW_VERSION=$(pnpm list wrangler --depth=0 2>/dev/null | grep "^wrangler" | awk '{print $2}' || echo "unknown")
GLOBAL_NEW=$(wrangler --version 2>/dev/null || echo "not installed")
echo ""
echo "Updated project version: $NEW_VERSION"
echo "Updated global version:  $GLOBAL_NEW"

echo ""
if [ "$CURRENT_VERSION" != "$NEW_VERSION" ] || [ "$GLOBAL_CURRENT" != "$GLOBAL_NEW" ]; then
  echo "✓ Wrangler updated!"
  echo ""
  echo "Project: $CURRENT_VERSION → $NEW_VERSION"
  echo "Global:  $GLOBAL_CURRENT → $GLOBAL_NEW"
  echo ""
  echo "Next steps:"
  echo "  1. Test the update: pnpm run build"
  echo "  2. Commit changes: git add package.json pnpm-lock.yaml"
  echo "  3. git commit -m 'chore: update wrangler to $NEW_VERSION'"
else
  echo "✓ Wrangler is already at the latest version"
  echo "  Project: $CURRENT_VERSION"
  echo "  Global:  $GLOBAL_CURRENT"
fi
echo ""
