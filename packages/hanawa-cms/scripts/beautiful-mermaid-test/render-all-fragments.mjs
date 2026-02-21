/**
 * Render ALL diagram fragment SVGs with resolved CSS variables.
 * Upload to R2 with new keys, then update D1 references.
 */

import { renderMermaid } from 'beautiful-mermaid';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(__dirname, 'output', 'all-fragments'), { recursive: true });

const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

const theme = {
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
    .replace(/%%\{init:.*?\}%%\n?/gs, '') // strip init directives
    .replace(/\["([^"]*?)"\]/g, '[$1]') // quoted node labels
    .replace(/\|"([^"]*?)"\|/g, '|$1|') // quoted edge labels
    .replace(/\[\/\"([^"]*?)\"\/\]/g, '[$1]') // trapezoid with quotes
    .replace(/\[\/([^\]]*?)\/\]/g, '[$1]') // trapezoid without quotes
    .replace(/<br\s*\/?>/g, ' ') // html line breaks
    .replace(/^\s*style\s+\w+\s+fill:.*$/gm, ''); // style directives
}

function padCjkLabels(source) {
  const textMap = new Map();
  let counter = 0;
  function makeWidthPlaceholder(text) {
    let latinEquivLen = 0;
    for (const ch of text) {
      latinEquivLen += CJK_RE.test(ch) ? 1.75 : 1;
    }
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
    const segments = [`M${points[0].x},${points[0].y}`];
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1],
        curr = points[i],
        next = points[i + 1];
      const dxP = prev.x - curr.x,
        dyP = prev.y - curr.y;
      const dxN = next.x - curr.x,
        dyN = next.y - curr.y;
      const dP = Math.sqrt(dxP * dxP + dyP * dyP);
      const dN = Math.sqrt(dxN * dxN + dyN * dyN);
      const r = Math.min(radius, dP / 2, dN / 2);
      segments.push(`L${curr.x + (dxP / dP) * r},${curr.y + (dyP / dP) * r}`);
      segments.push(`Q${curr.x},${curr.y} ${curr.x + (dxN / dN) * r},${curr.y + (dyN / dN) * r}`);
    }
    segments.push(`L${points[points.length - 1].x},${points[points.length - 1].y}`);
    return `<path d="${segments.join(' ')}"${attrs}/>`;
  });
}

