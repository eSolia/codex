// Hanawa Slash Command Extension
// "/" menu for inserting blocks

import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/core';

export interface SlashCommand {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category: 'basic' | 'formatting' | 'media' | 'compliance' | 'advanced';
  keywords?: string[];
  action: (editor: Editor) => void;
}

const slashCommandPluginKey = new PluginKey('slashCommand');

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        pluginKey: slashCommandPluginKey,
        allowSpaces: false,
        startOfLine: true,
        items: ({ query }) => filterCommands(defaultCommands, query),
        command: ({ editor, range, props }) => {
          const command = props as SlashCommand;
          editor.chain().focus().deleteRange(range).run();
          command.action(editor);
        },
        render: () => createSuggestionRenderer(),
      }),
    ];
  },
});

function filterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const search = query.toLowerCase();
  if (!search) return commands;

  return commands.filter((cmd) => {
    const matchLabel = cmd.label.toLowerCase().includes(search);
    const matchKeywords = cmd.keywords?.some((k) => k.toLowerCase().includes(search));
    const matchCategory = cmd.category.toLowerCase().includes(search);
    return matchLabel || matchKeywords || matchCategory;
  });
}

function createSuggestionRenderer() {
  let element: HTMLElement | null = null;
  let selectedIndex = 0;
  let items: SlashCommand[] = [];
  let onSelectCallback: ((item: SlashCommand) => void) | null = null;

  const render = () => {
    if (!element) return;

    if (items.length === 0) {
      element.innerHTML = '<div class="slash-command-empty">No commands found</div>';
      return;
    }

    // Group by category
    const grouped: Record<string, SlashCommand[]> = {};
    for (const cmd of items) {
      if (!grouped[cmd.category]) grouped[cmd.category] = [];
      grouped[cmd.category].push(cmd);
    }

    const categoryLabels: Record<string, string> = {
      basic: 'Basic Blocks',
      formatting: 'Formatting',
      media: 'Media',
      compliance: 'Compliance',
      advanced: 'Advanced',
    };

    let html = '';
    let globalIndex = 0;

    for (const [category, commands] of Object.entries(grouped)) {
      html += `<div class="slash-command-group">`;
      html += `<div class="slash-command-category">${categoryLabels[category] || category}</div>`;

      for (const cmd of commands) {
        const selected = globalIndex === selectedIndex ? 'selected' : '';
        html += `
          <div class="slash-command-item ${selected}" data-index="${globalIndex}">
            <span class="slash-command-icon">${cmd.icon || '📝'}</span>
            <div class="slash-command-content">
              <span class="slash-command-label">${cmd.label}</span>
              ${cmd.description ? `<span class="slash-command-desc">${cmd.description}</span>` : ''}
            </div>
          </div>
        `;
        globalIndex++;
      }

      html += '</div>';
    }

    element.innerHTML = html;

    element.querySelectorAll('.slash-command-item').forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.getAttribute('data-index') || '0');
        if (items[index] && onSelectCallback) {
          onSelectCallback(items[index]);
        }
      });
      item.addEventListener('mouseenter', () => {
        const index = parseInt(item.getAttribute('data-index') || '0');
        selectedIndex = index;
        render();
      });
    });
  };

  return {
    onStart: (props: any) => {
      element = document.createElement('div');
      element.className = 'slash-command-menu';
      items = props.items;
      selectedIndex = 0;
      onSelectCallback = props.command;

      render();

      document.body.appendChild(element);

      const rect = props.clientRect?.();
      if (rect && element) {
        element.style.position = 'fixed';
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.bottom + 8}px`;
        element.style.zIndex = '50';
      }
    },

    onUpdate: (props: any) => {
      items = props.items;
      selectedIndex = 0;
      render();

      const rect = props.clientRect?.();
      if (rect && element) {
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.bottom + 8}px`;
      }
    },

    onKeyDown: (props: any) => {
      if (props.event.key === 'ArrowUp') {
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
        element?.querySelector('.slash-command-item.selected')?.scrollIntoView({ block: 'nearest' });
        return true;
      }

      if (props.event.key === 'ArrowDown') {
        selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
        render();
        element?.querySelector('.slash-command-item.selected')?.scrollIntoView({ block: 'nearest' });
        return true;
      }

      if (props.event.key === 'Enter') {
        if (items[selectedIndex] && onSelectCallback) {
          onSelectCallback(items[selectedIndex]);
        }
        return true;
      }

      if (props.event.key === 'Escape') {
        return true;
      }

      return false;
    },

    onExit: () => {
      element?.remove();
      element = null;
    },
  };
}

