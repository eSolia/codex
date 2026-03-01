#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# generate.sh — Convert markdown to branded eSolia PDF
#
# Features:
#   - Renders Mermaid diagrams to PNG automatically
#   - Applies eSolia branding (IBM Plex Sans JP, navy/sky/amber palette)
#   - Adds diagonal watermark + footer provenance line
#   - Designed for pricing/proposal docs shared via Courier/Nexus
#
# Prerequisites: typst, pandoc, mmdc (mermaid-cli)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Defaults ─────────────────────────────────────────────────
FONT_PATH="${MD2PDF_FONT_PATH:-/Users/rcogley/dev/esolia-2025/tools/capability-pdf/fonts}"
LOGO="${MD2PDF_LOGO:-/Users/rcogley/dev/esolia-2025/tools/capability-pdf/assets/esolia-logo.svg}"
DATE="$(date +"%d %b %Y")"
TODAY_YYYYMMDD="$(date +"%Y%m%d")"
NAME=""
EMAIL=""
SHORTCODE=""
OUTPUT=""
NO_WATERMARK=""
INPUT=""

# ── Usage ────────────────────────────────────────────────────
usage() {
  cat <<'EOF'
Usage: generate.sh [options] <input.md>

Convert a markdown file to a branded eSolia PDF with optional watermark.
Prompts interactively for shortcode, name, and email if not provided.

Options:
  --shortcode <code>   Company shortcode (prefixed to output filename)
  --name <name>        Recipient name (for watermark)
  --email <email>      Recipient email (for watermark)
  --date <date>        Date string (default: today)
  --output, -o <file>  Output PDF path (overrides auto-naming)
  --font-path <dir>    IBM Plex Sans JP fonts directory
  --logo <file>        eSolia logo SVG path
  --no-watermark       Disable watermark

Environment:
  MD2PDF_FONT_PATH     Default font directory
  MD2PDF_LOGO          Default logo path

Examples:
  # Interactive — just pass the markdown, script prompts for the rest
  ./generate.sh pricing.md

  # Non-interactive
  ./generate.sh --shortcode ACME --name "Joe Smith" --email "joe@co.jp" pricing.md

  # Without watermark (internal use)
  ./generate.sh --no-watermark --shortcode INTL internal-notes.md
EOF
  exit 1
}

# ── Parse arguments ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --shortcode)  SHORTCODE="$2"; shift 2 ;;
    --name)       NAME="$2"; shift 2 ;;
    --email)      EMAIL="$2"; shift 2 ;;
    --date)       DATE="$2"; shift 2 ;;
    --output|-o)  OUTPUT="$2"; shift 2 ;;
    --font-path)  FONT_PATH="$2"; shift 2 ;;
    --logo)       LOGO="$2"; shift 2 ;;
    --no-watermark) NO_WATERMARK=1; shift ;;
    -h|--help)    usage ;;
    -*)           echo "Unknown option: $1" >&2; usage ;;
    *)            INPUT="$1"; shift ;;
  esac
done

# ── Validate input ───────────────────────────────────────────
if [[ -z "$INPUT" ]]; then
  echo "Error: No input file specified." >&2
  usage
fi

if [[ ! -f "$INPUT" ]]; then
  echo "Error: Input file not found: $INPUT" >&2
  exit 1
fi

# ── Interactive prompts for missing values ───────────────────
if [[ -z "$SHORTCODE" ]]; then
  read -rp "Company shortcode: " SHORTCODE
fi

if [[ -z "$NO_WATERMARK" ]]; then
  if [[ -z "$NAME" ]]; then
    read -rp "Recipient name: " NAME
  fi
  if [[ -z "$EMAIL" ]]; then
    read -rp "Recipient email: " EMAIL
  fi
fi

# Validate we got what we need
if [[ -z "$SHORTCODE" ]]; then
  echo "Error: Company shortcode is required." >&2
  exit 1
fi

if [[ -z "$NO_WATERMARK" ]]; then
  if [[ -z "$NAME" ]]; then
    echo "Error: Recipient name is required (use --no-watermark to skip)." >&2
    exit 1
  fi
  if [[ -z "$EMAIL" ]]; then
    echo "Error: Recipient email is required (use --no-watermark to skip)." >&2
    exit 1
  fi
fi

# Check dependencies
for cmd in typst pandoc; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is not installed." >&2
    exit 1
  fi
done

if [[ ! -d "$FONT_PATH" ]]; then
  echo "Error: Font directory not found: $FONT_PATH" >&2
  exit 1
fi

if [[ ! -f "$LOGO" ]]; then
  echo "Error: Logo not found: $LOGO" >&2
  exit 1
fi

# Resolve to absolute path
INPUT="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"
INPUT_DIR="$(dirname "$INPUT")"

# ── Build output filename ────────────────────────────────────
# Format: {SHORTCODE}-{original-basename-with-today's-date}.pdf
# Swaps any YYYYMMDD date in the filename with today's date
if [[ -z "$OUTPUT" ]]; then
  BASENAME="$(basename "$INPUT" .md)"
  # Replace 8-digit date patterns (YYYYMMDD) with today
  NEW_BASENAME="$(echo "$BASENAME" | sed "s/[0-9]\{8\}/$TODAY_YYYYMMDD/g")"
  OUTPUT="${INPUT_DIR}/${SHORTCODE}-${NEW_BASENAME}.pdf"
