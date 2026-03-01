---
id: password-vault-attack-vectors
language: en
title: Security Architecture Comparison
category: diagrams
type: diagram
status: production
tags:
  - "password-manager"
  - "security"
  - "diagram"
sensitivity: normal
author: eSolia Technical Team
modified: 2026-01-29 08:15:08
diagram_format: mermaid
---

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 20, 'rankSpacing': 30, 'padding': 4}}}%%
flowchart LR
    subgraph Attacks["Attack Vectors"]
        direction TB
        A1["🌐 Browser Vulnerabilities"]
        A2["🧩 Extension Exploits"]
        A3["☁️ Web Vault / Server Risks"]
    end
    Attacks -->|"All 3 apply ⚠️"| T["1Password / Bitwarden"]
    Attacks -.->|"None apply ✅"| C["Codebook"]
```
