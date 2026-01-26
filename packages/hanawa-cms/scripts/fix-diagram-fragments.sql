-- Fix Password Vault Diagram Fragments
-- 1. Delete old -ja fragments
-- 2. Insert new fragments with clean IDs and bilingual SVGs
-- Generated: 2026-01-26T21:07:40.715Z

-- Delete old fragments with -ja suffix
DELETE FROM fragments WHERE id LIKE 'password-vault-%-ja' AND category = 'diagrams';

INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-master-password',
  'Master Password Concept',
  'password-vault-master-password',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="flowchart TB
    subgraph You[&quot; &quot;]
        direction TB
        Y_Title[&quot;&lt;b&gt;You&lt;/b&gt;&quot;]
        MP[&quot;🔑 Master Password&lt;br/&gt;&lt;i&gt;The ONE password you remember&lt;/i&gt;&quot;]
        Y_Title ~~~ MP
    end

    subgraph Vault[&quot; &quot;]
        direction TB
        V_Title[&quot;&lt;b&gt;🔒 Encrypted Vault&lt;/b&gt;&quot;]
        V_Sub[&quot;&lt;i&gt;Protected by your master password&lt;/i&gt;&quot;]
        P1[&quot;🌐 Website Logins&lt;br/&gt;&lt;code&gt;kX9#mP2$vL5@nQ8&amp;&lt;/code&gt;&quot;]
        P2[&quot;📧 Email Accounts&lt;br/&gt;&lt;code&gt;jR4!wT7*bN3@qM6&lt;/code&gt;&quot;]
        P3[&quot;🏦 Banking &amp; Finance&lt;br/&gt;&lt;code&gt;yH2#cK8$pL1@xZ5&lt;/code&gt;&quot;]
        P4[&quot;🔢 TOTP Codes&lt;br/&gt;&lt;code&gt;847 291&lt;/code&gt;&quot;]
        P5[&quot;📝 Secure Notes&lt;br/&gt;&lt;i&gt;API keys, recovery codes...&lt;/i&gt;&quot;]
        V_Title ~~~ V_Sub
        V_Sub ~~~ P1
    end

    MP --&gt;|&quot;Unlocks&quot;| Vault" data-svg-path="diagrams/password-vault-master-password-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-master-password-en.svg" alt="Mermaid diagram" /></div></div>',
  '<div data-type="mermaidBlock" data-source="flowchart TB
    subgraph You[&quot; &quot;]
        direction TB
        Y_Title[&quot;&lt;b&gt;あなた&lt;/b&gt;&quot;]
        MP[&quot;🔑 マスターパスワード&lt;br/&gt;&lt;i&gt;覚える必要があるたった1つのパスワード&lt;/i&gt;&quot;]
        Y_Title ~~~ MP
    end

    subgraph Vault[&quot; &quot;]
        direction TB
        V_Title[&quot;&lt;b&gt;🔒 暗号化されたボールト&lt;/b&gt;&quot;]
        V_Sub[&quot;&lt;i&gt;マスターパスワードで保護&lt;/i&gt;&quot;]
        P1[&quot;🌐 ウェブサイトログイン&lt;br/&gt;&lt;code&gt;kX9#mP2$vL5@nQ8&amp;&lt;/code&gt;&quot;]
        P2[&quot;📧 メールアカウント&lt;br/&gt;&lt;code&gt;jR4!wT7*bN3@qM6&lt;/code&gt;&quot;]
        P3[&quot;🏦 銀行・金融&lt;br/&gt;&lt;code&gt;yH2#cK8$pL1@xZ5&lt;/code&gt;&quot;]
        P4[&quot;🔢 TOTPコード&lt;br/&gt;&lt;code&gt;847 291&lt;/code&gt;&quot;]
        P5[&quot;📝 セキュアノート&lt;br/&gt;&lt;i&gt;APIキー、リカバリーコード...&lt;/i&gt;&quot;]
        V_Title ~~~ V_Sub
        V_Sub ~~~ P1
    end

    MP --&gt;|&quot;解錠&quot;| Vault" data-svg-path="diagrams/password-vault-master-password-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-master-password-ja.svg" alt="Mermaid diagram" /></div></div>',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-architecture-comparison',
  'Security-First vs Convenience-First Architecture',
  'password-vault-architecture-comparison',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="flowchart TD
    subgraph SF[&quot; &quot;]
        direction TB
        SF_Title[&quot;&lt;b&gt;Security-First Approach&lt;/b&gt;&quot;]
        A1[Encrypted Vault] --&gt; A2[Native App Only]
        A2 --&gt; A3[Decryption on Device]
        A3 --&gt; A4[Smaller Attack Surface]
        SF_Title ~~~ A1
    end

    subgraph CF[&quot; &quot;]
        direction TB
        CF_Title[&quot;&lt;b&gt;Convenience-First Approach&lt;/b&gt;&quot;]
        B1[Encrypted Vault] --&gt; B2[Native App]
        B1 --&gt; B3[Browser Extension]
        B1 --&gt; B4[Web Vault]
        B2 --&gt; B5[Multiple Decryption Points]
        B3 --&gt; B5
        B4 --&gt; B5
        B5 --&gt; B6[Larger Attack Surface]
        CF_Title ~~~ B1
    end

    SF -.-&gt;|&quot;Trade-off&quot;| CF" data-svg-path="diagrams/password-vault-architecture-comparison-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-architecture-comparison-en.svg" alt="Mermaid diagram" /></div></div>',
  '<div data-type="mermaidBlock" data-source="flowchart TD
    subgraph SF[&quot; &quot;]
        direction TB
        SF_Title[&quot;&lt;b&gt;セキュリティ優先アプローチ&lt;/b&gt;&quot;]
        A1[暗号化された保管庫] --&gt; A2[ネイティブアプリのみ]
        A2 --&gt; A3[デバイス上で復号]
        A3 --&gt; A4[攻撃対象領域が小さい]
        SF_Title ~~~ A1
    end

    subgraph CF[&quot; &quot;]
        direction TB
        CF_Title[&quot;&lt;b&gt;利便性優先アプローチ&lt;/b&gt;&quot;]
        B1[暗号化された保管庫] --&gt; B2[ネイティブアプリ]
        B1 --&gt; B3[ブラウザ拡張機能]
        B1 --&gt; B4[Webボールト]
        B2 --&gt; B5[複数の復号ポイント]
        B3 --&gt; B5
        B4 --&gt; B5
        B5 --&gt; B6[攻撃対象領域が大きい]
        CF_Title ~~~ B1
    end

    SF -.-&gt;|&quot;トレードオフ&quot;| CF" data-svg-path="diagrams/password-vault-architecture-comparison-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-architecture-comparison-ja.svg" alt="Mermaid diagram" /></div></div>',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-cloud-sync',
  'Cloud Sync Comparison',
  'password-vault-cloud-sync',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="flowchart LR
    subgraph Traditional[&quot; &quot;]
        direction TB
        T_Title[&quot;&lt;b&gt;Traditional Cloud Vault&lt;/b&gt;&quot;]
        T1[Your Device] --&gt;|&quot;Encrypted Data&quot;| T2[Cloud Server]
        T2 --&gt;|&quot;Encrypted Data&quot;| T3[Web Browser]
        T3 --&gt;|&quot;Decrypt in Browser&quot;| T4[View Passwords]
        T2 --&gt;|&quot;Encrypted Data&quot;| T5[Other Devices]
        T_Title ~~~ T1
    end

    subgraph SyncOnly[&quot; &quot;]
        direction TB
        S_Title[&quot;&lt;b&gt;Sync-Only Cloud&lt;br/&gt;True Zero-Knowledge&lt;/b&gt;&quot;]
        S1[Your Device] --&gt;|&quot;Encrypted Data&quot;| S2[Cloud Server]
        S2 --&gt;|&quot;Encrypted Data&quot;| S3[Other Devices]
        S2 -.-&gt;|&quot;No Web Access&quot;| S4[/&quot;Cannot View Online&quot;/]
        S3 --&gt;|&quot;Decrypt Locally&quot;| S5[View Passwords]
        S_Title ~~~ S1
    end" data-svg-path="diagrams/password-vault-cloud-sync-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-cloud-sync-en.svg" alt="Mermaid diagram" /></div></div>',
  '<div data-type="mermaidBlock" data-source="flowchart LR
    subgraph Traditional[&quot; &quot;]
        direction TB
        T_Title[&quot;&lt;b&gt;従来型クラウドボールト&lt;/b&gt;&quot;]
        T1[お使いのデバイス] --&gt;|&quot;暗号化データ&quot;| T2[クラウドサーバー]
        T2 --&gt;|&quot;暗号化データ&quot;| T3[Webブラウザ]
        T3 --&gt;|&quot;ブラウザで復号&quot;| T4[パスワード表示]
        T2 --&gt;|&quot;暗号化データ&quot;| T5[他のデバイス]
        T_Title ~~~ T1
    end

    subgraph SyncOnly[&quot; &quot;]
        direction TB
        S_Title[&quot;&lt;b&gt;同期専用クラウド&lt;br/&gt;真のゼロ知識&lt;/b&gt;&quot;]
        S1[お使いのデバイス] --&gt;|&quot;暗号化データ&quot;| S2[クラウドサーバー]
        S2 --&gt;|&quot;暗号化データ&quot;| S3[他のデバイス]
        S2 -.-&gt;|&quot;Webアクセス不可&quot;| S4[/&quot;オンラインで閲覧不可&quot;/]
        S3 --&gt;|&quot;ローカルで復号&quot;| S5[パスワード表示]
        S_Title ~~~ S1
    end" data-svg-path="diagrams/password-vault-cloud-sync-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-cloud-sync-ja.svg" alt="Mermaid diagram" /></div></div>',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-attack-vectors',
  'Security Architecture Comparison',
  'password-vault-attack-vectors',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="flowchart LR
    subgraph Vectors[&quot; &quot;]
        direction TB
        V_Title[&quot;&lt;b&gt;Attack Vectors&lt;/b&gt;&quot;]
        AV2[&quot;🌐 Browser Vulnerabilities&quot;]
        AV3[&quot;🧩 Extension Exploits&quot;]
        AV4[&quot;☁️ Web Vault / Server Risks&quot;]
        V_Title ~~~ AV2
    end

    subgraph Codebook[&quot; &quot;]
        direction TB
        C_Title[&quot;&lt;b&gt;Codebook&lt;/b&gt;&quot;]
        C1[&quot;None of these apply&quot;]
        C_Title ~~~ C1
    end

    subgraph Traditional[&quot; &quot;]
        direction TB
        T_Title[&quot;&lt;b&gt;1Password / Bitwarden&lt;/b&gt;&quot;]
        T2[&quot;🌐 Browser Vulnerabilities&quot;]
        T3[&quot;🧩 Extension Exploits&quot;]
        T4[&quot;☁️ Web Vault Risks&quot;]
        T_Title ~~~ T2
    end

    Vectors --&gt; Codebook
    Vectors --&gt; Traditional" data-svg-path="diagrams/password-vault-attack-vectors-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-attack-vectors-en.svg" alt="Mermaid diagram" /></div></div>',
  '<div data-type="mermaidBlock" data-source="flowchart LR
    subgraph Vectors[&quot; &quot;]
        direction TB
        V_Title[&quot;&lt;b&gt;攻撃ベクトル&lt;/b&gt;&quot;]
        AV2[&quot;🌐 ブラウザの脆弱性&quot;]
        AV3[&quot;🧩 拡張機能の悪用&quot;]
        AV4[&quot;☁️ Webボールト/サーバーリスク&quot;]
        V_Title ~~~ AV2
    end

    subgraph Codebook[&quot; &quot;]
        direction TB
        C_Title[&quot;&lt;b&gt;Codebook&lt;/b&gt;&quot;]
        C1[&quot;これらは該当しない&quot;]
        C_Title ~~~ C1
    end

    subgraph Traditional[&quot; &quot;]
        direction TB
        T_Title[&quot;&lt;b&gt;1Password / Bitwarden&lt;/b&gt;&quot;]
        T2[&quot;🌐 ブラウザの脆弱性&quot;]
        T3[&quot;🧩 拡張機能の悪用&quot;]
        T4[&quot;☁️ Webボールトリスク&quot;]
        T_Title ~~~ T2
    end

    Vectors --&gt; Codebook
    Vectors --&gt; Traditional" data-svg-path="diagrams/password-vault-attack-vectors-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-attack-vectors-ja.svg" alt="Mermaid diagram" /></div></div>',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-decision-framework',
  'Password Manager Decision Framework',
  'password-vault-decision-framework',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="flowchart TD
    Start([What matters most?]) --&gt; Q1{Maximum Security?}
    Q1 --&gt;|Yes| Codebook[Recommend: Codebook]
    Q1 --&gt;|No| Q2{Best User Experience?}
    Q2 --&gt;|Yes| 1Password[Recommend: 1Password]
    Q2 --&gt;|No| Q3{Budget Priority?}
    Q3 --&gt;|Yes| Bitwarden[Recommend: Bitwarden]
    Q3 --&gt;|No| Q4{Apple-Only Org?}
    Q4 --&gt;|Yes| Apple[Recommend: Apple Passwords]
    Q4 --&gt;|No| Bitwarden

    Codebook --&gt; Note1[/&quot;Trade-off: Less seamless autofill&quot;/]
    1Password --&gt; Note2[/&quot;Trade-off: Higher cost, no free tier&quot;/]
    Bitwarden --&gt; Note3[/&quot;Trade-off: Less polished UI&quot;/]
    Apple --&gt; Note4[/&quot;Trade-off: Apple ecosystem only&quot;/]" data-svg-path="diagrams/password-vault-decision-framework-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-decision-framework-en.svg" alt="Mermaid diagram" /></div></div>',
  '<div data-type="mermaidBlock" data-source="flowchart TD
    Start([何を最も重視しますか?]) --&gt; Q1{最大限のセキュリティ?}
    Q1 --&gt;|はい| Codebook[推奨: Codebook]
    Q1 --&gt;|いいえ| Q2{最高のユーザー体験?}
    Q2 --&gt;|はい| 1Password[推奨: 1Password]
    Q2 --&gt;|いいえ| Q3{予算優先?}
    Q3 --&gt;|はい| Bitwarden[推奨: Bitwarden]
    Q3 --&gt;|いいえ| Q4{Apple製品のみの組織?}
    Q4 --&gt;|はい| Apple[推奨: Appleパスワード]
    Q4 --&gt;|いいえ| Bitwarden

    Codebook --&gt; Note1[/&quot;トレードオフ: 自動入力がやや手間&quot;/]
    1Password --&gt; Note2[/&quot;トレードオフ: 高コスト、無料プランなし&quot;/]
    Bitwarden --&gt; Note3[/&quot;トレードオフ: UIが洗練されていない&quot;/]
    Apple --&gt; Note4[/&quot;トレードオフ: Appleエコシステムのみ&quot;/]" data-svg-path="diagrams/password-vault-decision-framework-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-decision-framework-ja.svg" alt="Mermaid diagram" /></div></div>',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);

INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-convenience-layer',
  'Convenience Layer Pattern',
  'password-vault-convenience-layer',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="flowchart TB
    subgraph Source[&quot; &quot;]
        direction TB
        Source_Title[&quot;&lt;b&gt;Single Source of Truth&lt;/b&gt;&quot;]
        S1[&quot;Primary Password Manager&lt;br/&gt;(e.g., Codebook)&quot;]
        S2[&quot;All credentials stored here&quot;]
        S3[&quot;TOTP codes&quot;]
        S4[&quot;Secure notes &amp; sensitive data&quot;]
        S5[&quot;Export/backup control&quot;]
        Source_Title ~~~ S1
        S1 --- S2
        S1 --- S3
        S1 --- S4
        S1 --- S5
    end

    subgraph Copy[&quot; &quot;]
        direction TB
        Copy_Title[&quot;&lt;b&gt;Copy as needed&lt;/b&gt;&quot;]
        C1[&quot;Select high-frequency&lt;br/&gt;credentials only&quot;]
        Copy_Title ~~~ C1
    end

    subgraph Conv[&quot; &quot;]
        direction TB
        Conv_Title[&quot;&lt;b&gt;Convenience Layer&lt;/b&gt;&quot;]
        V1[&quot;Apple Passwords or&lt;br/&gt;Browser Autofill&quot;]
        V2[&quot;5-10 daily-use logins&quot;]
        V3[&quot;Face ID / Touch ID autofill&quot;]
        V4[&quot;Not authoritative—&lt;br/&gt;just for speed&quot;]
        Conv_Title ~~~ V1
        V1 --- V2
        V1 --- V3
        V1 --- V4
    end

    Source --&gt; Copy
    Copy --&gt; Conv" data-svg-path="diagrams/password-vault-convenience-layer-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-convenience-layer-en.svg" alt="Mermaid diagram" /></div></div>',
  '<div data-type="mermaidBlock" data-source="flowchart TB
    subgraph Source[&quot; &quot;]
        direction TB
        Source_Title[&quot;&lt;b&gt;唯一の正式ソース&lt;/b&gt;&quot;]
        S1[&quot;プライマリパスワードマネージャー&lt;br/&gt;（例: Codebook）&quot;]
        S2[&quot;すべての認証情報を保存&quot;]
        S3[&quot;TOTPコード&quot;]
        S4[&quot;セキュアノート・機密データ&quot;]
        S5[&quot;エクスポート/バックアップ管理&quot;]
        Source_Title ~~~ S1
        S1 --- S2
        S1 --- S3
        S1 --- S4
        S1 --- S5
    end

    subgraph Copy[&quot; &quot;]
        direction TB
        Copy_Title[&quot;&lt;b&gt;必要に応じてコピー&lt;/b&gt;&quot;]
        C1[&quot;高頻度の認証情報のみ&lt;br/&gt;選択してコピー&quot;]
        Copy_Title ~~~ C1
    end

    subgraph Conv[&quot; &quot;]
        direction TB
        Conv_Title[&quot;&lt;b&gt;コンビニエンスレイヤー&lt;/b&gt;&quot;]
        V1[&quot;Appleパスワード または&lt;br/&gt;ブラウザ自動入力&quot;]
        V2[&quot;日常的に使う5-10個のログイン&quot;]
        V3[&quot;Face ID / Touch ID 自動入力&quot;]
        V4[&quot;正式ではない—&lt;br/&gt;スピードのためだけ&quot;]
        Conv_Title ~~~ V1
        V1 --- V2
        V1 --- V3
        V1 --- V4
    end

    Source --&gt; Copy
    Copy --&gt; Conv" data-svg-path="diagrams/password-vault-convenience-layer-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-convenience-layer-ja.svg" alt="Mermaid diagram" /></div></div>',
  1,
  '["password-manager", "security", "diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);