export const defaultCommands: SlashCommand[] = [
  // ═══════════════════════════════════════════════════════════════
  // BASIC BLOCKS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'paragraph',
    label: 'Text',
    description: 'Plain text paragraph',
    icon: '📝',
    category: 'basic',
    keywords: ['paragraph', 'text', 'p'],
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    category: 'basic',
    keywords: ['h1', 'title', 'large'],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    category: 'basic',
    keywords: ['h2', 'subtitle'],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    category: 'basic',
    keywords: ['h3', 'subheading'],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bulletList',
    label: 'Bullet List',
    description: 'Unordered list',
    icon: '•',
    category: 'basic',
    keywords: ['ul', 'unordered', 'bullets'],
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    label: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    category: 'basic',
    keywords: ['ol', 'ordered', 'numbers'],
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'taskList',
    label: 'Task List',
    description: 'Checklist with checkboxes',
    icon: '☑️',
    category: 'basic',
    keywords: ['todo', 'checkbox', 'checklist'],
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    description: 'Block quotation',
    icon: '❝',
    category: 'basic',
    keywords: ['blockquote', 'citation', 'quote'],
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'codeBlock',
    label: 'Code Block',
    description: 'Preformatted code',
    icon: '{ }',
    category: 'basic',
    keywords: ['code', 'pre', 'snippet'],
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Horizontal rule',
    icon: '—',
    category: 'basic',
    keywords: ['hr', 'line', 'separator'],
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },

  // ═══════════════════════════════════════════════════════════════
  // COMPLIANCE BLOCKS
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'calloutInfo',
    label: 'Info Callout',
    description: 'Informational highlight',
    icon: 'ℹ️',
    category: 'compliance',
    keywords: ['info', 'note', 'tip'],
    action: (editor) => editor.chain().focus().setCallout({ type: 'info' }).run(),
  },
  {
    id: 'calloutWarning',
    label: 'Warning Callout',
    description: 'Warning or caution',
    icon: '⚠️',
    category: 'compliance',
    keywords: ['warning', 'caution', 'attention'],
    action: (editor) => editor.chain().focus().setCallout({ type: 'warning' }).run(),
  },
  {
    id: 'calloutDanger',
    label: 'Danger Callout',
    description: 'Critical issue or blocker',
    icon: '🚨',
    category: 'compliance',
    keywords: ['danger', 'critical', 'error', 'blocker'],
    action: (editor) => editor.chain().focus().setCallout({ type: 'danger' }).run(),
  },
  {
    id: 'calloutSuccess',
    label: 'Success Callout',
    description: 'Completed or approved item',
    icon: '✅',
    category: 'compliance',
    keywords: ['success', 'done', 'approved', 'complete'],
    action: (editor) => editor.chain().focus().setCallout({ type: 'success' }).run(),
  },
  {
    id: 'statusBadge',
    label: 'Status Badge',
    description: 'Inline compliance status',
    icon: '🏷️',
    category: 'compliance',
    keywords: ['status', 'badge', 'compliant'],
    action: (editor) => {
      editor
        .chain()
        .focus()
        .insertContent('Status')
        .setTextSelection({
          from: editor.state.selection.from - 6,
          to: editor.state.selection.from,
        })
        .setStatusBadge({ status: 'pending-review' })
        .run();
    },
  },
  {
    id: 'evidenceLink',
    label: 'Evidence Link',
    description: 'Link to compliance evidence',
    icon: '📎',
    category: 'compliance',
    keywords: ['evidence', 'attachment', 'document'],
    action: (editor) => {
      const evidenceId = `ev_${Date.now()}`;
      editor
        .chain()
        .focus()
        .insertContent('Evidence')
        .setTextSelection({
          from: editor.state.selection.from - 8,
          to: editor.state.selection.from,
        })
        .setEvidenceLink({ evidenceId, fileType: 'document' })
        .run();
    },
  },
  {
    id: 'privacyMask',
    label: 'Privacy Mask',
    description: 'Mark content for redaction',
    icon: '🔒',
    category: 'compliance',
    keywords: ['redact', 'mask', 'hide', 'pii', 'privacy'],
    action: (editor) => editor.chain().focus().togglePrivacyMask().run(),
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'tableOfContents',
    label: 'Table of Contents',
    description: 'Auto-generated navigation',
    icon: '📑',
    category: 'advanced',
    keywords: ['toc', 'navigation', 'index'],
    action: (editor) => editor.chain().focus().insertTableOfContents().run(),
  },
  {
    id: 'table',
    label: 'Table',
    description: 'Insert data table',
    icon: '📊',
    category: 'advanced',
    keywords: ['grid', 'data', 'table'],
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
];
