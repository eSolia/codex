// Hanawa Editor Factory
// Creates a fully configured Tiptap editor with Hanawa extensions

import { Editor, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';

import { CalloutExtension } from './extensions/callout';
import { StatusBadgeExtension } from './extensions/status-badge';
import { EvidenceLinkExtension } from './extensions/evidence-link';
import { PrivacyMaskExtension } from './extensions/privacy-mask';
import { TableOfContentsExtension } from './extensions/table-of-contents';
import { SlashCommandExtension } from './extensions/slash-command';

export interface EditorConfig {
  /** Initial content (HTML or ProseMirror JSON) */
  content?: string | Record<string, unknown>;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Enable privacy mode to redact masked content */
  privacyMode?: boolean;
  /** Callback when content changes */
  onUpdate?: (html: string, json: Record<string, unknown>) => void;
  /** Callback when editor is ready */
  onCreate?: (editor: Editor) => void;
  /** Callback when editor loses focus */
  onBlur?: () => void;
  /** Additional Tiptap extensions */
  extensions?: Extensions;
  /** Names of extensions to disable */
  disableExtensions?: string[];
  /** Whether content is editable */
  editable?: boolean;
}

/**
 * Creates a Hanawa editor instance with all custom extensions
 */
export function createEditor(config: EditorConfig = {}): Editor {
  const {
    content = '',
    placeholder = 'Type "/" for commands, or start writing...',
    privacyMode = false,
    onUpdate,
    onCreate,
    onBlur,
    extensions: customExtensions = [],
    disableExtensions = [],
    editable = true,
  } = config;

  const isDisabled = (name: string) => disableExtensions.includes(name);

  const coreExtensions: Extensions = [
    // Base functionality
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
    }),

    // Typography enhancements
    !isDisabled('typography') && Typography,

    // Placeholder
    !isDisabled('placeholder') && Placeholder.configure({
      placeholder,
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-node-empty',
    }),

    // Links
    !isDisabled('link') && Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        class: 'hanawa-link',
      },
    }),

    // Images
    !isDisabled('image') && Image.configure({
      inline: false,
      allowBase64: true,
      HTMLAttributes: { class: 'hanawa-image' },
    }),

    // Tables
    !isDisabled('table') && Table.configure({
      resizable: true,
      HTMLAttributes: { class: 'hanawa-table' },
    }),
    !isDisabled('table') && TableRow,
    !isDisabled('table') && TableCell,
    !isDisabled('table') && TableHeader,

    // Task lists
    !isDisabled('taskList') && TaskList,
    !isDisabled('taskList') && TaskItem.configure({ nested: true }),

    // Text formatting
    !isDisabled('highlight') && Highlight.configure({ multicolor: true }),
    !isDisabled('subscript') && Subscript,
    !isDisabled('superscript') && Superscript,
    !isDisabled('underline') && Underline,
    !isDisabled('textAlign') && TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),

    // ═══════════════════════════════════════════════════════════════
    // HANAWA CUSTOM EXTENSIONS
    // ═══════════════════════════════════════════════════════════════

    !isDisabled('callout') && CalloutExtension,
    !isDisabled('statusBadge') && StatusBadgeExtension,
    !isDisabled('evidenceLink') && EvidenceLinkExtension,
    !isDisabled('privacyMask') && PrivacyMaskExtension.configure({
      enabled: privacyMode,
    }),
    !isDisabled('tableOfContents') && TableOfContentsExtension,
    !isDisabled('slashCommand') && SlashCommandExtension,

    // User-provided extensions
    ...customExtensions,
  ].filter(Boolean) as Extensions;

  const editor = new Editor({
    extensions: coreExtensions,
    content,
    editable,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'hanawa-editor prose prose-sm sm:prose lg:prose-lg focus:outline-none',
        'data-privacy-mode': privacyMode ? 'true' : 'false',
      },
    },
    onCreate: ({ editor }) => onCreate?.(editor),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const json = editor.getJSON();
      onUpdate?.(html, json);
    },
    onBlur: () => onBlur?.(),
  });

  return editor;
}

/**
 * Toggle privacy mode on an existing editor
 */
export function togglePrivacyMode(editor: Editor, enabled: boolean): void {
  editor.view.dom.setAttribute('data-privacy-mode', enabled ? 'true' : 'false');
  editor.commands.updatePrivacyMasks({ enabled });
}

/**
 * Get all content formats from editor
 */
export function getContent(editor: Editor) {
  return {
    html: editor.getHTML(),
    json: editor.getJSON(),
    text: editor.getText(),
  };
}
