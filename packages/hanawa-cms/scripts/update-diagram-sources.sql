-- Update Password Vault Diagram Fragments with Mermaid Source
-- Generated: 2026-01-26T20:55:35.792Z

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="flowchart TD
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
  content_ja = '<div data-type="mermaidBlock" data-source="flowchart TD
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
  updated_at = datetime('now')
WHERE id = 'password-vault-architecture-comparison-ja';

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="flowchart LR
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
  content_ja = '<div data-type="mermaidBlock" data-source="flowchart LR
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
  updated_at = datetime('now')
WHERE id = 'password-vault-attack-vectors-ja';

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="flowchart LR
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
  content_ja = '<div data-type="mermaidBlock" data-source="flowchart LR
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
  updated_at = datetime('now')
WHERE id = 'password-vault-cloud-sync-ja';

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="flowchart TB
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
  content_ja = '<div data-type="mermaidBlock" data-source="flowchart TB
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
  updated_at = datetime('now')
WHERE id = 'password-vault-convenience-layer-ja';

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="flowchart TD
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
  content_ja = '<div data-type="mermaidBlock" data-source="flowchart TD
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
  updated_at = datetime('now')
WHERE id = 'password-vault-decision-framework-ja';

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="flowchart TB
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
  content_ja = '<div data-type="mermaidBlock" data-source="flowchart TB
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
  updated_at = datetime('now')
WHERE id = 'password-vault-master-password-ja';
