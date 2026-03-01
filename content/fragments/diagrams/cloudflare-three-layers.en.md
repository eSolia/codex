---
id: cloudflare-three-layers
language: en
title: Three Layers of Cloudflare Protection
category: diagrams
type: diagram
version: 2025-01
status: production
tags:
  - "cloudflare"
  - "security"
  - "dns"
  - "waf"
  - "zero-trust"
sensitivity: normal
author: rick.cogley@esolia.co.jp
created: 2025-12-27
modified: 2025-12-27
review_due: 2026-03-27
allowed_collections:
  - "proposals"
  - "help"
  - "concepts"
diagram_format: mermaid
---

```mermaid
flowchart LR
    subgraph protection["Three Layers of Protection"]
        direction TB
        A["Secure DNS"]
        B["Secure Website"]
        C["Secure Access"]
    end

    A --- A1["Blocks malicious sites,<br/>malware, and phishing"]
    B --- B1["WAF, DDoS protection,<br/>global CDN"]
    C --- C1["Encrypted tunnel from<br/>every device"]
```

Cloudflare provides three integrated security layers: DNS filtering to
block threats before they reach your network, web application protection
for your online presence, and encrypted tunnels for secure remote access.