function resolveVariables(svg) {
  const { bg, fg, accent, line, muted, surface, border } = theme;
  const vars = {
    '--bg': bg,
    '--fg': fg,
    '--line': line,
    '--accent': accent,
    '--muted': muted,
    '--surface': surface,
    '--border': border,
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

// All diagram fragments to render
const fragments = [
  {
    id: 'cloudflare-security-layers',
    en: {
      newKey: 'diagrams/cloudflare-security-layers-en.svg',
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
        m365["Microsoft 365 Email, Files, Teams"]
        website["Your Website Cloudflare Pages"]
        internet["General Internet"]
    end
    team --> warp
    warp --> zt
    zt --> dns
    dns --> services`,
    },
    ja: {
      newKey: 'diagrams/cloudflare-security-layers-ja.svg',
      source: `flowchart TB
    subgraph team["チーム"]
        laptop["ノートPC"]
        phone["スマートフォン"]
        tablet["タブレット"]
    end
    subgraph cloudflare["Cloudflare セキュリティ層"]
        zt["Zero Trust Gateway"]
        dns["セキュアDNS"]
        warp["暗号化トンネル"]
    end
    subgraph services["保護されたサービス"]
        m365["Microsoft 365 メール、ファイル、Teams"]
        website["御社のウェブサイト Cloudflare Pages"]
        internet["一般インターネット"]
    end
    team --> warp
    warp --> zt
    zt --> dns
    dns --> services`,
    },
  },
  {
    id: 'password-vault-master-password',
    en: {
      oldKey: 'diagrams/mermaid-1769672520449-3rqw4k.svg',
      newKey: 'diagrams/pw-vault-master-password-en.svg',
      source: `flowchart TB
    MP["🔑 User Memorizes ONE Master Password"]
    subgraph Vault["🔒 Vault"]
        P1["🌐 Website kX9#mP2$..."] --- P2["📧 Mail jR4!wT7*..."] --- P3["🏦 Banking yH2#cK8$..."]
        P4["🔢 OTP 847 291"] --- P5["📝 Note API keys"]
        P2 ~~~ P4
    end
    MP -->|"Decrypts"| Vault`,
    },
    ja: {
      oldKey: 'diagrams/mermaid-1769672524049-anzhfi.svg',
      newKey: 'diagrams/pw-vault-master-password-ja.svg',
      source: `flowchart TB
    MP["🔑 ユーザーが暗記する 唯一マスターパスワード"]
    subgraph Vault["🔒 ボールト"]
        P1["🌐 サイト kX9#mP2$..."] --- P2["📧 メール jR4!wT7*..."] --- P3["🏦 銀行 yH2#cK8$..."]
        P4["🔢 OTP 847 291"] --- P5["📝 ノート APIキー"]
        P2 ~~~ P4
    end
    MP -->|"復号化"| Vault`,
    },
  },
  {
    id: 'password-vault-architecture-comparison',
    en: {
      oldKey: 'diagrams/mermaid-1769671993802-h9ohsu.svg',
      newKey: 'diagrams/pw-vault-arch-comparison-en.svg',
      source: `flowchart LR
    subgraph SF["Security-First"]
        direction TB
        A1[Encrypted Vault] --> A2[Native App Only]
        A2 --> A3[Decryption on Device]
        A3 --> A4[Smaller Attack Surface]
    end
    subgraph CF["Convenience-First"]
        direction TB
        B1[Encrypted Vault] --> B2[Native App] & B3[Browser Ext.] & B4[Web Vault]
        B2 & B3 & B4 --> B5[Multiple Decryption Points]
        B5 --> B6[Larger Attack Surface]
    end
    SF -.->|"Trade-off"| CF`,
    },
    ja: {
      oldKey: 'diagrams/mermaid-1769671998841-04fn5d.svg',
      newKey: 'diagrams/pw-vault-arch-comparison-ja.svg',
      source: `flowchart LR
    subgraph SF["セキュリティ優先"]
        direction TB
        A1[暗号化された保管庫] --> A2[ネイティブアプリのみ]
        A2 --> A3[デバイス上で復号]
        A3 --> A4[攻撃対象領域が小さい]
    end
    subgraph CF["利便性優先"]
        direction TB
        B1[暗号化された保管庫] --> B2[ネイティブアプリ] & B3[ブラウザ拡張] & B4[Webボールト]
        B2 & B3 & B4 --> B5[複数の復号ポイント]
        B5 --> B6[攻撃対象領域が大きい]
    end
    SF -.->|"トレードオフ"| CF`,
    },
  },
  {
    id: 'password-vault-cloud-sync',
    en: {
      oldKey: 'diagrams/mermaid-1769673863346-wj2o2s.svg',
      newKey: 'diagrams/pw-vault-cloud-sync-en.svg',
      source: `flowchart LR
    subgraph Traditional["Traditional Cloud Vault"]
        direction TB
        T1[Your Device] -->|Encrypted| T2[Cloud Server]
        T2 -->|Encrypted| T3[Web Browser]
        T2 -->|Encrypted| T5[Other Devices]
        T3 -->|Browser Decrypt| T4[View Passwords]
    end
    subgraph Sync["Zero-Knowledge"]
        direction TB
        S1[Your Device] -->|Encrypted| S2[Cloud Server]
        S2 -->|Encrypted| S3[Other Devices]
        S2 -.->|No Web Access| S4[Cannot View Online]
        S3 -->|Local Decrypt| S5[View Passwords]
    end
    Traditional ~~~ Sync`,
    },
    ja: {
      oldKey: 'diagrams/mermaid-1769673866839-h5tnsm.svg',
      newKey: 'diagrams/pw-vault-cloud-sync-ja.svg',
      source: `flowchart LR
    subgraph Traditional["従来型クラウドボールト"]
        direction TB
        T1[デバイス] -->|暗号化| T2[クラウドサーバー]
        T2 -->|暗号化| T3[Webブラウザ]
        T2 -->|暗号化| T5[他デバイス]
        T3 -->|ブラウザで復号| T4[パスワード表示]
    end
    subgraph Sync["同期専用 ゼロ知識"]
        direction TB
        S1[デバイス] -->|暗号化| S2[クラウドサーバー]
        S2 -->|暗号化| S3[他デバイス]
        S2 -.->|Web不可| S4[オンライン閲覧不可]
        S3 -->|ローカル復号| S5[パスワード表示]
    end
    Traditional ~~~ Sync`,
    },
  },
  {
    id: 'password-vault-attack-vectors',
    en: {
      oldKey: 'diagrams/mermaid-1769674503989-0umwvc.svg',
      newKey: 'diagrams/pw-vault-attack-vectors-en.svg',
      source: `flowchart LR
    subgraph Attacks["Attack Vectors"]
        direction TB
        A1["🌐 Browser Vulnerabilities"]
        A2["🧩 Extension Exploits"]
        A3["☁️ Web Vault / Server Risks"]
    end
    Attacks -->|"All 3 apply ⚠️"| T["1Password / Bitwarden"]
    Attacks -.->|"None apply ✅"| C["Codebook"]`,
    },
    ja: {
      oldKey: 'diagrams/mermaid-1769674506389-a47yqi.svg',
      newKey: 'diagrams/pw-vault-attack-vectors-ja.svg',
      source: `flowchart LR
    subgraph Attacks["攻撃ベクトル"]
        direction TB
        A1["🌐 ブラウザの脆弱性"]
        A2["🧩 拡張機能の悪用"]
        A3["☁️ Webボールト/サーバーリスク"]
    end
    Attacks -->|"全て該当 ⚠️"| T["1Password / Bitwarden"]
    Attacks -.->|"該当なし ✅"| C["Codebook"]`,
    },
  },
  {
    id: 'password-vault-decision-framework',
    en: {
      oldKey: 'diagrams/mermaid-1769675976696-airai2.svg',
      newKey: 'diagrams/pw-vault-decision-framework-en.svg',
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
    ja: {
      oldKey: 'diagrams/mermaid-1769675980027-osca5y.svg',
      newKey: 'diagrams/pw-vault-decision-framework-ja.svg',
      source: `flowchart LR
    Start([何を重視?]) --> Q1{セキュリティ重視?}
    Q1 -->|はい| CB[Codebook]
    Q1 -->|いいえ| Q2{最高のUX?}
    Q2 -->|はい| 1P[1Password]
    Q2 -->|いいえ| Q3{予算優先?}
    Q3 -->|はい| BW[Bitwarden]
    Q3 -->|いいえ| Q4{Apple製品のみ?}
    Q4 -->|はい| AP[Appleパスワード]
    Q4 -->|いいえ| BW`,
    },
  },
  {
    id: 'password-vault-convenience-layer',
    en: {
      oldKey: 'diagrams/mermaid-1769675102551-s7q6oy.svg',
      newKey: 'diagrams/pw-vault-convenience-layer-en.svg',
      source: `flowchart TB
    subgraph Source["Single Truth Source"]
        S1["Primary Password Manager (e.g., Codebook)"]
        S2["All credentials"] & S3["TOTP"] & S4["Secure notes"] & S5["Backups"]
        S1 --- S2 & S3 & S4 & S5
    end
    subgraph Copy["Copy High Frequency Credentials as Needed"]
        _["  "]
    end
    subgraph Conv["Convenience Layer"]
        V1["Apple Passwords / Browser Autofill"]
        V2["5-10 daily logins"] & V3["Face/Touch ID"] & V4["Speed only"]
        V1 --- V2 & V3 & V4
    end
    Source --> Copy --> Conv`,
    },
    ja: {
      oldKey: 'diagrams/mermaid-1769675099760-3h2h6w.svg',
      newKey: 'diagrams/pw-vault-convenience-layer-ja.svg',
      source: `flowchart TB
    subgraph Source["唯一の正式ソース"]
        S1["プライマリパスワードマネージャー（例: Codebook）"]
        S2["全認証情報"] & S3["TOTP"] & S4["セキュアノート"] & S5["バックアップ"]
        S1 --- S2 & S3 & S4 & S5
    end
    subgraph Copy["必要に応じて高頻度の認証情報のみコピー"]
        _["  "]
    end
    subgraph Conv["コンビニエンスレイヤー"]
        V1["Appleパスワード / ブラウザ自動入力"]
        V2["日常使う5-10個"] & V3["Face/Touch ID"] & V4["スピード優先"]
        V1 --- V2 & V3 & V4
    end
    Source --> Copy --> Conv`,
    },
  },
];

async function main() {
  const results = [];

  for (const fragment of fragments) {
    for (const lang of ['en', 'ja']) {
      const { newKey, source } = fragment[lang];
      const label = `${fragment.id} [${lang}]`;
      console.log(`Rendering ${label}...`);
      try {
        const svg = await renderFull(source);
        const varCount = (svg.match(/var\(--/g) || []).length;
        const hasStyle = svg.includes('<style>');
        console.log(`  var(): ${varCount}, <style>: ${hasStyle}`);

        const filename = newKey.replace('diagrams/', '');
        const outPath = join(__dirname, 'output', 'all-fragments', filename);
        writeFileSync(outPath, svg);
        console.log(`  → ${outPath}`);

        results.push({ id: fragment.id, lang, newKey, success: true });
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        results.push({ id: fragment.id, lang, newKey, success: false, error: err.message });
      }
    }
  }

  console.log('\n=== RESULTS ===');
  for (const r of results) {
    console.log(
      `${r.success ? '✓' : '✗'} ${r.id} [${r.lang}] → ${r.newKey}${r.error ? ' ERROR: ' + r.error : ''}`
    );
  }
}

main().catch(console.error);
