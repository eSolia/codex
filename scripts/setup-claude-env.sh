#!/usr/bin/env bash
set -euo pipefail

# setup-claude-env.sh
#
# Bootstrap a consuming repo with eSolia Claude Code rules, commands,
# and MCP config from the codex repository.
#
# Usage:
#   /path/to/codex/scripts/setup-claude-env.sh [target-repo-path]
#
# If target-repo-path is not provided, defaults to the current directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$CODEX_ROOT/config/claude"

TARGET_REPO="${1:-.}"
TARGET_REPO="$(cd "$TARGET_REPO" && pwd)"

echo "=== eSolia Claude Code Environment Setup ==="
echo ""
echo "  Codex root:  $CODEX_ROOT"
echo "  Target repo: $TARGET_REPO"
echo ""

# ── Verify codex config exists ────────────────────────────────────────────────

if [ ! -d "$CONFIG_DIR/rules" ] || [ ! -d "$CONFIG_DIR/commands" ]; then
  echo "ERROR: config/claude/ not found in codex repo at $CODEX_ROOT"
  echo "       Make sure you're running this from a valid codex checkout."
  exit 1
fi

# ── Create .claude directories ────────────────────────────────────────────────

CLAUDE_DIR="$TARGET_REPO/.claude"
mkdir -p "$CLAUDE_DIR/rules"
mkdir -p "$CLAUDE_DIR/commands"

echo "1. Created .claude/{rules,commands} directories"

# ── Symlink rules ─────────────────────────────────────────────────────────────

RULES_LINKED=0
for rule_file in "$CONFIG_DIR/rules/"*.md; do
  [ -f "$rule_file" ] || continue
  rule_name="$(basename "$rule_file")"
  target_link="$CLAUDE_DIR/rules/$rule_name"

  if [ -L "$target_link" ]; then
    # Remove existing symlink to refresh
    rm "$target_link"
  elif [ -f "$target_link" ]; then
    echo "   SKIP: $rule_name (regular file exists, not overwriting)"
    continue
  fi

  ln -s "$rule_file" "$target_link"
  RULES_LINKED=$((RULES_LINKED + 1))
done
echo "2. Symlinked $RULES_LINKED rule(s) from codex"

# ── Symlink commands ──────────────────────────────────────────────────────────

CMDS_LINKED=0
for cmd_file in "$CONFIG_DIR/commands/"*.md; do
  [ -f "$cmd_file" ] || continue
  cmd_name="$(basename "$cmd_file")"
  target_link="$CLAUDE_DIR/commands/$cmd_name"

  if [ -L "$target_link" ]; then
    rm "$target_link"
  elif [ -f "$target_link" ]; then
    echo "   SKIP: $cmd_name (regular file exists, not overwriting)"
    continue
  fi

  ln -s "$cmd_file" "$target_link"
  CMDS_LINKED=$((CMDS_LINKED + 1))
done
echo "3. Symlinked $CMDS_LINKED command(s) from codex"

# ── Copy MCP config template ─────────────────────────────────────────────────

MCP_TEMPLATE="$CONFIG_DIR/mcp.json.example"
MCP_TARGET="$TARGET_REPO/.mcp.json"

if [ -f "$MCP_TEMPLATE" ]; then
  if [ -f "$MCP_TARGET" ]; then
    echo "4. SKIP: .mcp.json already exists (not overwriting)"
  else
    cp "$MCP_TEMPLATE" "$MCP_TARGET"
    echo "4. Copied .mcp.json template"
  fi
else
  echo "4. SKIP: No mcp.json.example template found"
fi

# ── Print next steps ──────────────────────────────────────────────────────────

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo ""
echo "  1. Register the MCP server (user-scoped, works from any repo):"
echo "     claude mcp add esolia-standards --transport http -s user \\"
echo "       --url https://esolia-standards-mcp.esolia.workers.dev/mcp"
echo ""
echo "  2. Or copy .mcp.json to your project root for project-scoped config"
echo ""
echo "  3. Add .claude/rules/ and .claude/commands/ to .gitignore if"
echo "     symlinks shouldn't be committed (they point to your local codex)"
echo ""
echo "  4. Verify: start a Claude Code session and run /backpressure-review"
echo ""
