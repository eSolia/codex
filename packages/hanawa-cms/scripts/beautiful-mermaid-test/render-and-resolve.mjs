/**
 * Render fragment SVGs with resolved CSS variables (no var() references).
 * Upload directly to R2 at the current paths.
 */

import { renderMermaid } from 'beautiful-mermaid';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

const theme = {
  bg: '#FFFFFF', fg: '#2D2F63', accent: '#e11d48', line: '#2D2F63',
  muted: '#6b7280', surface: '#fef3c7', border: '#FFBC68',
  font: 'IBM Plex Sans, -apple-system, BlinkMacSystemFont, Hiragino Sans, Noto Sans JP, sans-serif',
  transparent: true,
};

function colorMix(fg, bg, pct) {
  const parse = (hex) => {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [fr, fg2, fb] = parse(fg);
  const [br, bg2, bb] = parse(bg);
  const ratio = pct / 100;
  const r = Math.round(fr * ratio + br * (1 - ratio));
  const g = Math.round(fg2 * ratio + bg2 * (1 - ratio));
  const b = Math.round(fb * ratio + bb * (1 - ratio));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function preprocess(source) {
  return source
    .replace(/\["([^"]*?)"\]/g, '[$1]')
    .replace(/\|"([^"]*?)"\|/g, '|$1|')
    .replace(/\[\/\"([^"]*?)\"\/\]/g, '[$1]')
    .replace(/\[\/([^\]]*?)\/\]/g, '[$1]')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/^\s*style\s+\w+\s+fill:.*$/gm, '');
}

function padCjkLabels(source) {
  const textMap = new Map();
  let counter = 0;
  function makeWidthPlaceholder(text) {
    let latinEquivLen = 0;
    for (const ch of text) { latinEquivLen += CJK_RE.test(ch) ? 1.75 : 1; }
    const len = Math.ceil(latinEquivLen);
    const id = `PH${String(counter++).padStart(3, '0')}`;
    return `${id}${'M'.repeat(len)}`.substring(0, len);
  }
  const processed = source.replace(
    /(\[|\{|\(\[)([^\]\}]+?)(\]|\}|\]\))/g,
    (match, open, label, close) => {
      if (!CJK_RE.test(label)) return match;
      const placeholder = makeWidthPlaceholder(label);
      textMap.set(placeholder, label);
      return `${open}${placeholder}${close}`;
    }
  );
  return { source: processed, textMap };
}

function restoreCjkText(svg, textMap) {
  let result = svg;
  for (const [placeholder, original] of textMap) {
    result = result.replaceAll(`>${placeholder}<`, `>${original}<`);
  }
  return result;
}

function smoothPolylines(svg, radius = 12) {
  return svg.replace(
    /<polyline\s+points="([^"]+)"([^/]*?)\/>/g,
    (match, pointsStr, attrs) => {
      const points = pointsStr.trim().split(/\s+/).map((p) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
      if (points.length <= 2) {
        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        return `<path d="${d}"${attrs}/>`;
      }
      const segments = [`M${points[0].x},${points[0].y}`];
      for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1], curr = points[i], next = points[i + 1];
        const dxP = prev.x - curr.x, dyP = prev.y - curr.y;
        const dxN = next.x - curr.x, dyN = next.y - curr.y;
        const dP = Math.sqrt(dxP * dxP + dyP * dyP);
        const dN = Math.sqrt(dxN * dxN + dyN * dyN);
        const r = Math.min(radius, dP / 2, dN / 2);
        segments.push(`L${curr.x + (dxP / dP) * r},${curr.y + (dyP / dP) * r}`);
        segments.push(`Q${curr.x},${curr.y} ${curr.x + (dxN / dN) * r},${curr.y + (dyN / dN) * r}`);
      }
      segments.push(`L${points[points.length - 1].x},${points[points.length - 1].y}`);
      return `<path d="${segments.join(' ')}"${attrs}/>`;
    }
  );
}

