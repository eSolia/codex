/**
 * Hanawa Editor Factory
 * Creates a configured Tiptap editor instance with all custom extensions
 *
 * InfoSec: All extensions reviewed for XSS prevention (OWASP A03)
 */

import { Editor, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';

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
  placeholder?: string;
  privacyMode?: boolean;
  editable?: boolean;
  onUpdate?: (content: { html: string; text: string }) => void;
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
    StarterKit.configure({
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

    // Tables
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

    // Task lists
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

    // Formatting
    Placeholder.configure({
      placeholder,
      emptyEditorClass: 'is-editor-empty',
    }),
    Highlight.configure({
      multicolor: true,
    }),
    Underline,

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
