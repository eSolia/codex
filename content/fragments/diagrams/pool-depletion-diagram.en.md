---
id: pool-depletion-diagram
language: en
title: Pool Depletion Over Time
category: diagrams
type: diagram
version: 2025-01
status: production
tags:
  - "pool"
  - "support"
  - "hours"
  - "diagram"
sensitivity: normal
author: rick.cogley@esolia.co.jp
created: 2026-02-20
modified: 2026-02-20
allowed_collections:
  - "proposals"
  - "help"
  - "concepts"
diagram_format: mermaid
usage_notes: Illustrates uneven pool depletion over a fiscal year.
---

```mermaid
xychart-beta
    title "200-Hour Pool — Example Usage Over 12 Months"
    x-axis ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
    y-axis "Hours" 0 --> 210
    bar [5, 12, 3, 20, 8, 15, 25, 10, 18, 22, 30, 32]
    line [195, 183, 180, 160, 152, 137, 112, 102, 84, 62, 32, 0]
```

Example of a 200-hour pool consumed over 12 months. Bars show monthly usage (varying from 3 to 32 hours) while the line tracks the declining balance. Usage is uneven — some months are light, others heavy — reflecting real-world demand patterns. The pool is fully consumed by year end. Monthly reporting keeps you informed of remaining hours and projected depletion.
