---
title: Article Editing Guidelines
category: Content
tags: [writing, editing, markdown, content-management]
summary: Standards for editing and formatting articles across eSolia web properties.
---

## Overview

All articles across eSolia web properties follow a consistent structure and style. These guidelines ensure readability, SEO effectiveness, and maintainability.

## File structure

```
content/
  posts/
    YYYY-MM-DD-slug-title.md    ← blog posts
  pages/
    service-name.md             ← service pages
```

## Frontmatter requirements

Every article must include:

```yaml
---
title: "Clear, Descriptive Title"
description: "1-2 sentence summary for SEO and social sharing"
date: 2026-01-15
author: rick-cogley
tags: [relevant, tags, here]
draft: false
---
```

## Writing style

- **Voice:** Professional but approachable. Write as a knowledgeable colleague, not a textbook.
- **Paragraphs:** Keep to 3-4 sentences. Break long paragraphs.
- **Headers:** Use sentence case. Use H2 for main sections, H3 for subsections. Never skip levels.
- **Lists:** Use when presenting 3+ parallel items. Each item should be a complete thought.
- **Links:** Use descriptive anchor text, never "click here".

## Bilingual content

- English source is authoritative; Japanese follows in separate file
- Maintain parallel file structure with `-en` and `-ja` suffixes
- Do not machine-translate idioms — adapt them culturally
- Technical terms: keep English in parentheses on first use in Japanese text
  - Example: バックプレッシャー（backpressure）

## Images

- Use WebP format, max 1200px wide
- Always include alt text (both languages)
- Store in `/static/images/YYYY/` directory
- Use descriptive filenames: `esolia-team-workshop-2026.webp` not `IMG_4532.webp`

## Review checklist

Before publishing, verify:

1. Frontmatter is complete and date is correct
2. No broken internal links
3. Images have alt text and load correctly
4. Both language versions are consistent in content
5. Grammar and spell check passed
6. Preview renders correctly in both languages
