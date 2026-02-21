/**
 * Beautiful-mermaid diagram renderer for export-quality SVGs.
 *
 * Used by the mermaid-block export flow to produce clean, themed SVGs
 * for R2 storage and PDF generation. Client-side preview continues
 * to use mermaid.js for interactive DOM rendering.
 *
 * Pipeline:
 * 1. Preprocess — strip quotes, <br/>, unsupported shapes
 * 2. Pad CJK — replace CJK labels with width-equivalent Latin placeholders
 * 3. Render — beautiful-mermaid layout + SVG generation
 * 4. Smooth — convert polyline corners to bezier curves
 * 5. Restore — swap placeholders back to original CJK text
 *
 * InfoSec: No user input is passed to eval or innerHTML; SVG is string-built (OWASP A03)
 */

import { renderMermaid } from 'beautiful-mermaid';

// CJK character range detection
const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

// Diagram types supported by beautiful-mermaid
const SUPPORTED_TYPES = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'stateDiagram',
];

/** eSolia brand theme (transparent background for embedding) */
export const ESOLIA_THEME = {
  bg: '#FFFFFF',
  fg: '#2D2F63',
  accent: '#e11d48',
  line: '#2D2F63',
  muted: '#6b7280',
  surface: '#fef3c7',
  border: '#FFBC68',
  font: 'IBM Plex Sans, -apple-system, BlinkMacSystemFont, Hiragino Sans, Noto Sans JP, sans-serif',
  transparent: true,
};

/**
 * Check whether a mermaid source string uses a diagram type
 * supported by beautiful-mermaid.
 */
export function isBeautifulMermaidSupported(source: string): boolean {
  const firstLine = source.trim().split('\n')[0]?.trim() ?? '';
  return SUPPORTED_TYPES.some((t) => firstLine.startsWith(t));
}

/**
 * Strip Mermaid syntax that beautiful-mermaid's parser doesn't handle:
 * - Quoted node labels: ["text"] → [text]
 * - Quoted edge labels: |"text"| → |text|
 * - Trapezoid shapes: [/"text"/] → [text]
 * - HTML line breaks: <br/> → space (newlines break the parser)
 * - Style directives: beautiful-mermaid uses CSS custom properties
 */
function preprocess(source: string): string {
  return source
    .replace(/\["([^"]*?)"\]/g, '[$1]')
    .replace(/\|"([^"]*?)"\|/g, '|$1|')
    .replace(/\[\/"([^"]*?)"\/\]/g, '[$1]')
    .replace(/\[\/([^\]]*?)\/\]/g, '[$1]')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/^\s*style\s+\w+\s+fill:.*$/gm, '');
}

/**
 * Replace CJK-containing labels with width-equivalent Latin placeholders
 * so the layout engine allocates correct node widths.
 *
 * Each CJK character is ~1.75x the width of a Latin character at the
 * same font size (13px CJK ≈ 7.5px Latin metrics).
 */
function padCjkLabels(source: string): { source: string; textMap: Map<string, string> } {
  const textMap = new Map<string, string>();
  let counter = 0;

  function makeWidthPlaceholder(text: string): string {
    let latinEquivLen = 0;
    for (const ch of text) {
      latinEquivLen += CJK_RE.test(ch) ? 1.75 : 1;
    }
    const len = Math.ceil(latinEquivLen);
    const id = `PH${String(counter++).padStart(3, '0')}`;
    return `${id}${'M'.repeat(len)}`.substring(0, len);
  }

  const processed = source.replace(
    /(\[|\{|\(\[)([^\]}]+?)(\]|}|\]\))/g,
    (match: string, open: string, label: string, close: string) => {
      if (!CJK_RE.test(label)) return match;
      const placeholder = makeWidthPlaceholder(label);
      textMap.set(placeholder, label);
      return `${open}${placeholder}${close}`;
    }
  );

  return { source: processed, textMap };
}

/**
 * Swap Latin placeholders back to original CJK text in the rendered SVG.
 */
function restoreCjkText(svg: string, textMap: Map<string, string>): string {
  let result = svg;
  for (const [placeholder, original] of textMap) {
    result = result.replaceAll(`>${placeholder}<`, `>${original}<`);
  }
  return result;
}

/**
 * Convert straight polyline corners into smooth quadratic bezier curves.
 * beautiful-mermaid outputs `<polyline>` elements; this transforms them
 * to `<path>` with `Q` commands at each bend.
 */
