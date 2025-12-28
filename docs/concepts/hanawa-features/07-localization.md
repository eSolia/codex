# Hanawa: Localization Specification

Field-level internationalization for bilingual content management.

## Overview

eSolia operates bilingually—English and Japanese are both first-class languages. The localization system supports side-by-side editing, translation workflows, and flexible fallback behavior.

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCALIZATION MODEL                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Field              EN                    JA                   │
│  ─────────────────────────────────────────────────────────────  │
│  control_id         CC6.1                 CC6.1 (universal)    │
│  title              Access Control        アクセス制御           │
│  description        [rich text EN]        [rich text JA]        │
│  status             compliant             compliant (universal) │
│                                                                 │
│  Some fields are localized, some are universal                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```sql
-- Add locale support to documents table
ALTER TABLE documents ADD COLUMN default_locale TEXT DEFAULT 'en';
ALTER TABLE documents ADD COLUMN available_locales TEXT DEFAULT '["en"]';
ALTER TABLE documents ADD COLUMN localized_content TEXT;

-- Translation status tracking
CREATE TABLE translation_status (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  progress_percent INTEGER DEFAULT 0,
  translated_fields TEXT,
  pending_fields TEXT,
  assigned_to TEXT,
  last_updated INTEGER,
  
  FOREIGN KEY (document_id) REFERENCES documents(id),
  UNIQUE(document_id, locale)
);
```

## API Design

```typescript
export function createLocalizationService(db: D1Database) {
  return {
    async getLocalized(
      documentId: string,
      locale: 'en' | 'ja',
      options: { fallback?: boolean } = {}
    ) {
      const doc = await db.prepare(`
        SELECT * FROM documents WHERE id = ?
      `).bind(documentId).first();
      
      const localizedContent = JSON.parse(doc.localized_content || '{}');
      const localeContent = localizedContent[locale] || {};
      const defaultContent = localizedContent[doc.default_locale] || {};
      
      // Merge with fallback
      if (options.fallback) {
        return { ...defaultContent, ...localeContent };
      }
      return localeContent;
    },
    
    async saveLocalized(
      documentId: string,
      locale: 'en' | 'ja',
      fields: Record<string, string>
    ) {
      const doc = await db.prepare(`
        SELECT localized_content FROM documents WHERE id = ?
      `).bind(documentId).first();
      
      const content = JSON.parse(doc.localized_content || '{}');
      content[locale] = { ...content[locale], ...fields };
      
      await db.prepare(`
        UPDATE documents SET localized_content = ? WHERE id = ?
      `).bind(JSON.stringify(content), documentId).run();
    },
    
    async getTranslationQueue(locale: 'en' | 'ja') {
      const { results } = await db.prepare(`
        SELECT ts.*, d.title
        FROM translation_status ts
        JOIN documents d ON ts.document_id = d.id
        WHERE ts.locale = ? AND ts.status != 'complete'
        ORDER BY ts.last_updated DESC
      `).bind(locale).all();
      
      return results;
    },
  };
}
```

## UI Components

### Side-by-Side Editor

Two-pane editor with source (read-only) and target (editable):

- Source locale displayed on left
- Target locale editable on right
- Field-by-field translation with progress tracking
- Copy button to duplicate source as starting point

### Locale Switcher

Toggle between locales in the document header:

```svelte
<LocaleSwitcher
  currentLocale={locale}
  availableLocales={['en', 'ja']}
  translationStatus={status}
  onChange={handleLocaleChange}
/>
```

### Translation Queue

Dashboard showing documents pending translation:

- Filter by locale, status, assignee
- Progress percentage for each document
- Quick actions: Assign, Open, Mark Complete

## Implementation Notes

### Fallback Behavior

1. Try requested locale first
2. Fall back to default locale if field empty
3. Mark fallback content visually

### Schema Definition

```typescript
const schema = {
  fields: {
    controlId: { type: 'string', localized: false },
    title: { type: 'string', localized: true },
    description: { type: 'richtext', localized: true },
    status: { type: 'enum', localized: false },
  },
};
```

## Related Documents

- [05-workflow-engine.md](./05-workflow-engine.md) — Separate approval per locale
- [01-audit-system.md](./01-audit-system.md) — Track translation changes

---

*Document version: 1.0*
