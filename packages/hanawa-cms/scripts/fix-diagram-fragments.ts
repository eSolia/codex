#!/usr/bin/env npx tsx
/**
 * Fix diagram fragments:
 * 1. Rename IDs to remove -ja suffix
 * 2. Create bilingual SVGs (EN and JA versions)
 * 3. Reference correct SVG path in each language content
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createMermaidHtml(mermaidSource: string, svgPath: string): string {
  const escapedSource = escapeHtmlAttr(mermaidSource.trim());
  return `<div data-type="mermaidBlock" data-source="${escapedSource}" data-svg-path="${svgPath}" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="${svgPath}" alt="Mermaid diagram" /></div></div>`;
}

function renderMermaidToSvg(mermaidSource: string, outputPath: string): boolean {
  const tempDir = '/tmp/mermaid-temp';
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const tempInput = join(tempDir, 'diagram.mmd');
  writeFileSync(tempInput, mermaidSource, 'utf-8');

  const configPath = '/Users/rcogley/dev/codex/scripts/mermaid-config.json';
  const cssPath = '/Users/rcogley/dev/codex/scripts/mermaid-styles.css';

  try {
    const cmd = `npx mmdc -i "${tempInput}" -o "${outputPath}" -c "${configPath}" -C "${cssPath}" -b transparent`;
    execSync(cmd, { stdio: 'pipe' });
    return existsSync(outputPath);
  } catch (err) {
    console.error(`  Error rendering: ${err}`);
    return false;
  }
}

// Bilingual diagram definitions - new IDs without -ja
const diagrams: Record<string, { name: string; en: string; ja: string }> = {
  'password-vault-master-password': {
    name: 'Master Password Concept',
    en: `flowchart TB
    subgraph You[" "]
        direction TB
        Y_Title["<b>You</b>"]
        MP["🔑 Master Password<br/><i>The ONE password you remember</i>"]
        Y_Title ~~~ MP
    end

    subgraph Vault[" "]
        direction TB
        V_Title["<b>🔒 Encrypted Vault</b>"]
        V_Sub["<i>Protected by your master password</i>"]
        P1["🌐 Website Logins<br/><code>kX9#mP2$vL5@nQ8&</code>"]
        P2["📧 Email Accounts<br/><code>jR4!wT7*bN3@qM6</code>"]
        P3["🏦 Banking & Finance<br/><code>yH2#cK8$pL1@xZ5</code>"]
        P4["🔢 TOTP Codes<br/><code>847 291</code>"]
        P5["📝 Secure Notes<br/><i>API keys, recovery codes...</i>"]
        V_Title ~~~ V_Sub
        V_Sub ~~~ P1
    end

    MP -->|"Unlocks"| Vault`,
    ja: `flowchart TB
    subgraph You[" "]
        direction TB
        Y_Title["<b>あなた</b>"]
        MP["🔑 マスターパスワード<br/><i>覚える必要があるたった1つのパスワード</i>"]
        Y_Title ~~~ MP
    end

    subgraph Vault[" "]
        direction TB
        V_Title["<b>🔒 暗号化されたボールト</b>"]
        V_Sub["<i>マスターパスワードで保護</i>"]
        P1["🌐 ウェブサイトログイン<br/><code>kX9#mP2$vL5@nQ8&</code>"]
        P2["📧 メールアカウント<br/><code>jR4!wT7*bN3@qM6</code>"]
        P3["🏦 銀行・金融<br/><code>yH2#cK8$pL1@xZ5</code>"]
        P4["🔢 TOTPコード<br/><code>847 291</code>"]
        P5["📝 セキュアノート<br/><i>APIキー、リカバリーコード...</i>"]
        V_Title ~~~ V_Sub
        V_Sub ~~~ P1
    end

    MP -->|"解錠"| Vault`,
  },

  'password-vault-architecture-comparison': {
    name: 'Security-First vs Convenience-First Architecture',
    en: `flowchart TD
    subgraph SF[" "]
        direction TB
        SF_Title["<b>Security-First Approach</b>"]
        A1[Encrypted Vault] --> A2[Native App Only]
        A2 --> A3[Decryption on Device]
        A3 --> A4[Smaller Attack Surface]
        SF_Title ~~~ A1
    end

    subgraph CF[" "]
        direction TB
        CF_Title["<b>Convenience-First Approach</b>"]
        B1[Encrypted Vault] --> B2[Native App]
        B1 --> B3[Browser Extension]
        B1 --> B4[Web Vault]
        B2 --> B5[Multiple Decryption Points]
        B3 --> B5
        B4 --> B5
        B5 --> B6[Larger Attack Surface]
        CF_Title ~~~ B1
    end

    SF -.->|"Trade-off"| CF`,
    ja: `flowchart TD
    subgraph SF[" "]
        direction TB
        SF_Title["<b>セキュリティ優先アプローチ</b>"]
        A1[暗号化された保管庫] --> A2[ネイティブアプリのみ]
        A2 --> A3[デバイス上で復号]
        A3 --> A4[攻撃対象領域が小さい]
        SF_Title ~~~ A1
    end

    subgraph CF[" "]
        direction TB
        CF_Title["<b>利便性優先アプローチ</b>"]
        B1[暗号化された保管庫] --> B2[ネイティブアプリ]
        B1 --> B3[ブラウザ拡張機能]
        B1 --> B4[Webボールト]
        B2 --> B5[複数の復号ポイント]
        B3 --> B5
        B4 --> B5
        B5 --> B6[攻撃対象領域が大きい]
        CF_Title ~~~ B1
    end

    SF -.->|"トレードオフ"| CF`,
  },

  'password-vault-cloud-sync': {
    name: 'Cloud Sync Comparison',
    en: `flowchart LR
    subgraph Traditional[" "]
        direction TB
        T_Title["<b>Traditional Cloud Vault</b>"]
        T1[Your Device] -->|"Encrypted Data"| T2[Cloud Server]
        T2 -->|"Encrypted Data"| T3[Web Browser]
        T3 -->|"Decrypt in Browser"| T4[View Passwords]
        T2 -->|"Encrypted Data"| T5[Other Devices]
        T_Title ~~~ T1
    end

    subgraph SyncOnly[" "]
        direction TB
        S_Title["<b>Sync-Only Cloud<br/>True Zero-Knowledge</b>"]
        S1[Your Device] -->|"Encrypted Data"| S2[Cloud Server]
        S2 -->|"Encrypted Data"| S3[Other Devices]
        S2 -.->|"No Web Access"| S4[/"Cannot View Online"/]
        S3 -->|"Decrypt Locally"| S5[View Passwords]
        S_Title ~~~ S1
    end`,
    ja: `flowchart LR
    subgraph Traditional[" "]
        direction TB
        T_Title["<b>従来型クラウドボールト</b>"]
        T1[お使いのデバイス] -->|"暗号化データ"| T2[クラウドサーバー]
        T2 -->|"暗号化データ"| T3[Webブラウザ]
        T3 -->|"ブラウザで復号"| T4[パスワード表示]
        T2 -->|"暗号化データ"| T5[他のデバイス]
        T_Title ~~~ T1
    end

    subgraph SyncOnly[" "]
        direction TB
        S_Title["<b>同期専用クラウド<br/>真のゼロ知識</b>"]
        S1[お使いのデバイス] -->|"暗号化データ"| S2[クラウドサーバー]
        S2 -->|"暗号化データ"| S3[他のデバイス]
        S2 -.->|"Webアクセス不可"| S4[/"オンラインで閲覧不可"/]
        S3 -->|"ローカルで復号"| S5[パスワード表示]
        S_Title ~~~ S1
    end`,
  },

  'password-vault-attack-vectors': {
    name: 'Security Architecture Comparison',
    en: `flowchart LR
    subgraph Vectors[" "]
        direction TB
        V_Title["<b>Attack Vectors</b>"]
        AV2["🌐 Browser Vulnerabilities"]
        AV3["🧩 Extension Exploits"]
        AV4["☁️ Web Vault / Server Risks"]
        V_Title ~~~ AV2
    end

    subgraph Codebook[" "]
        direction TB
        C_Title["<b>Codebook</b>"]
        C1["None of these apply"]
        C_Title ~~~ C1
    end

    subgraph Traditional[" "]
        direction TB
        T_Title["<b>1Password / Bitwarden</b>"]
        T2["🌐 Browser Vulnerabilities"]
        T3["🧩 Extension Exploits"]
        T4["☁️ Web Vault Risks"]
        T_Title ~~~ T2
    end

    Vectors --> Codebook
    Vectors --> Traditional`,
    ja: `flowchart LR
    subgraph Vectors[" "]
        direction TB
        V_Title["<b>攻撃ベクトル</b>"]
        AV2["🌐 ブラウザの脆弱性"]
        AV3["🧩 拡張機能の悪用"]
        AV4["☁️ Webボールト/サーバーリスク"]
        V_Title ~~~ AV2
    end

    subgraph Codebook[" "]
        direction TB
        C_Title["<b>Codebook</b>"]
        C1["これらは該当しない"]
        C_Title ~~~ C1
    end

    subgraph Traditional[" "]
        direction TB
        T_Title["<b>1Password / Bitwarden</b>"]
        T2["🌐 ブラウザの脆弱性"]
        T3["🧩 拡張機能の悪用"]
        T4["☁️ Webボールトリスク"]
        T_Title ~~~ T2
    end

    Vectors --> Codebook
    Vectors --> Traditional`,
  },

  'password-vault-decision-framework': {
    name: 'Password Manager Decision Framework',
    en: `flowchart TD
    Start([What matters most?]) --> Q1{Maximum Security?}
    Q1 -->|Yes| Codebook[Recommend: Codebook]
    Q1 -->|No| Q2{Best User Experience?}
    Q2 -->|Yes| 1Password[Recommend: 1Password]
    Q2 -->|No| Q3{Budget Priority?}
    Q3 -->|Yes| Bitwarden[Recommend: Bitwarden]
    Q3 -->|No| Q4{Apple-Only Org?}
    Q4 -->|Yes| Apple[Recommend: Apple Passwords]
    Q4 -->|No| Bitwarden

    Codebook --> Note1[/"Trade-off: Less seamless autofill"/]
    1Password --> Note2[/"Trade-off: Higher cost, no free tier"/]
    Bitwarden --> Note3[/"Trade-off: Less polished UI"/]
    Apple --> Note4[/"Trade-off: Apple ecosystem only"/]`,
    ja: `flowchart TD
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

  'password-vault-convenience-layer': {
    name: 'Convenience Layer Pattern',
    en: `flowchart TB
    subgraph Source[" "]
        direction TB
        Source_Title["<b>Single Source of Truth</b>"]
        S1["Primary Password Manager<br/>(e.g., Codebook)"]
        S2["All credentials stored here"]
        S3["TOTP codes"]
        S4["Secure notes & sensitive data"]
        S5["Export/backup control"]
        Source_Title ~~~ S1
        S1 --- S2
        S1 --- S3
        S1 --- S4
        S1 --- S5
    end

    subgraph Copy[" "]
        direction TB
        Copy_Title["<b>Copy as needed</b>"]
        C1["Select high-frequency<br/>credentials only"]
        Copy_Title ~~~ C1
    end

    subgraph Conv[" "]
        direction TB
        Conv_Title["<b>Convenience Layer</b>"]
        V1["Apple Passwords or<br/>Browser Autofill"]
        V2["5-10 daily-use logins"]
        V3["Face ID / Touch ID autofill"]
        V4["Not authoritative—<br/>just for speed"]
        Conv_Title ~~~ V1
        V1 --- V2
        V1 --- V3
        V1 --- V4
    end

    Source --> Copy
    Copy --> Conv`,
    ja: `flowchart TB
    subgraph Source[" "]
        direction TB
        Source_Title["<b>唯一の正式ソース</b>"]
        S1["プライマリパスワードマネージャー<br/>（例: Codebook）"]
        S2["すべての認証情報を保存"]
        S3["TOTPコード"]
        S4["セキュアノート・機密データ"]
        S5["エクスポート/バックアップ管理"]
        Source_Title ~~~ S1
        S1 --- S2
        S1 --- S3
        S1 --- S4
        S1 --- S5
    end

    subgraph Copy[" "]
        direction TB
        Copy_Title["<b>必要に応じてコピー</b>"]
        C1["高頻度の認証情報のみ<br/>選択してコピー"]
        Copy_Title ~~~ C1
    end

    subgraph Conv[" "]
        direction TB
        Conv_Title["<b>コンビニエンスレイヤー</b>"]
        V1["Appleパスワード または<br/>ブラウザ自動入力"]
        V2["日常的に使う5-10個のログイン"]
        V3["Face ID / Touch ID 自動入力"]
        V4["正式ではない—<br/>スピードのためだけ"]
        Conv_Title ~~~ V1
        V1 --- V2
        V1 --- V3
        V1 --- V4
    end

    Source --> Copy
    Copy --> Conv`,
  },
};

async function main() {
  const outputDir = '/Users/rcogley/dev/codex/packages/hanawa-cms/static/diagrams';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const sqlStatements: string[] = [
    '-- Fix Password Vault Diagram Fragments',
    '-- 1. Delete old -ja fragments',
    '-- 2. Insert new fragments with clean IDs and bilingual SVGs',
    '-- Generated: ' + new Date().toISOString(),
    '',
    '-- Delete old fragments with -ja suffix',
    "DELETE FROM fragments WHERE id LIKE 'password-vault-%-ja' AND category = 'diagrams';",
    '',
  ];

  const svgsToUpload: { local: string; remote: string }[] = [];

  for (const [id, data] of Object.entries(diagrams)) {
    console.log(`\nProcessing ${id}...`);

    // Render English SVG
    const svgEnPath = join(outputDir, `${id}-en.svg`);
    console.log(`  Rendering English SVG...`);
    if (renderMermaidToSvg(data.en, svgEnPath)) {
      console.log(`  ✓ English SVG created`);
      svgsToUpload.push({ local: svgEnPath, remote: `diagrams/${id}-en.svg` });
    }

    // Render Japanese SVG
    const svgJaPath = join(outputDir, `${id}-ja.svg`);
    console.log(`  Rendering Japanese SVG...`);
    if (renderMermaidToSvg(data.ja, svgJaPath)) {
      console.log(`  ✓ Japanese SVG created`);
      svgsToUpload.push({ local: svgJaPath, remote: `diagrams/${id}-ja.svg` });
    }

    // Create content with language-specific SVG paths
    const contentEn = createMermaidHtml(data.en, `diagrams/${id}-en.svg`);
    const contentJa = createMermaidHtml(data.ja, `diagrams/${id}-ja.svg`);

    const sql = `INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  '${escapeSQL(id)}',
  '${escapeSQL(data.name)}',
  '${escapeSQL(id)}',
  'diagrams',
  'mermaid',
  '${escapeSQL(contentEn)}',
  '${escapeSQL(contentJa)}',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);`;

    sqlStatements.push(sql);
    sqlStatements.push('');
  }

  const outputPath = 'scripts/fix-diagram-fragments.sql';
  writeFileSync(outputPath, sqlStatements.join('\n'), 'utf-8');
  console.log(`\n✓ SQL written to: ${outputPath}`);

  // Write upload script
  const uploadScript = svgsToUpload
    .map((s) => `npx wrangler r2 object put "codex/${s.remote}" --file="${s.local}" --remote`)
    .join('\n');
  writeFileSync('scripts/upload-diagram-svgs.sh', uploadScript, 'utf-8');
  console.log(`✓ Upload script written to: scripts/upload-diagram-svgs.sh`);

  console.log(`\nTo apply:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --local --file=scripts/fix-diagram-fragments.sql`
  );
  console.log(
    `  npx wrangler d1 execute hanawa-db --remote --file=scripts/fix-diagram-fragments.sql`
  );
  console.log(`  bash scripts/upload-diagram-svgs.sh`);
}

main().catch(console.error);
