-- Update bilingual diagram fragment: password-vault-convenience-layer
-- Generated: 2026-01-28T01:31:57.359Z

UPDATE fragments SET
  name = 'Convenience Layer Pattern',
  content_en = '<div data-type="mermaidBlock" data-source="%%{init: {''flowchart'': {''nodeSpacing'': 15, ''rankSpacing'': 30, ''padding'': 8}}}%%
flowchart TB
    subgraph Source[&quot;Single Source of Truth&quot;]
        S1[&quot;Primary Password Manager&lt;br/&gt;(e.g., Codebook)&quot;]
        S2[&quot;All credentials&quot;] &amp; S3[&quot;TOTP&quot;] &amp; S4[&quot;Secure notes&quot;] &amp; S5[&quot;Backups&quot;]
        S1 --- S2 &amp; S3 &amp; S4 &amp; S5
    end

    subgraph Copy[&quot;Copy as Needed&quot;]
        C1[&quot;Select high-frequency credentials only&quot;]
    end

    subgraph Conv[&quot;Convenience Layer&quot;]
        V1[&quot;Apple Passwords / Browser Autofill&quot;]
        V2[&quot;5-10 daily logins&quot;] &amp; V3[&quot;Face/Touch ID&quot;] &amp; V4[&quot;Speed only&quot;]
        V1 --- V2 &amp; V3 &amp; V4
    end

    Source --&gt; Copy --&gt; Conv" data-svg-path="diagrams/password-vault-convenience-layer-en.svg" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="diagrams/password-vault-convenience-layer-en.svg" alt="Mermaid diagram" />
</div>
<div class="mermaid-caption-display">Pattern for combining security-first vault with convenience layer</div>
</div>',
  content_ja = '<div data-type="mermaidBlock" data-source="%%{init: {''flowchart'': {''nodeSpacing'': 15, ''rankSpacing'': 30, ''padding'': 8}}}%%
flowchart TB
    subgraph Source[&quot;唯一の正式ソース&quot;]
        S1[&quot;プライマリパスワードマネージャー&lt;br/&gt;（例: Codebook）&quot;]
        S2[&quot;全認証情報&quot;] &amp; S3[&quot;TOTP&quot;] &amp; S4[&quot;セキュアノート&quot;] &amp; S5[&quot;バックアップ&quot;]
        S1 --- S2 &amp; S3 &amp; S4 &amp; S5
    end

    subgraph Copy[&quot;必要に応じてコピー&quot;]
        C1[&quot;高頻度の認証情報のみ選択&quot;]
    end

    subgraph Conv[&quot;コンビニエンスレイヤー&quot;]
        V1[&quot;Appleパスワード / ブラウザ自動入力&quot;]
        V2[&quot;日常使う5-10個&quot;] &amp; V3[&quot;Face/Touch ID&quot;] &amp; V4[&quot;スピード優先&quot;]
        V1 --- V2 &amp; V3 &amp; V4
    end

    Source --&gt; Copy --&gt; Conv" data-svg-path="diagrams/password-vault-convenience-layer-ja.svg" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="diagrams/password-vault-convenience-layer-ja.svg" alt="Mermaid diagram" />
</div>
<div class="mermaid-caption-display">セキュリティ優先ボールトとコンビニエンスレイヤーの併用パターン</div>
</div>',
  is_bilingual = 1,
  tags = '["password-manager","convenience-layer","best-practices"]',
  updated_at = datetime('now')
WHERE id = 'password-vault-convenience-layer';

-- If no rows updated, insert new fragment
INSERT OR IGNORE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  'password-vault-convenience-layer',
  'Convenience Layer Pattern',
  'password-vault-convenience-layer',
  'diagrams',
  'mermaid',
  '<div data-type="mermaidBlock" data-source="%%{init: {''flowchart'': {''nodeSpacing'': 15, ''rankSpacing'': 30, ''padding'': 8}}}%%
flowchart TB
    subgraph Source[&quot;Single Source of Truth&quot;]
        S1[&quot;Primary Password Manager&lt;br/&gt;(e.g., Codebook)&quot;]
        S2[&quot;All credentials&quot;] &amp; S3[&quot;TOTP&quot;] &amp; S4[&quot;Secure notes&quot;] &amp; S5[&quot;Backups&quot;]
        S1 --- S2 &amp; S3 &amp; S4 &amp; S5
    end

    subgraph Copy[&quot;Copy as Needed&quot;]
        C1[&quot;Select high-frequency credentials only&quot;]
    end

    subgraph Conv[&quot;Convenience Layer&quot;]
        V1[&quot;Apple Passwords / Browser Autofill&quot;]
        V2[&quot;5-10 daily logins&quot;] &amp; V3[&quot;Face/Touch ID&quot;] &amp; V4[&quot;Speed only&quot;]
        V1 --- V2 &amp; V3 &amp; V4
    end

    Source --&gt; Copy --&gt; Conv" data-svg-path="diagrams/password-vault-convenience-layer-en.svg" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="diagrams/password-vault-convenience-layer-en.svg" alt="Mermaid diagram" />
</div>
<div class="mermaid-caption-display">Pattern for combining security-first vault with convenience layer</div>
</div>',
  '<div data-type="mermaidBlock" data-source="%%{init: {''flowchart'': {''nodeSpacing'': 15, ''rankSpacing'': 30, ''padding'': 8}}}%%
flowchart TB
    subgraph Source[&quot;唯一の正式ソース&quot;]
        S1[&quot;プライマリパスワードマネージャー&lt;br/&gt;（例: Codebook）&quot;]
        S2[&quot;全認証情報&quot;] &amp; S3[&quot;TOTP&quot;] &amp; S4[&quot;セキュアノート&quot;] &amp; S5[&quot;バックアップ&quot;]
        S1 --- S2 &amp; S3 &amp; S4 &amp; S5
    end

    subgraph Copy[&quot;必要に応じてコピー&quot;]
        C1[&quot;高頻度の認証情報のみ選択&quot;]
    end

    subgraph Conv[&quot;コンビニエンスレイヤー&quot;]
        V1[&quot;Appleパスワード / ブラウザ自動入力&quot;]
        V2[&quot;日常使う5-10個&quot;] &amp; V3[&quot;Face/Touch ID&quot;] &amp; V4[&quot;スピード優先&quot;]
        V1 --- V2 &amp; V3 &amp; V4
    end

    Source --&gt; Copy --&gt; Conv" data-svg-path="diagrams/password-vault-convenience-layer-ja.svg" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="diagrams/password-vault-convenience-layer-ja.svg" alt="Mermaid diagram" />
</div>
<div class="mermaid-caption-display">セキュリティ優先ボールトとコンビニエンスレイヤーの併用パターン</div>
</div>',
  1,
  '["password-manager","convenience-layer","best-practices"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);