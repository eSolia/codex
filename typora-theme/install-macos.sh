#!/bin/bash
# eSolia Typora Theme Installer for macOS
# Run: chmod +x install-macos.sh && ./install-macos.sh

set -e

echo "🎨 Installing eSolia Typora Theme..."

# Define theme directory
THEME_DIR="$HOME/Library/Application Support/abnerworks.Typora/themes"

# Check if Typora theme folder exists
if [ ! -d "$THEME_DIR" ]; then
    echo "⚠️  Typora theme folder not found."
    echo "   Please ensure Typora is installed and has been run at least once."
    echo "   Expected location: $THEME_DIR"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Copy theme files
echo "📁 Copying theme files..."
cp "$SCRIPT_DIR/esolia.css" "$THEME_DIR/"
cp -r "$SCRIPT_DIR/esolia" "$THEME_DIR/"

echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Restart Typora"
echo "2. Go to Themes menu and select 'eSolia'"
echo ""
echo "Theme installed to: $THEME_DIR"