function resolveVariables(svg) {
  const { bg, fg, accent, line, muted, surface, border } = theme;
  const vars = {
    '--bg': bg, '--fg': fg, '--line': line, '--accent': accent,
    '--muted': muted, '--surface': surface, '--border': border,
    '--_text': fg, '--_text-sec': muted, '--_text-muted': muted,
    '--_text-faint': colorMix(fg, bg, 25), '--_line': line,
    '--_arrow': accent, '--_node-fill': surface, '--_node-stroke': border,
    '--_group-fill': bg, '--_group-hdr': colorMix(fg, bg, 5),
    '--_inner-stroke': colorMix(fg, bg, 12), '--_key-badge': colorMix(fg, bg, 10),
  };
  let result = svg;
  const sortedVars = Object.entries(vars).sort((a, b) => b[0].length - a[0].length);
  for (const [name, value] of sortedVars) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`var\\(${escaped}(?:,\\s*[^)]+)?\\)`, 'g');
    result = result.replace(re, value);
  }
  result = result.replace(/<style>[\s\S]*?<\/style>\s*/, '');
  result = result.replace(/\s*style="--bg:[^"]*"/, '');
  return result;
}

async function renderFull(source) {
  let processed = preprocess(source);
  const { source: padded, textMap } = padCjkLabels(processed);
  let svg = await renderMermaid(padded, theme);
  svg = smoothPolylines(svg);
  svg = restoreCjkText(svg, textMap);
  svg = resolveVariables(svg);
  return svg;
}

// Current R2 paths from D1
const fragments = [
  {
    lang: 'en',
    r2Path: 'diagrams/mermaid-1771582382883-6iui1v.svg',
    source: `flowchart TB
    internet["🌐 Fiber Internet<br/>(ISP)"]
    ont["ONT / ONU"]
    subgraph rack["Office Rack"]
        ups["UPS<br/>(Rack Mount)"]
        fw["FortiWifi<br/>Firewall · Router · Wi-Fi"]
        sw["FortiSwitch<br/>Managed Switch"]
    end
    subgraph wired["Wired Devices"]
        desktop["🖥️ Desktops"]
        printer["🖨️ Printers"]
        phone["📞 IP Phones"]
    end
    subgraph wireless["Wireless Devices"]
        laptop["💻 Laptops"]
        mobile["📱 Mobile"]
        tablet["Tablets"]
    end
    internet --- ont
    ont --- fw
    fw --- sw
    sw --- desktop
    sw --- printer
    sw --- phone
    fw -.-|"Wi-Fi"| laptop
    fw -.-|"Wi-Fi"| mobile
    fw -.-|"Wi-Fi"| tablet
    ups ~~~ fw
    ups ~~~ sw`,
  },
  {
    lang: 'ja',
    r2Path: 'diagrams/mermaid-1771582376583-tmzrno.svg',
    source: `flowchart TB
    internet["🌐 光ファイバー<br/>(ISP)"]
    ont["ONT / ONU"]
    subgraph rack["オフィスラック"]
        ups["UPS<br/>(ラックマウント)"]
        fw["FortiWifi<br/>ファイアウォール・ルーター・Wi-Fi"]
        sw["FortiSwitch<br/>マネージドスイッチ"]
    end
    subgraph wired["有線デバイス"]
        desktop["🖥️ デスクトップ"]
        printer["🖨️ プリンター"]
        phone["📞 IP電話"]
    end
    subgraph wireless["無線デバイス"]
        laptop["💻 ノートPC"]
        mobile["📱 モバイル"]
        tablet["タブレット"]
    end
    internet --- ont
    ont --- fw
    fw --- sw
    sw --- desktop
    sw --- printer
    sw --- phone
    fw -.-|"Wi-Fi"| laptop
    fw -.-|"Wi-Fi"| mobile
    fw -.-|"Wi-Fi"| tablet
    ups ~~~ fw
    ups ~~~ sw`,
  },
];

async function main() {
  for (const { lang, r2Path, source } of fragments) {
    console.log(`[${lang}] Rendering...`);
    const svg = await renderFull(source);
    const varCount = (svg.match(/var\(--/g) || []).length;
    console.log(`  var() remaining: ${varCount}`);
    console.log(`  Has <style>: ${svg.includes('<style>')}`);
    const filename = r2Path.replace('diagrams/', '');
    const outPath = join(__dirname, 'output', 'fragments', filename);
    writeFileSync(outPath, svg);
    console.log(`  → ${outPath}`);
    console.log(`  R2: ${r2Path}`);
  }
}

main().catch(console.error);
