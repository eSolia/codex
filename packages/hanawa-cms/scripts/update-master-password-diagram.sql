-- Update bilingual diagram: password-vault-master-password
-- Optimized for compactness using & parallel syntax
-- Generated: 2026-01-28

UPDATE fragments SET
  content_en = '<div data-type="mermaidBlock" data-source="%%{init: {''flowchart'': {''nodeSpacing'': 15, ''rankSpacing'': 30, ''padding'': 8}}}%%
flowchart TB
    subgraph User[&quot;User Memorizes&quot;]
        MP[&quot;🔑 Master Password&lt;br/&gt;&lt;i&gt;The ONE password you remember&lt;/i&gt;&quot;]
    end

    subgraph Vault[&quot;🔒 Vault Encrypted by Master Password&quot;]
        P1[&quot;🌐 Websites&lt;br/&gt;&lt;code&gt;kX9#mP2$vL5@...&lt;/code&gt;&quot;] &amp; P2[&quot;📧 Email&lt;br/&gt;&lt;code&gt;jR4!wT7*bN3@...&lt;/code&gt;&quot;]
        P3[&quot;🏦 Banking&lt;br/&gt;&lt;code&gt;yH2#cK8$pL1@...&lt;/code&gt;&quot;] &amp; P4[&quot;🔢 TOTP&lt;br/&gt;&lt;code&gt;847 291&lt;/code&gt;&quot;] &amp; P5[&quot;📝 Notes&lt;br/&gt;&lt;i&gt;API keys...&lt;/i&gt;&quot;]
    end

    MP --&gt;|&quot;Unlocks&quot;| Vault" data-svg-path="diagrams/password-vault-master-password-en.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-master-password-en.svg" alt="Mermaid diagram" /></div></div>',
  content_ja = '<div data-type="mermaidBlock" data-source="%%{init: {''flowchart'': {''nodeSpacing'': 15, ''rankSpacing'': 30, ''padding'': 8}}}%%
flowchart TB
    subgraph User[&quot;ユーザーが暗記する&quot;]
        MP[&quot;🔑 マスターパスワード&lt;br/&gt;&lt;i&gt;覚える必要があるたった1つのパスワード&lt;/i&gt;&quot;]
    end

    subgraph Vault[&quot;🔒 マスターパスワードで暗号化されたボールト&quot;]
        P1[&quot;🌐 ウェブサイト&lt;br/&gt;&lt;code&gt;kX9#mP2$vL5@...&lt;/code&gt;&quot;] &amp; P2[&quot;📧 メール&lt;br/&gt;&lt;code&gt;jR4!wT7*bN3@...&lt;/code&gt;&quot;]
        P3[&quot;🏦 銀行・金融&lt;br/&gt;&lt;code&gt;yH2#cK8$pL1@...&lt;/code&gt;&quot;] &amp; P4[&quot;🔢 TOTP&lt;br/&gt;&lt;code&gt;847 291&lt;/code&gt;&quot;] &amp; P5[&quot;📝 ノート&lt;br/&gt;&lt;i&gt;APIキー...&lt;/i&gt;&quot;]
    end

    MP --&gt;|&quot;解錠&quot;| Vault" data-svg-path="diagrams/password-vault-master-password-ja.svg" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="diagrams/password-vault-master-password-ja.svg" alt="Mermaid diagram" /></div></div>',
  updated_at = datetime('now')
WHERE id = 'password-vault-master-password';
