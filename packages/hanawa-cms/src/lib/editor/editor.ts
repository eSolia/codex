/**
 * Hanawa Editor Factory
 * Creates a configured Tiptap editor instance with all custom extensions
 *
 * InfoSec: All extensions reviewed for XSS prevention (OWASP A03)
 *
 * Tiptap 3.x — consolidated packages:
 *   Table: @tiptap/extension-table (includes Row, Cell, Header)
 *   Lists: @tiptap/extension-list (TaskList, TaskItem)
 *   Utils: @tiptap/extensions (Placeholder)
 *   Markdown: @tiptap/markdown (bidirectional markdown support)
 */

import { Editor, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import Highlight from '@tiptap/extension-highlight';
import { Markdown } from '@tiptap/markdown';

import Callout from './extensions/callout';
import StatusBadge from './extensions/status-badge';
import PrivacyMask from './extensions/privacy-mask';
import FragmentReference from './extensions/fragment-reference';
import MermaidBlock from './extensions/mermaid-block';
import PageBreak from './extensions/page-break';
import SlashCommands from './extensions/slash-commands';

export interface EditorConfig {
  element: HTMLElement;
  content?: string;
  contentType?: 'html' | 'markdown';
  placeholder?: string;
  privacyMode?: boolean;
  editable?: boolean;
  onUpdate?: (content: { html: string; text: string; markdown?: string }) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onTransaction?: () => void;
}

/**
 * Creates a fully configured Hanawa editor instance
 */
export function createEditor(config: EditorConfig): Editor {
  const {
    element,
    content = '',
    contentType = 'html',
    placeholder = 'Start writing...',
    privacyMode = false,
    editable = true,
    onUpdate,
    onFocus,
    onBlur,
    onTransaction,
  } = config;

  const extensions: Extensions = [
    // Core editing
    // Tiptap 3: StarterKit now includes Link, Underline, ListKeymap by default
    // We disable Link here and configure it separately for security (OWASP A03)
    StarterKit.configure({
      link: false,
      heading: {
        levels: [1, 2, 3, 4],
      },
      codeBlock: {
        HTMLAttributes: {
          class: 'bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto',
        },
      },
      blockquote: {
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 pl-4 italic',
        },
      },
    }),

    // Markdown support (bidirectional: parse markdown → Tiptap, serialize Tiptap → markdown)
    Markdown,

    // Links - InfoSec: Prevent javascript: URLs (OWASP A03)
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-esolia-navy underline hover:text-esolia-orange',
        rel: 'noopener noreferrer',
      },
      validate: (href) => /^https?:\/\//.test(href),
    }),

    // Images - InfoSec: Only allow https images
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded',
      },
      allowBase64: false, // Prevent data: URLs for security
    }),

    // Tables (Tiptap 3: consolidated into single package)
    Table.configure({
      resizable: true,
      HTMLAttributes: {
        class: 'border-collapse table-auto w-full',
      },
    }),
    TableRow,
    TableHeader.configure({
      HTMLAttributes: {
        class: 'border border-gray-300 bg-gray-50 p-2 text-left font-semibold',
      },
    }),
    TableCell.configure({
      HTMLAttributes: {
        class: 'border border-gray-300 p-2',
      },
    }),

    // Task lists (Tiptap 3: from @tiptap/extension-list)
    TaskList.configure({
      HTMLAttributes: {
        class: 'list-none pl-0',
      },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: {
        class: 'flex items-start gap-2',
      },
    }),

    // Formatting (Tiptap 3: Placeholder from @tiptap/extensions)
    Placeholder.configure({
      placeholder,
      emptyEditorClass: 'is-editor-empty',
    }),
    Highlight.configure({
      multicolor: true,
    }),
    // Note: Underline is now included in StarterKit v3

    // Custom Hanawa extensions
    Callout,
    StatusBadge,
    PrivacyMask.configure({
      privacyMode,
    }),
    FragmentReference,
    MermaidBlock,
    PageBreak,
    SlashCommands,
  ];

  const editor = new Editor({
    element,
    extensions,
    content,
    // Tiptap 3 + @tiptap/markdown: parse content as markdown when contentType is 'markdown'
    ...(contentType === 'markdown' ? { contentType: 'markdown' } : {}),
    editable,
    autofocus: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        onUpdate({
          html: editor.getHTML(),
          text: editor.getText(),
          // Tiptap 3 + @tiptap/markdown: getMarkdown() method added via module augmentation
          markdown: editor.getMarkdown ? editor.getMarkdown() : undefined,
        });
      }
    },
    onFocus: () => {
      if (onFocus) onFocus();
    },
    onBlur: () => {
      if (onBlur) onBlur();
    },
    onTransaction: () => {
      if (onTransaction) onTransaction();
    },
  });

  return editor;
}

/**
 * Get markdown content from editor (returns empty string if Markdown extension not loaded)
 * Tiptap 3 + @tiptap/markdown adds getMarkdown() to the Editor via module augmentation
 */
export function getEditorMarkdown(editor: Editor): string {
  if (editor.getMarkdown) {
    return editor.getMarkdown();
  }
  return '';
}

/**
 * Utility to destroy editor safely
 */
export function destroyEditor(editor: Editor | null): void {
  if (editor && !editor.isDestroyed) {
    editor.destroy();
  }
}

export {
  Callout,
  StatusBadge,
  PrivacyMask,
  FragmentReference,
  MermaidBlock,
  PageBreak,
  SlashCommands,
};
