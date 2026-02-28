---
title: "Mermaid Compact Reference"
slug: mermaid-compact-reference
category: guides
tags: [mermaid, diagrams, documentation]
summary: "Quick reference for Mermaid diagram syntax and patterns"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# Mermaid Diagram Compactness Reference

Quick reference for reducing vertical and horizontal space in Mermaid diagrams.

---

## Flowcharts

### Compact Configuration

```mermaid
%%{init: {
  'flowchart': {
    'nodeSpacing': 25,
    'rankSpacing': 35,
    'padding': 6,
    'curve': 'basis'
  }
}}%%
flowchart TD
    A --> B --> C
```

| Property      | Default | Compact | Ultra-compact |
| ------------- | ------- | ------- | ------------- |
| `nodeSpacing` | 50      | 25–30   | 15–20         |
| `rankSpacing` | 50      | 35–40   | 25–30         |
| `padding`     | 8       | 6       | 4             |

### Structural Techniques

**Parallel nodes (same rank):**

```mermaid
flowchart TD
    A --> B & C & D --> E
```

**Horizontal flow (trades height for width):**

```mermaid
flowchart LR
    A --> B --> C --> D
```

**Invisible links for alignment:**

```mermaid
flowchart TD
    A --> B
    A ~~~ C
    B --> D
    C --> D
```

**Collapsed subgraphs:**

```mermaid
flowchart TD
    subgraph S1[" "]
        direction LR
        A --- B --- C
    end
    S1 --> D
```

---

## Sequence Diagrams

### Compact Configuration

```mermaid
%%{init: {
  'sequence': {
    'messageMargin': 15,
    'boxMargin': 4,
    'noteMargin': 8,
    'mirrorActors': false,
    'actorMargin': 40,
    'width': 120,
    'height': 40
  }
}}%%
sequenceDiagram
    A->>B: Request
    B-->>A: Response
```

| Property        | Default | Compact | Effect                         |
| --------------- | ------- | ------- | ------------------------------ |
| `messageMargin` | 35      | 15–20   | Vertical gap between messages  |
| `boxMargin`     | 10      | 4–6     | Margin around activation boxes |
| `noteMargin`    | 10      | 6–8     | Space around notes             |
| `actorMargin`   | 50      | 30–40   | Horizontal actor spacing       |
| `mirrorActors`  | true    | false   | Removes bottom actor row       |
| `height`        | 65      | 40–50   | Actor box height               |

### Structural Techniques

**Combine related messages:**

```mermaid
sequenceDiagram
    A->>+B: Request + Process
    B-->>-A: Combined Response
```

**Use shorter participant aliases:**

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    C->>S: Req
    S-->>C: Res
```

---

## State Diagrams

### Compact Configuration

```mermaid
%%{init: {
  'state': {
    'nodeSpacing': 30,
    'rankSpacing': 30,
    'padding': 6
  }
}}%%
stateDiagram-v2
    [*] --> Active
    Active --> Done
    Done --> [*]
```

### Structural Techniques

**Horizontal direction:**

```mermaid
stateDiagram-v2
    direction LR
    [*] --> A --> B --> [*]
```

**Composite states for grouping:**

```mermaid
stateDiagram-v2
    direction LR
    state Processing {
        direction LR
        A --> B --> C
    }
    [*] --> Processing --> [*]
```

---

## Entity Relationship Diagrams

### Compact Configuration

```mermaid
%%{init: {
  'er': {
    'entityPadding': 10,
    'fontSize': 12
  }
}}%%
erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ITEM : contains
```

### Structural Techniques

**Shorter entity names and minimal attributes:**

```mermaid
erDiagram
    U[User] ||--o{ O[Order] : places
    O ||--|{ I[Item] : has
```

---

## Class Diagrams

### Compact Configuration

```mermaid
%%{init: {
  'class': {
    'padding': 6
  },
  'themeVariables': {
    'fontSize': '12px'
  }
}}%%
classDiagram
    A <|-- B
    A <|-- C
```

### Structural Techniques

**Horizontal direction:**

```mermaid
classDiagram
    direction LR
    A <|-- B
    B <|-- C
```

**Abbreviated members:**

```mermaid
classDiagram
    class User {
        +id
        +name
        +save()
    }
```

---

## Gantt Charts

### Compact Configuration

```mermaid
%%{init: {
  'gantt': {
    'barHeight': 15,
    'barGap': 3,
    'fontSize': 11,
    'sectionFontSize': 12,
    'leftPadding': 60
  }
}}%%
gantt
    title Project
    section Phase 1
    Task A :a1, 2024-01-01, 5d
    Task B :a2, after a1, 3d
```

| Property      | Default | Compact | Effect              |
| ------------- | ------- | ------- | ------------------- |
| `barHeight`   | 20      | 12–15   | Height of task bars |
| `barGap`      | 4       | 2–3     | Gap between bars    |
| `leftPadding` | 75      | 50–60   | Label area width    |
| `fontSize`    | 11      | 10–11   | Task label size     |

---

## Pie Charts

### Compact Configuration

```mermaid
%%{init: {
  'pie': {
    'textPosition': 0.7
  },
  'themeVariables': {
    'fontSize': '12px',
    'pieSectionTextSize': '12px'
  }
}}%%
pie
    "A" : 40
    "B" : 30
    "C" : 30
```

---

## Global Theme Settings

Apply to any diagram type for overall size reduction:

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'fontSize': '12px',
    'fontFamily': 'system-ui'
  }
}}%%
```

| Variable           | Default | Compact | Effect                         |
| ------------------ | ------- | ------- | ------------------------------ |
| `fontSize`         | 16px    | 11–13px | All text smaller               |
| `primaryTextColor` | varies  | —       | Ensure contrast at small sizes |

---

## Copy-Paste Templates

### Ultra-Compact Flowchart

```
%%{init: {'flowchart': {'nodeSpacing': 20, 'rankSpacing': 30, 'padding': 4}}}%%
flowchart TD
```

### Ultra-Compact Sequence

```
%%{init: {'sequence': {'messageMargin': 12, 'boxMargin': 3, 'mirrorActors': false, 'height': 35}}}%%
sequenceDiagram
```

### Ultra-Compact Gantt

```
%%{init: {'gantt': {'barHeight': 12, 'barGap': 2, 'fontSize': 10}}}%%
gantt
```

---

## Troubleshooting

**Diagram still too tall?**

1. Switch from `TD` to `LR` orientation
2. Use `&` to place nodes on same rank
3. Reduce `rankSpacing` further (minimum ~20)
4. Shorten node labels

**Text getting cut off?**

- Increase `padding` slightly
- Use explicit node dimensions: `A[Label]:::wide` with custom class

**Arrows overlapping?**

- Increase `nodeSpacing` while keeping `rankSpacing` low
- Use `curve: 'basis'` for smoother paths

---

## Platform Notes

| Platform   | Config Support | Notes                     |
| ---------- | -------------- | ------------------------- |
| GitHub     | Full           | Works in markdown files   |
| GitLab     | Full           | Works in markdown files   |
| Notion     | Partial        | Some init options ignored |
| Confluence | Limited        | May need plugin           |
| Obsidian   | Full           | Native Mermaid support    |
| VS Code    | Full           | With Mermaid extension    |

---

_Reference version: 1.0_
