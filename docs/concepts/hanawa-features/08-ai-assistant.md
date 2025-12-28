# Hanawa: AI Assistant Specification

Claude-powered writing assistance integrated into the editor.

## Overview

The AI assistant helps authors write, edit, and improve content without leaving the editor. It's context-aware, understands compliance documentation patterns, and maintains the author's voice.

```
┌─────────────────────────────────────────────────────────────────┐
│  AI ASSISTANT CAPABILITIES                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  WRITING                          EDITING                       │
│  ───────                          ───────                       │
│  • Continue writing               • Fix grammar/spelling        │
│  • Generate from outline          • Improve clarity             │
│  • Expand on bullet points        • Simplify language           │
│  • Draft section from prompt      • Make more concise           │
│                                                                 │
│  COMPLIANCE-SPECIFIC              TRANSLATION                   │
│  ──────────────────               ───────────                   │
│  • Suggest control language       • Translate EN ↔ JA           │
│  • Check for gaps                 • Maintain terminology        │
│  • Generate implementation notes  • Preserve formatting         │
│  • Review for completeness                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Design

### AI Service

```typescript
// lib/server/ai.ts

import Anthropic from '@anthropic-ai/sdk';

interface AIRequest {
  action: 'continue' | 'expand' | 'improve' | 'simplify' | 'fix_grammar' | 'translate' | 'custom';
  documentContent: string;
  selection?: string;
  documentType?: string;
  customPrompt?: string;
  targetLocale?: 'en' | 'ja';
  stream?: boolean;
}

export function createAIService(anthropic: Anthropic, db: D1Database) {
  return {
    async generate(request: AIRequest): Promise<{ content: string }> {
      const systemPrompt = buildSystemPrompt(request);
      const userPrompt = buildUserPrompt(request);
      
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      
      const textContent = response.content.find(c => c.type === 'text');
      return { content: textContent?.text || '' };
    },
    
    async *generateStream(request: AIRequest): AsyncGenerator<string> {
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: buildSystemPrompt(request),
        messages: [{ role: 'user', content: buildUserPrompt(request) }],
      });
      
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    },
    
    async translate(text: string, sourceLocale: 'en' | 'ja', targetLocale: 'en' | 'ja'): Promise<string> {
      // Load terminology for consistency
      const terminology = await loadTerminology(targetLocale);
      
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `Translate from ${sourceLocale} to ${targetLocale}. Maintain formatting.`,
        messages: [{ role: 'user', content: `Translate:\n${text}` }],
      });
      
      return response.content[0]?.text || '';
    },
    
    async suggestTags(content: string): Promise<string[]> {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ 
          role: 'user', 
          content: `Suggest 3-7 tags for this content as JSON array:\n${content.slice(0, 2000)}` 
        }],
      });
      
      return JSON.parse(response.content[0]?.text || '[]');
    },
  };
}

function buildSystemPrompt(request: AIRequest): string {
  let prompt = `You are a writing assistant. Preserve the author's style and maintain formatting.`;
  
  if (request.documentType === 'compliance-control') {
    prompt += ` Use precise compliance terminology (SOC 2, ISO 27001).`;
  }
  
  return prompt;
}

function buildUserPrompt(request: AIRequest): string {
  switch (request.action) {
    case 'continue':
      return `Continue writing from:\n"${request.selection}"\n\nWrite 2-3 paragraphs.`;
    case 'expand':
      return `Expand with more detail:\n"${request.selection}"`;
    case 'improve':
      return `Improve for clarity:\n"${request.selection}"`;
    case 'simplify':
      return `Simplify:\n"${request.selection}"`;
    case 'fix_grammar':
      return `Fix grammar only:\n"${request.selection}"`;
    case 'translate':
      return `Translate to ${request.targetLocale}:\n"${request.selection}"`;
    case 'custom':
      return `${request.customPrompt}\n\nText:\n"${request.selection}"`;
    default:
      return request.customPrompt || '';
  }
}
```

## UI Components

### AI Command Menu

Triggered by `Cmd+J` or selection context menu:

```svelte
<!-- lib/components/ai/AICommandMenu.svelte -->
<script lang="ts">
  const actions = [
    { id: 'continue', label: 'Continue writing', icon: Wand2 },
    { id: 'expand', label: 'Expand', icon: Expand },
    { id: 'improve', label: 'Improve writing', icon: Sparkles },
    { id: 'simplify', label: 'Simplify', icon: MessageSquare },
    { id: 'fix_grammar', label: 'Fix grammar', icon: CheckCircle },
    { id: 'translate', label: 'Translate', icon: Languages },
  ];
</script>

<div class="ai-menu">
  {#each actions as action}
    <button onclick={() => onAction(action.id)}>
      <svelte:component this={action.icon} />
      {action.label}
    </button>
  {/each}
</div>
```

### AI Response Panel

Shows streaming response with accept/reject buttons:

- Accept: Replace selection with AI output
- Reject: Discard and close
- Retry: Generate again
- Copy: Copy to clipboard

### Translation Assistant

Side-by-side source/target with terminology consistency.

## Tiptap Integration

```typescript
// Keyboard shortcut: Cmd+J
addKeyboardShortcuts() {
  return {
    'Mod-j': () => {
      const selection = this.editor.state.doc.textBetween(from, to);
      this.options.onTrigger(selection, coords);
      return true;
    },
  };
}
```

## Usage Tracking

```sql
CREATE TABLE ai_usage (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  document_id TEXT,
  action TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at INTEGER NOT NULL
);
```

## Related Documents

- [07-localization.md](./07-localization.md) — Translation integration
- [09-codex-integration.md](./09-codex-integration.md) — RAG context for AI

---

*Document version: 1.0*
