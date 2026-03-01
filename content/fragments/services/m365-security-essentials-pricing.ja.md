---
id: m365-security-essentials-pricing
language: ja
title: M365 セキュリティ・エッセンシャルズ - スケジュール・料金
category: services
type: pricing-table
version: 2025-01-v4
status: production
tags:
  - "m365"
  - "security"
  - "cloudflare"
  - "pricing"
  - "timeline"
  - "smb"
sensitivity: normal
author: eSolia Technical Team
created: 2025-01-15
modified: 2025-01-15
version_history:
  - version: "2025-01"
    changes: "Initial version"
  - version: "2025-01-v2"
    changes: "Replace ASCII timeline with Mermaid diagram"
  - version: "2025-01-v3"
    changes: "Fix Mermaid timeline syntax (events require colon prefix)"
  - version: "2025-01-v4"
    changes: "Add eSolia branding colors (navy, orange, emerald)"
usage_notes: Timeline and pricing for M365 Security Essentials package.
Update this fragment when pricing changes - keeps main service description stable.
Pair with m365-security-essentials fragment for complete proposal.
---

## 導入スケジュール

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'cScale0': '#2D2F63', 'cScale1': '#FFBC68', 'cScale2': '#10b981', 'cScaleLabel0': '#ffffff', 'cScaleLabel1': '#2D2F63', 'cScaleLabel2': '#ffffff'}}}%%
timeline
    title M365セキュリティ・エッセンシャルズ導入
    section 第1週
        基盤構築 : M365管理者アカウントの強化
                 : MFA登録（全ユーザー）
                 : Defender for Office 365の設定
                 : DNSゾーン監査とCloudflare準備
    section 第2週
        メール & DNS : Cloudflare DNS移行
                     : SPF/DKIM設定
                     : DMARC p=none展開
                     : Periodic監視のセットアップ
    section 第3週
        Zero Trust & 検証 : Cloudflare Zero Trustポリシー
                          : WARPクライアント展開
                          : 完全なセキュリティ検証
                          : ユーザードキュメントとトレーニング
```

---

## 料金

| コンポーネント | 初期設定費用 | 年額費用 |
|---------------|-------------|----------|
| M365 Business Premium（10ユーザー） | — | ¥400,000* |
| M365 Business Premiumセキュリティ強化 | ¥150,000 | — |
| Cloudflare Pro + DNS移行 | ¥100,000 | ¥100,000 |
| メールセキュリティ（SPF/DKIM/DMARC） | ¥80,000 | — |
| Cloudflare Zero Trust（基本） | ¥120,000 | ¥0** |
| Periodic監視（最初のドメイン） | — | ¥20,000 |
| **合計** | **¥450,000** | **¥520,000** |

*\* M365 Business Premiumサブスクリプション*
*\*\* Cloudflare Zero Trust無料枠（50ユーザーまで）*
