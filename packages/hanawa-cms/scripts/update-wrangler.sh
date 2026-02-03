#!/bin/bash
# update-wrangler.sh - Update wrangler to latest version
# Usage: ./scripts/update-wrangler.sh

set -e

echo "Updating wrangler to latest version..."
echo ""

# Get current version
CURRENT_VERSION=$(pnpm list wrangler --depth=0 2>/dev/null | grep "^wrangler" | awk '{print $2}' || echo "unknown")
echo "Current version: $CURRENT_VERSION"

# Update wrangler
pnpm update wrangler@latest

# Get new version
NEW_VERSION=$(pnpm list wrangler --depth=0 2>/dev/null | grep "^wrangler" | awk '{print $2}' || echo "unknown")
echo "Updated version: $NEW_VERSION"

echo ""
if [ "$CURRENT_VERSION" != "$NEW_VERSION" ]; then
  echo "✓ Wrangler updated: $CURRENT_VERSION → $NEW_VERSION"
  echo ""
  echo "Next steps:"
  echo "  1. Test the update: pnpm run build"
  echo "  2. Commit changes: git add package.json pnpm-lock.yaml"
  echo "  3. git commit -m 'chore: update wrangler to $NEW_VERSION'"
else
  echo "✓ Wrangler is already at the latest version ($CURRENT_VERSION)"
fi
echo ""
