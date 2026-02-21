/**
 * Compare beautiful-mermaid vs mmdc (mermaid-cli) SVG output
 *
 * Renders the same diagrams with both tools and saves side-by-side for visual comparison.
 */

import { renderMermaid, THEMES } from 'beautiful-mermaid';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// eSolia brand theme for beautiful-mermaid
const esoliaTheme = {
  bg: '#FFFFFF',
  fg: '#2D2F63', // Navy
  accent: '#e11d48', // Rose (Codex theme)
  line: '#2D2F63',
  muted: '#6b7280',
  surface: '#fef3c7', // Cream tint for node fills
  border: '#FFBC68', // Orange
  font: 'IBM Plex Sans, -apple-system, BlinkMacSystemFont, Hiragino Sans, Noto Sans JP, sans-serif',
};

const esoliaThemeTransparent = {
  ...esoliaTheme,
  transparent: true,
};

// CJK character detection
const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

// Test diagrams (from existing fragments)
const diagrams = [
  {
    name: 'fortinet-small-office-network',
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
    name: 'cloudflare-security-layers',
    source: `flowchart TB
    subgraph team["Your Team"]
        laptop["Laptops"]
        phone["Phones"]
        tablet["Tablets"]
    end

    subgraph cloudflare["Cloudflare Security Layer"]
        zt["Zero Trust Gateway"]
        dns["Secure DNS"]
        warp["Encrypted Tunnel"]
    end

    subgraph services["Protected Services"]
        m365["Microsoft 365<br/>Email, Files, Teams"]
        website["Your Website<br/>Cloudflare Pages"]
        internet["General Internet"]
    end

    team --> warp
    warp --> zt
    zt --> dns
    dns --> services`,
  },
  {
    name: 'password-vault-decision',
    source: `flowchart LR
    Start([Priority?]) --> Q1{Security first?}
    Q1 -->|Yes| CB[Codebook]
    Q1 -->|No| Q2{Best UX?}
    Q2 -->|Yes| 1P[1Password]
    Q2 -->|No| Q3{Budget?}
    Q3 -->|Yes| BW[Bitwarden]
    Q3 -->|No| Q4{Apple only?}
    Q4 -->|Yes| AP[Apple Passwords]
    Q4 -->|No| BW`,
  },
  {
    name: 'password-vault-decision-ja',
    source: `flowchart TD
    Start([何を最も重視しますか?]) --> Q1{最大限のセキュリティ?}
    Q1 -->|はい| Codebook[推奨: Codebook]
    Q1 -->|いいえ| Q2{最高のユーザー体験?}
    Q2 -->|はい| 1Password[推奨: 1Password]
    Q2 -->|いいえ| Q3{予算優先?}
    Q3 -->|はい| Bitwarden[推奨: Bitwarden]
    Q3 -->|いいえ| Q4{Apple製品のみの組織?}
    Q4 -->|はい| Apple[推奨: Appleパスワード]
    Q4 -->|いいえ| Bitwarden

    Codebook --> Note1[/"トレードオフ: 自動入力がやや手間"/]
    1Password --> Note2[/"トレードオフ: 高コスト、無料プランなし"/]
    Bitwarden --> Note3[/"トレードオフ: UIが洗練されていない"/]
    Apple --> Note4[/"トレードオフ: Appleエコシステムのみ"/]`,
  },
];

/**
 * Preprocess Mermaid source for beautiful-mermaid compatibility.
 * Strips quotes, replaces <br/>, converts unsupported shapes.
 */
function preprocessForBeautiful(source) {
  return source
    .replace(/\["([^"]*?)"\]/g, '[$1]')
    .replace(/\|"([^"]*?)"\|/g, '|$1|')
    .replace(/\[\/"([^"]*?)"\/\]/g, '[$1]')
    .replace(/\[\/([^\]]*?)\/\]/g, '[$1]')
    .replace(/<br\s*\/?>/g, ' ');
}

/**
 * Pad CJK labels so the layout engine allocates correct widths.
 * Each CJK char takes ~1.7x the width of a Latin char, so we replace each
 * CJK char with itself + a Latin padding suffix. The padding text will be
 * removed from the SVG after rendering.
 *
 * Strategy: for each label with CJK characters, create a width-equivalent
 * all-Latin placeholder that the layout engine sizes correctly, then swap
 * the real text back in the SVG.
 */
