/**
 * Callout Extension for Tiptap
 * Renders alert blocks (info, warning, danger, success)
 *
 * Markdown syntax: :::type{title="..."}content:::
 * InfoSec: No external dependencies, sanitized content rendering
 */

import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** Minimal type for @tiptap/markdown serializer state */
interface MarkdownSerializerState {
  write(text: string): void;
  ensureNewLine(): void;
  renderContent(node: ProseMirrorNode): void;
}

export type CalloutType = 'info' | 'warning' | 'danger' | 'success';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
  types: CalloutType[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: CalloutType, title?: string) => ReturnType;
      toggleCallout: (type: CalloutType) => ReturnType;
      unsetCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  addOptions() {
    return {
      HTMLAttributes: {},
      types: ['info', 'warning', 'danger', 'success'],
    };
  },

  group: 'block',

  content: 'block+',

  defining: true,

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          const type = node.attrs.type as string;
          const title = node.attrs.title as string | null;
          const titleAttr = title ? `{title="${title}"}` : '';
          state.write(`:::${type}${titleAttr}\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(':::\n\n');
        },
        parse: {
          // Directive syntax (:::) requires custom Marked extension for parsing
          // Falls back to HTML div parsing via parseHTML
        },
      },
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes) => ({
          'data-callout-type': attributes.type,
        }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-callout-title'),
        renderHTML: (attributes) =>
          attributes.title ? { 'data-callout-title': attributes.title } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-callout-type]',
        // Use function to strip phantom title paragraphs before parsing content.
        // A phantom is a <p> inside .callout-content that duplicates the callout title.
        // These were created by an earlier code version and self-perpetuate on round-trip.
        contentElement: (node: globalThis.HTMLElement) => {
          const contentEl = node.querySelector('.callout-content') as HTMLElement | null;
          if (!contentEl) return node;

          const title = node.getAttribute('data-callout-title');
          if (title) {
            const stripPrefix = (s: string) =>
              s.replace(/^(\s|\ufe0f|\u200d|\u26a0|\u2139)+/u, '').trim();
            const cleanTitle = stripPrefix(title);

            // Remove ALL leading paragraphs that match the title (may be multiple)
            let firstP = contentEl.querySelector(':scope > p:first-child');
            while (firstP) {
              const pText = stripPrefix(firstP.textContent || '');
              if (pText !== cleanTitle) break;
              firstP.remove();
              firstP = contentEl.querySelector(':scope > p:first-child');
            }
          }

          return contentEl;
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type as CalloutType;
    const title = node.attrs.title;

    const typeClasses: Record<CalloutType, string> = {
      info: 'callout-info border-blue-500 bg-blue-50',
      warning: 'callout-warning border-yellow-500 bg-yellow-50',
      danger: 'callout-danger border-red-500 bg-red-50',
      success: 'callout-success border-green-500 bg-green-50',
    };

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `callout ${typeClasses[type]} border-l-4 p-4 my-4 rounded-r`,
        'data-callout-type': type,
        'data-callout-title': title || undefined,
      }),
      title ? ['div', { class: 'callout-title font-semibold mb-2' }, title] : '',
      ['div', { class: 'callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (type: CalloutType, title?: string) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, { type, title });
        },
      toggleCallout:
        (type: CalloutType) =>
        ({ commands }) => {
          return commands.toggleWrap(this.name, { type });
        },
      unsetCallout:
        () =>
        ({ commands }) => {
          return commands.lift(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout('info'),
    };
  },
});

export default Callout;