function smoothPolylines(svg: string, radius = 12): string {
  return svg.replace(
    /<polyline\s+points="([^"]+)"([^/]*?)\/>/g,
    (_match: string, pointsStr: string, attrs: string) => {
      const points = pointsStr
        .trim()
        .split(/\s+/)
        .map((p) => {
          const [x, y] = p.split(',').map(Number);
          return { x: x!, y: y! };
        });

      if (points.length <= 2) {
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return `<path d="${d}"${attrs}/>`;
      }

      const segments: string[] = [`M${points[0]!.x},${points[0]!.y}`];

      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1]!;
        const curr = points[i]!;
        const next = points[i + 1]!;

        const dxPrev = prev.x - curr.x;
        const dyPrev = prev.y - curr.y;
        const dxNext = next.x - curr.x;
        const dyNext = next.y - curr.y;

        const distPrev = Math.sqrt(dxPrev * dxPrev + dyPrev * dyPrev);
        const distNext = Math.sqrt(dxNext * dxNext + dyNext * dyNext);

        const r = Math.min(radius, distPrev / 2, distNext / 2);

        const startX = curr.x + (dxPrev / distPrev) * r;
        const startY = curr.y + (dyPrev / distPrev) * r;
        const endX = curr.x + (dxNext / distNext) * r;
        const endY = curr.y + (dyNext / distNext) * r;

        segments.push(`L${startX},${startY}`);
        segments.push(`Q${curr.x},${curr.y} ${endX},${endY}`);
      }

      const last = points[points.length - 1]!;
      segments.push(`L${last.x},${last.y}`);
      return `<path d="${segments.join(' ')}"${attrs}/>`;
    }
  );
}

/**
 * Mix two hex colors in sRGB space (emulates CSS color-mix).
 * @param fg Foreground hex color (e.g. "#2D2F63")
 * @param bg Background hex color (e.g. "#FFFFFF")
 * @param pct Percentage of fg (0–100)
 */
function colorMix(fg: string, bg: string, pct: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [fr, fg2, fb] = parse(fg);
  const [br, bg2, bb] = parse(bg);
  const ratio = pct / 100;
  const r = Math.round(fr! * ratio + br! * (1 - ratio));
  const g = Math.round(fg2! * ratio + bg2! * (1 - ratio));
  const b = Math.round(fb! * ratio + bb! * (1 - ratio));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Resolve all CSS custom properties (var(--...)) to concrete hex colors.
 *
 * beautiful-mermaid outputs SVGs that rely on CSS variables and color-mix().
 * PDF renderers and <img> tags cannot resolve these, so we inline the
 * computed values to make the SVG fully self-contained.
 */
function resolveVariables(svg: string, theme: typeof ESOLIA_THEME): string {
  const { bg, fg, accent, line, muted, surface, border } = theme;

  // Compute derived colors (matching beautiful-mermaid's CSS)
  const vars: Record<string, string> = {
    // Root theme variables
    '--bg': bg,
    '--fg': fg,
    '--line': line,
    '--accent': accent,
    '--muted': muted,
    '--surface': surface,
    '--border': border,
    // Derived variables
    '--_text': fg,
    '--_text-sec': muted,
    '--_text-muted': muted,
    '--_text-faint': colorMix(fg, bg, 25),
    '--_line': line,
    '--_arrow': accent,
    '--_node-fill': surface,
    '--_node-stroke': border,
    '--_group-fill': bg,
    '--_group-hdr': colorMix(fg, bg, 5),
    '--_inner-stroke': colorMix(fg, bg, 12),
    '--_key-badge': colorMix(fg, bg, 10),
  };

  let result = svg;

  // Replace var(--name) and var(--name, fallback) references
  // Process longest variable names first to avoid partial matches
  const sortedVars = Object.entries(vars).sort((a, b) => b[0].length - a[0].length);
  for (const [name, value] of sortedVars) {
    // Match var(--name) and var(--name, fallback)
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`var\\(${escaped}(?:,\\s*[^)]+)?\\)`, 'g');
    result = result.replace(re, value);
  }

  // Remove the <style> block (no longer needed — all vars are inlined)
  result = result.replace(/<style>[\s\S]*?<\/style>\s*/, '');

  // Remove inline style attribute with CSS variable definitions on root <svg>
  result = result.replace(/\s*style="--bg:[^"]*"/, '');

  return result;
}

/**
 * Render a Mermaid diagram source to a themed SVG string using beautiful-mermaid.
 *
 * Returns a self-contained SVG string with all CSS variables resolved to
 * concrete hex colors, ready for R2 upload and PDF embedding.
 * Throws if the source cannot be parsed.
 */
export async function renderDiagramSvg(
  source: string,
  theme: typeof ESOLIA_THEME = ESOLIA_THEME
): Promise<string> {
  const processed = preprocess(source);
  const { source: padded, textMap } = padCjkLabels(processed);
  let svg = await renderMermaid(padded, theme);
  svg = smoothPolylines(svg);
  svg = restoreCjkText(svg, textMap);
  svg = resolveVariables(svg, theme);
  return svg;
}
