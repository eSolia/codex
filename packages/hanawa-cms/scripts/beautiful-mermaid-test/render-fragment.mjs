/**
 * Render a fragment's mermaid diagrams (EN + JA) using beautiful-mermaid.
 *
 * Produces SVG files ready for upload to R2.
 */

import { renderMermaid } from 'beautiful-mermaid';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output', 'fragments');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// CJK character detection
const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

// eSolia brand theme (transparent bg for embedding)
const esoliaTheme = {
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
 * Preprocess Mermaid source for beautiful-mermaid compatibility.
 * Strips quotes, replaces <br/>, converts unsupported shapes, removes style directives.
 */
function preprocessForBeautiful(source) {
  return (
    source
      .replace(/\["([^"]*?)"\]/g, '[$1]')
      .replace(/\|"([^"]*?)"\|/g, '|$1|')
      .replace(/\[\/\"([^"]*?)\"\/\]/g, '[$1]')
      .replace(/\[\/([^\]]*?)\/\]/g, '[$1]')
      .replace(/<br\s*\/?>/g, ' ')
      // Remove style directives (beautiful-mermaid uses CSS vars for theming)
      .replace(/^\s*style\s+\w+\s+fill:.*$/gm, '')
  );
}

/**
 * Pad CJK labels with width-equivalent Latin placeholders before rendering.
 */
function padCjkLabels(source) {
  const textMap = new Map();
  let counter = 0;

  function makeWidthPlaceholder(text) {
    let latinEquivLen = 0;
    for (const ch of text) {
      if (CJK_RE.test(ch)) {
        latinEquivLen += 1.75;
      } else {
        latinEquivLen += 1;
      }
    }
    const len = Math.ceil(latinEquivLen);
    const id = `PH${String(counter++).padStart(3, '0')}`;
    const filler = 'M'.repeat(len);
    return `${id}${filler}`.substring(0, len);
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

/**
 * Restore original CJK text in the SVG after rendering.
 */
function restoreCjkText(svg, textMap) {
  let result = svg;
  for (const [placeholder, original] of textMap) {
    result = result.replaceAll(`>${placeholder}<`, `>${original}<`);
  }
  return result;
}

/**
 * Post-process SVG to convert straight polylines into smooth curved paths.
 */
function smoothPolylines(svg, radius = 12) {
  return svg.replace(/<polyline\s+points="([^"]+)"([^/]*?)\/>/g, (match, pointsStr, attrs) => {
    const points = pointsStr
      .trim()
      .split(/\s+/)
      .map((p) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });

    if (points.length <= 2) {
      const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      return `<path d="${d}"${attrs}/>`;
    }

    const segments = [];
    segments.push(`M${points[0].x},${points[0].y}`);

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

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

    segments.push(`L${points[points.length - 1].x},${points[points.length - 1].y}`);
    return `<path d="${segments.join(' ')}"${attrs}/>`;
  });
}

/**
 * Full beautiful-mermaid render pipeline.
 */
async function renderBeautiful(source, theme) {
  let processed = preprocessForBeautiful(source);
  const { source: padded, textMap } = padCjkLabels(processed);
  let svg = await renderMermaid(padded, theme);
  svg = smoothPolylines(svg);
  svg = restoreCjkText(svg, textMap);
  return svg;
}

// ─── Fragment definitions ───────────────────────────────────────────────────

const fragments = [
  {
    id: 'fortinet-small-office-network-diagram',
    name: 'Fortinet Small Office Network',
    en: {
      svgPath: 'diagrams/mermaid-1771563234360-u0azfm.svg',
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
    ja: {
      svgPath: 'diagrams/mermaid-1771563229306-tyykia.svg',
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
  },
];

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  for (const frag of fragments) {
    console.log(`\n=== ${frag.name} (${frag.id}) ===\n`);

    for (const lang of ['en', 'ja']) {
      const { source, svgPath } = frag[lang];
      console.log(`  [${lang}] Rendering...`);
      const start = performance.now();

      try {
        const svg = await renderBeautiful(source, esoliaTheme);
        const elapsed = (performance.now() - start).toFixed(0);

        // Save with the R2 path filename for easy upload
        const filename = svgPath.replace('diagrams/', '');
        const outPath = join(outDir, filename);
        writeFileSync(outPath, svg);
        console.log(`    ✓ ${elapsed}ms → ${outPath}`);
        console.log(`    R2 path: ${svgPath}`);
      } catch (err) {
        const elapsed = (performance.now() - start).toFixed(0);
        console.log(`    ✗ ${elapsed}ms — Error: ${err.message}`);
      }
    }
  }

  console.log(`\nOutput: ${outDir}`);
}

main().catch(console.error);