function padCjkLabels(source) {
  const textMap = new Map(); // placeholder → original text
  let counter = 0;

  // Generate a Latin placeholder string that has equivalent width to the given text.
  // beautiful-mermaid uses ~7.5px per character. CJK chars are ~13px each.
  // So each CJK char needs ~1.73 Latin chars worth of space.
  function makeWidthPlaceholder(text) {
    let latinEquivLen = 0;
    for (const ch of text) {
      if (CJK_RE.test(ch)) {
        latinEquivLen += 1.75; // CJK char ≈ 1.75 Latin chars wide
      } else {
        latinEquivLen += 1;
      }
    }
    // Build a placeholder of the right length using uppercase to avoid Mermaid keyword collisions
    const len = Math.ceil(latinEquivLen);
    const id = `PH${String(counter++).padStart(3, '0')}`;
    // Use a mix of letters that won't be mistaken for Mermaid syntax
    const filler = 'M'.repeat(len);
    return `${id}${filler}`.substring(0, len);
  }

  // Replace labels in node definitions: [text], {text}, ([text])
  // Only replace if the label contains CJK characters
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
 * Finds placeholder strings in <text> elements and swaps them back.
 */
function restoreCjkText(svg, textMap) {
  let result = svg;
  for (const [placeholder, original] of textMap) {
    // Replace in text element content
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

// mmdc config and CSS paths
const repoRoot = join(__dirname, '..', '..', '..', '..');
const mmdcConfig = join(repoRoot, 'scripts/mermaid-config.json');
const mmdcCss = join(repoRoot, 'scripts/mermaid-styles.css');

/**
 * Full beautiful-mermaid render pipeline:
 * 1. Strip quotes/br/trapezoids
 * 2. Pad CJK labels with width-equivalent Latin placeholders
 * 3. Render (layout engine gets correct widths)
 * 4. Smooth polylines into curves
 * 5. Restore original CJK text
 */
async function renderBeautiful(source, theme) {
  let processed = preprocessForBeautiful(source);
  const { source: padded, textMap } = padCjkLabels(processed);
  let svg = await renderMermaid(padded, theme);
  svg = smoothPolylines(svg);
  svg = restoreCjkText(svg, textMap);
  return svg;
}

async function renderWithBeautifulMermaid(name, source) {
  console.log(`  [beautiful-mermaid] Rendering ${name}...`);
  const start = performance.now();
  try {
    const svg = await renderBeautiful(source, esoliaThemeTransparent);
    const elapsed = (performance.now() - start).toFixed(0);
    const outPath = join(outDir, `${name}_beautiful.svg`);
    writeFileSync(outPath, svg);
    console.log(`    ✓ ${elapsed}ms → ${outPath}`);
    return true;
  } catch (err) {
    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`    ✗ ${elapsed}ms — Error: ${err.message}`);
    return false;
  }
}

function renderWithMmdc(name, source) {
  console.log(`  [mmdc] Rendering ${name}...`);
  const tempInput = join(outDir, `${name}.mmd`);
  const outPath = join(outDir, `${name}_mmdc.svg`);
  writeFileSync(tempInput, source);

  const start = performance.now();
  try {
    execSync(
      `npx mmdc -i "${tempInput}" -o "${outPath}" -c "${mmdcConfig}" -C "${mmdcCss}" -b transparent`,
      { stdio: 'pipe' }
    );
    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`    ✓ ${elapsed}ms → ${outPath}`);
    execSync(`rm -f "${tempInput}"`);
    return true;
  } catch (err) {
    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`    ✗ ${elapsed}ms — Error: ${err.message?.substring(0, 200)}`);
    return false;
  }
}

async function renderThemeShowcase(source) {
  const themeNames = ['github-light', 'tokyo-night', 'nord-light', 'catppuccin-latte'];
  console.log(`\n  [beautiful-mermaid] Theme showcase (cloudflare-security-layers)...`);
  for (const themeName of themeNames) {
    try {
      const svg = await renderBeautiful(source, { ...THEMES[themeName], transparent: false });
      const outPath = join(outDir, `theme_${themeName}.svg`);
      writeFileSync(outPath, svg);
      console.log(`    ✓ ${themeName} → ${outPath}`);
    } catch (err) {
      console.log(`    ✗ ${themeName} — Error: ${err.message}`);
    }
  }
}

async function main() {
  console.log('=== beautiful-mermaid vs mmdc comparison ===\n');

  let bmSuccess = 0;
  let mmdcSuccess = 0;

  for (const { name, source } of diagrams) {
    console.log(`\n--- ${name} ---`);
    if (await renderWithBeautifulMermaid(name, source)) bmSuccess++;
    if (renderWithMmdc(name, source)) mmdcSuccess++;
  }

  // Theme showcase
  await renderThemeShowcase(diagrams[1].source);

  // eSolia theme with white bg
  console.log(`\n  [beautiful-mermaid] eSolia theme (white bg)...`);
  const svg = await renderBeautiful(diagrams[1].source, esoliaTheme);
  writeFileSync(join(outDir, 'esolia_theme_white.svg'), svg);
  console.log(`    ✓ → output/esolia_theme_white.svg`);

  console.log(`\n=== Results ===`);
  console.log(`beautiful-mermaid: ${bmSuccess}/${diagrams.length} succeeded`);
  console.log(`mmdc:              ${mmdcSuccess}/${diagrams.length} succeeded`);
  console.log(`\nOutput directory: ${outDir}`);
  console.log(`Compare visually by opening the SVGs in a browser.`);
}

main().catch(console.error);