fi

# Resolve output to absolute
if [[ "$OUTPUT" != /* ]]; then
  OUTPUT="$(pwd)/$OUTPUT"
fi

# ── Build watermark text ─────────────────────────────────────
WATERMARK=""
SHOW_WATERMARK="false"
if [[ -z "$NO_WATERMARK" ]]; then
  WATERMARK="Generated for ${NAME} ${EMAIL} on ${DATE}"
  SHOW_WATERMARK="true"
fi

# ── Create temp workdir ─────────────────────────────────────
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Copy assets
cp "$LOGO" "$WORKDIR/logo.svg"
cp "$SCRIPT_DIR/template.typ" "$WORKDIR/template.typ"

# ── Process Mermaid blocks ───────────────────────────────────
# Extract ```mermaid blocks, render to PNG, replace with image refs
HAS_MERMAID=0
MERMAID_COUNT=0
PROCESSED_MD="$WORKDIR/processed.md"

process_mermaid() {
  local in_mermaid=0
  local mermaid_file=""

  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^\`\`\`[[:space:]]*mermaid[[:space:]]*$ ]]; then
      in_mermaid=1
      MERMAID_COUNT=$((MERMAID_COUNT + 1))
      mermaid_file="$WORKDIR/mermaid-${MERMAID_COUNT}.mmd"
      : > "$mermaid_file"
      HAS_MERMAID=1
      continue
    fi

    if [[ $in_mermaid -eq 1 ]] && [[ "$line" =~ ^\`\`\`[[:space:]]*$ ]]; then
      in_mermaid=0
      # Render mermaid to PNG (PNG avoids Typst SVG foreign-object issues)
      echo "  Rendering Mermaid diagram ${MERMAID_COUNT}..." >&2
      if mmdc -i "$mermaid_file" -o "$WORKDIR/mermaid-${MERMAID_COUNT}.png" -b transparent -s 3 --quiet 2>/dev/null; then
        echo "![](mermaid-${MERMAID_COUNT}.png)"
      else
        echo "  Warning: Mermaid diagram ${MERMAID_COUNT} failed to render, keeping as code block." >&2
        echo '```'
        cat "$mermaid_file"
        echo '```'
      fi
      continue
    fi

    if [[ $in_mermaid -eq 1 ]]; then
      echo "$line" >> "$mermaid_file"
    else
      # Convert <!-- pagebreak --> to a marker that survives pandoc
      if [[ "$line" =~ ^[[:space:]]*\<!--[[:space:]]*pagebreak[[:space:]]*--\>[[:space:]]*$ ]]; then
        echo "PDFTYPSTPAGEBREAK"
      else
        echo "$line"
      fi
    fi
  done < "$INPUT"
}

echo "→ Processing markdown..."
process_mermaid > "$PROCESSED_MD"

if [[ $HAS_MERMAID -eq 1 ]]; then
  echo "  Rendered ${MERMAID_COUNT} Mermaid diagram(s)."
fi

# ── Convert markdown to typst via pandoc ─────────────────────
echo "→ Converting to Typst..."
pandoc \
  -f markdown+pipe_tables+backtick_code_blocks+fenced_code_blocks \
  -t typst \
  --wrap=none \
  "$PROCESSED_MD" \
  -o "$WORKDIR/content.typ"

# ── Post-process pandoc typst output ─────────────────────────
# 1. Define #horizontalrule (pandoc emits this for ---)
# 2. Make table headers repeat across page breaks
# 3. Constrain diagram images to 85% width
{
  cat <<'COMPAT'
// Pandoc compatibility
#let horizontalrule = {
  v(0.4em)
  line(length: 100%, stroke: 0.5pt + rgb("#CCCCCC"))
  v(0.4em)
}

COMPAT
  # Fix table.header to repeat, replace % widths with fr, constrain images
  # Pandoc emits columns: (22.5%, 30%, ...) — replace each N% with 1fr
  # IMPORTANT: only replace % on lines containing "columns:" to avoid mangling body text
  sed \
    -e 's/table\.header(/table.header(repeat: true, /g' \
    -e '/columns:/s/[0-9.]*%/1fr/g' \
    -e 's/#box(image("\([^"]*\)"))/#box(image("\1", width: 85%))/g' \
    -e 's/PDFTYPSTPAGEBREAK/#pagebreak()/g' \
    "$WORKDIR/content.typ"
} > "$WORKDIR/content-final.typ"
mv "$WORKDIR/content-final.typ" "$WORKDIR/content.typ"

# ── Compile PDF ──────────────────────────────────────────────
echo "→ Compiling PDF..."
typst compile \
  --root "$WORKDIR" \
  --font-path "$FONT_PATH" \
  --input "watermark=${WATERMARK}" \
  --input "show-watermark=${SHOW_WATERMARK}" \
  "$WORKDIR/template.typ" \
  "$OUTPUT"

SIZE=$(du -h "$OUTPUT" | cut -f1 | xargs)
echo "✓ $(basename "$OUTPUT") (${SIZE})"

# ── Open the result ──────────────────────────────────────────
open "$OUTPUT"
