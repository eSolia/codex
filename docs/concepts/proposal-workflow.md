# Proposal & Document Assembly Workflow

How to efficiently create proposals and documents using Claude Max subscription, Hanawa CMS, and Courier delivery.

## Cost-Efficient Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COST-EFFICIENT AUTHORING MODEL                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  HIGH VOLUME (Use Subscription)           LOW VOLUME (API OK)               │
│  ───────────────────────────────          ─────────────────────             │
│                                                                              │
│  Claude Desktop                           Hanawa Fragment Review            │
│  ├── Drafting proposals                   ├── Occasional quality check      │
│  ├── Meeting note synthesis               ├── Translation verification      │
│  ├── Client requirement analysis          └── Minimal API cost              │
│  └── Content translation                                                     │
│                                                                              │
│  Claude Code                              Miko (AI Search)                  │
│  ├── Technical documentation              ├── User queries only             │
│  ├── Fragment authoring                   ├── On-demand, not background     │
│  ├── Bilingual content                    └── Within free tier              │
│  └── Code/config examples                                                    │
│                                                                              │
│  Key Insight: Use Claude Max for heavy lifting, API for light touches       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Matters

| Approach | Cost Model | Best For |
|----------|------------|----------|
| Claude Max (Desktop/Code) | Fixed $200/month | Heavy authoring, translation, analysis |
| Anthropic API | ~$15/M input, $75/M output | Light review, automated checks |
| Workers AI | 10k Neurons/day free | Embeddings, simple generation |

**Conclusion:** Do the heavy lifting in Claude Desktop/Code. Use API sparingly for automated workflows.

## Proposal Creation Workflow

### Phase 1: Gather Information (Claude Desktop)

Use your Claude Max subscription in Claude Desktop to:

1. **Synthesize meeting notes**
   ```
   "Here are my notes from the client call. Please extract:
   - Their key requirements
   - Timeline constraints
   - Budget considerations
   - Decision makers"
   ```

2. **Analyze requirements**
   ```
   "Based on these requirements, recommend which eSolia services
   would be most appropriate. Consider M365 licensing options."
   ```

3. **Draft client-specific sections**
   ```
   "Draft the 'Your Specific Requirements' section for this proposal
   based on our discussion notes."
   ```

**Output:** Markdown file with client-specific content.

### Phase 2: Export from Claude Desktop

Export your conversation or artifact to markdown:

```markdown
---
title: "Security Infrastructure Proposal"
client: "ACME Corp"
created: "2025-01-15"
author: "Rick Cogley"
type: "proposal-draft"
language: "en"
---

## Your Specific Requirements

Based on our discussion on January 15th, your priorities are:
1. Quick deployment before overseas partner call
2. Focus on email security first
3. Gradual device management rollout

## Recommended Approach

[Content drafted in Claude Desktop...]
```

### Phase 3: Import to Hanawa

Hanawa accepts markdown import via:

1. **Paste** - Copy/paste markdown into editor
2. **Upload** - Drag markdown file to import
3. **API** - `POST /api/import` (for automation)

On import, Hanawa:
- Parses frontmatter for metadata
- Converts markdown to Tiptap JSON
- Detects fragment references (if any)
- Applies proposal template structure

### Phase 4: Assemble from Fragments

In Hanawa, insert pre-authored fragments:

```markdown
## Microsoft 365 Overview

{{fragment:products/m365-business-premium lang="ja"}}

## License Comparison

{{fragment:comparisons/m365-licenses lang="ja"}}

## Our Implementation Approach

{{fragment:services/security-implementation lang="ja"}}

## Your Specific Requirements

<!-- This section stays as client-specific content -->
Based on our discussion on January 15th...
```

**Fragments are pre-authored** in Claude Code (using your subscription) and stored in Hanawa. When you insert a fragment reference, it's resolved at view/export time.

### Phase 5: Review & Polish

