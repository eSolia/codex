---
id: cloudflare-security-layers
language: ja
title: Cloudflare セキュリティアーキテクチャ
category: diagrams
type: diagram
version: 2025-01
status: production
tags:
  - "cloudflare"
  - "security"
  - "architecture"
  - "zero-trust"
  - "network"
sensitivity: normal
author: rick.cogley@esolia.co.jp
created: 2025-12-27
modified: 2025-12-27
review_due: 2026-03-27
allowed_collections:
  - "proposals"
  - "help"
  - "concepts"
  - "blog"
diagram_format: mermaid
---

```mermaid
flowchart TB
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
    dns --> services

    style cloudflare fill:#f6821f,color:#fff
    style m365 fill:#0078d4,color:#fff
    style website fill:#f6821f,color:#fff
```

すべてのデバイスがCloudflareのネットワークを経由して接続されます。悪意の
あるサイトは読み込まれる前にブロックされます。貴社のウェブサイトは攻撃
から保護されます。チームはどこからでも安全に作業できます—自宅、サービス
オフィス、ホテルやカフェからでも。
