---
id: password-vault-decision-framework
language: ja
title: Password Manager Decision Framework
category: diagrams
type: diagram
status: production
tags:
  - "password-manager"
  - "security"
  - "diagram"
sensitivity: normal
author: eSolia Technical Team
modified: 2026-01-29 08:39:41
diagram_format: mermaid
---

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 10, 'rankSpacing': 20, 'padding': 4}}}%%
flowchart LR
    Start([何を重視?]) --> Q1{セキュリティ重視?}
    Q1 -->|はい| CB[Codebook]
    Q1 -->|いいえ| Q2{最高のUX?}
    Q2 -->|はい| 1P[1Password]
    Q2 -->|いいえ| Q3{予算優先?}
    Q3 -->|はい| BW[Bitwarden]
    Q3 -->|いいえ| Q4{Apple製品のみ?}
    Q4 -->|はい| AP[Appleパスワード]
    Q4 -->|いいえ| BW
```