In Hanawa editor:
- Adjust fragment content if needed (creates override, doesn't modify source)
- Add custom diagrams (Mermaid or uploaded)
- Review bilingual content
- Apply branding and formatting

**Optional API review:** If you want AI to check the assembled document:
```
POST /api/review
{
  "document_id": "proposal-acme-2025-01",
  "check": ["consistency", "translation", "completeness"]
}
```
This is an occasional, lightweight API call—not continuous.

### Phase 6: Export & Deliver

Export options:
- **PDF** - Branded, with embedded provenance metadata
- **Markdown** - For further editing or archival
- **Package** - ZIP with PDF + supporting diagrams

Delivery via Courier:
1. Click "Share via Courier" in Hanawa
2. Specify recipient email and expiry
3. Courier creates PIN-protected share
4. Recipient gets link, PIN delivered separately
5. Full tracking of views and downloads

## Fragment Authoring (Claude Code)

Use Claude Code to author reusable fragments:

### Creating a New Fragment

```bash
# In codex repo
claude

> Create a bilingual fragment for M365 Business Premium overview.
> Include key features, Defender capabilities, and pricing context.
> Save to content/fragments/products/m365-business-premium.yaml
```

### Fragment Structure

```yaml
# content/fragments/products/m365-business-premium.yaml
id: m365-business-premium
title:
  en: "Microsoft 365 Business Premium"
  ja: "Microsoft 365 Business Premium"
type: product-overview
version: "2025-01"
tags: ["m365", "licensing", "productivity", "security"]

content:
  en: |
    **Full Office Applications:** The license includes perpetual desktop
    versions of Word, Excel, PowerPoint, and Outlook—replacing whatever
    came with your laptops with properly licensed, always-updated software.

    **Business Email:** Professional email hosting with your company domain,
    plus calendars, contacts, and Microsoft Teams for collaboration.

    **Defender Protection:** Microsoft Defender is included, providing:
    - Antivirus and anti-malware scanning across all devices
    - Anti-phishing protection that scans email links and attachments
    - Safe Links that check URLs at the moment you click
    - Safe Attachments that open files in a protected sandbox
    - Device security policies that ensure laptops meet security standards

    These Defender features are typically only available in Microsoft's
    expensive enterprise licenses. Business Premium includes them at a
    mid-tier price.

  ja: |
    **フルOfficeアプリケーション:** このライセンスには、Word、Excel、
    PowerPoint、Outlookの永続デスクトップ版が含まれています。ノートPCに
    プリインストールされていたアプリケーションを、正規ライセンスの常に
    最新のソフトウェアに置き換えます。

    **ビジネスメール:** 貴社ドメインでのプロフェッショナルなメール
    ホスティング、カレンダー、連絡先、Microsoft Teamsによるコラボ
    レーション機能を提供します。

    **Defender保護:** Microsoft Defenderが含まれており、以下の機能を
    提供します：
    - すべてのデバイスでのウイルス対策・マルウェア対策スキャン
    - メールのリンクや添付ファイルを開く前にスキャンするフィッシング対策
    - クリック時にURLをチェックし、新たに発見された脅威をブロックするSafe Links
    - 隠れたマルウェアを検出するため、保護されたサンドボックスでファイルを
      開くSafe Attachments
    - ノートPCやスマートフォンがセキュリティ基準を満たしていることを確認
      するデバイスセキュリティポリシー

    これらのDefender機能は、通常Microsoftの高価なエンタープライズライセンス
    でのみ利用可能です。Business Premiumでは、中間価格帯でこれらを利用できます。

metadata:
  last_updated: "2025-01-15"
  updated_by: "rick.cogley@esolia.co.jp"
  review_frequency: "quarterly"
  next_review: "2025-04-15"
```

### Syncing Fragments to Hanawa

Fragments authored in Git sync to Hanawa via CI:

```
Git push → GitHub Actions → Parse fragments → Upload to R2 → Index in D1
```

Hanawa sees fragments from both:
- **Git-authored** (synced via CI)
- **CMS-authored** (created directly in Hanawa)

## Comparison Tables (Fragment Example)

One of the most reusable fragment types:

```yaml
# content/fragments/comparisons/m365-licenses.yaml
id: m365-licenses
title:
  en: "Microsoft 365 License Comparison"
  ja: "Microsoft 365 ライセンス比較"
type: comparison-table
version: "2025-01"

content:
  en: |
    | Feature | Business Premium | E3 | E5 |
    |---------|-----------------|----|----|
    | Office Apps | ✓ | ✓ | ✓ |
    | Email & Calendar | ✓ | ✓ | ✓ |
    | Teams | ✓ | ✓ | ✓ |
    | OneDrive | 1TB | Unlimited | Unlimited |
    | SharePoint | ✓ | ✓ | ✓ |
    | Intune (MDM) | ✓ | ✓ | ✓ |
    | Defender for Endpoint | Plan 1 | Plan 1 | Plan 2 |
    | Azure AD Premium | P1 | P1 | P2 |
    | Information Protection | Basic | P1 | P2 |
    | eDiscovery | Basic | Standard | Premium |
    | Cloud App Security | – | – | ✓ |
    | Power BI Pro | – | – | ✓ |
    | **Typical Price/user/mo** | ~$22 | ~$36 | ~$57 |

    **Recommendation:** For firms under 300 users without complex compliance
    needs, Business Premium provides the best value. E3/E5 add features most
    SMBs don't need.

  ja: |
    | 機能 | Business Premium | E3 | E5 |
    |------|-----------------|----|----|
    | Officeアプリ | ✓ | ✓ | ✓ |
    | メール・カレンダー | ✓ | ✓ | ✓ |
    | Teams | ✓ | ✓ | ✓ |
    | OneDrive | 1TB | 無制限 | 無制限 |
    | SharePoint | ✓ | ✓ | ✓ |
    | Intune (MDM) | ✓ | ✓ | ✓ |
    | Defender for Endpoint | Plan 1 | Plan 1 | Plan 2 |
    | Azure AD Premium | P1 | P1 | P2 |
    | 情報保護 | 基本 | P1 | P2 |
    | eDiscovery | 基本 | 標準 | プレミアム |
    | Cloud App Security | – | – | ✓ |
    | Power BI Pro | – | – | ✓ |
    | **概算価格/ユーザー/月** | ~¥2,750 | ~¥4,500 | ~¥7,130 |

    **推奨:** 300ユーザー未満で複雑なコンプライアンス要件がない企業には、
    Business Premiumが最もコストパフォーマンスに優れています。E3/E5は
    多くの中小企業には不要な機能を追加します。
```

## Diagram Integration

### Mermaid Diagrams (Preferred)

Author in Claude Code, store as fragments:

```yaml
# content/fragments/diagrams/cloudflare-security-layers.yaml
id: cloudflare-security-layers
type: diagram
format: mermaid

content: |
  flowchart TB
      subgraph team["Your Team"]
          laptop["💻 Laptops"]
          phone["📱 Phones"]
      end

      subgraph cloudflare["Cloudflare Security Layer"]
          zt["Zero Trust Gateway"]
          dns["Secure DNS"]
          warp["Encrypted Tunnel"]
      end

      subgraph services["Protected Services"]
          m365["Microsoft 365"]
          website["Your Website"]
      end

      team --> warp
      warp --> zt
      zt --> dns
      dns --> services

      style cloudflare fill:#f6821f,color:#fff
      style m365 fill:#0078d4,color:#fff
```

Hanawa renders Mermaid at view time and exports to SVG for PDF.

### External Diagrams (draw.io)

For complex diagrams created in draw.io:

1. Export as SVG from draw.io
2. Upload to Hanawa media library
3. Reference in documents: `![Architecture](media/architecture-diagram.svg)`

## Team Collaboration Pattern

When multiple people contribute:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TEAM AUTHORING PATTERN                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Team Member A (Claude Desktop)                                             │
│  └── Drafts client requirements section → exports markdown                  │
│                                                                              │
│  Team Member B (Claude Desktop)                                             │
│  └── Drafts technical approach section → exports markdown                   │
│                                                                              │
│  Rick (Claude Code)                                                         │
│  └── Creates/updates reusable fragments                                     │
│                                                                              │
│  Assembler (Hanawa)                                                          │
│  ├── Imports all markdown sections                                          │
│  ├── Inserts fragment references                                            │
│  ├── Applies template and branding                                          │
│  ├── Reviews and polishes                                                   │
│  └── Exports and delivers via Courier                                       │
│                                                                              │
│  All heavy AI work uses Claude Max subscriptions.                           │
│  Hanawa is just assembly—no API calls required.                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Usage (Minimal)

The only API calls in this workflow:

| When | API | Purpose | Frequency |
|------|-----|---------|-----------|
| Fragment sync | Cloudflare R2 | Upload to bucket | On Git push |
| Optional review | Anthropic | Quality check | Per proposal (optional) |
| Miko queries | Workers AI | User Q&A | On-demand |
| Embedding | Workers AI | Search indexing | On publish |

All authoring happens locally using Claude Max subscription.

## Provenance Tracking

Every assembled proposal includes full provenance:

```yaml
provenance:
  document_id: "proposal-acme-2025-01"
  template: "security-infrastructure-proposal"

  sources:
    - type: "claude-desktop-export"
      file: "acme-requirements-draft.md"
      author: "rick.cogley@esolia.co.jp"
      created: "2025-01-15T09:00:00Z"

    - type: "claude-desktop-export"
      file: "acme-technical-approach.md"
      author: "team-member@esolia.co.jp"
      created: "2025-01-15T10:30:00Z"

  fragments:
    - id: "products/m365-business-premium"
      version: "2025-01-v2"
      lang: "ja"

    - id: "comparisons/m365-licenses"
      version: "2025-01-v1"
      lang: "ja"

    - id: "diagrams/cloudflare-security-layers"
      version: "2025-01-v1"

  assembled: "2025-01-15T14:00:00Z"
  assembled_by: "rick.cogley@esolia.co.jp"

  delivery:
    method: "courier"
    share_id: "shr_abc123"
    recipient: "client@example.com"
```

This enables:
- Full audit trail of content origins
- Fragment version tracking
- Compliance documentation
- Content update notifications (when fragments change)

---

## Quick Reference

### Creating a Proposal

1. **Draft** in Claude Desktop (use subscription)
2. **Export** to markdown
3. **Import** to Hanawa
4. **Insert** fragment references
5. **Polish** in editor
6. **Export** as PDF
7. **Share** via Courier

### Creating a Fragment

1. **Author** in Claude Code (use subscription)
2. **Save** to `content/fragments/`
3. **Commit** to Git
4. **CI syncs** to Hanawa automatically

### Updating a Fragment

1. **Edit** in Claude Code
2. **Bump** version in metadata
3. **Commit** to Git
4. **Hanawa notifies** documents using old version

---

*Document version: 1.0*
*Last updated: 2025-12-27*
