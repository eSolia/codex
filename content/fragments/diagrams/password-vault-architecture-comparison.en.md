---
id: password-vault-architecture-comparison
language: en
title: Security-First vs Convenience-First Architecture
category: diagrams
type: diagram
status: production
tags:
  - "password-manager"
  - "security"
  - "diagram"
sensitivity: normal
author: eSolia Technical Team
modified: 2026-01-28 23:41:54
diagram_format: mermaid
---

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 20, 'rankSpacing': 30, 'padding': 4}}}%%
flowchart LR
    subgraph SF["Security-First"]
        direction TB
        A1[Encrypted Vault] --> A2[Native App Only]
        A2 --> A3[Decryption on Device]
        A3 --> A4[Smaller Attack Surface]
    end

    subgraph CF["Convenience-First"]
        direction TB
        B1[Encrypted Vault] --> B2[Native App] & B3[Browser Ext.] & B4[Web Vault]
        B2 & B3 & B4 --> B5[Multiple Decryption Points]
        B5 --> B6[Larger Attack Surface]
    end

    SF -.->|"Trade-off"| CF
```
