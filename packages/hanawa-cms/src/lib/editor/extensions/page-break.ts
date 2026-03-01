/**
 * Page Break Extension for Tiptap
 * Renders a visible page break marker in the editor
 * Outputs CSS page-break-before for PDF rendering
 *
 * InfoSec: No external dependencies, static content only
 */

import { Node, mergeAttributes } from '@tiptap/core';

/** Minimal type for @tiptap/markdown serializer state */
interface MarkdownSerializerState {
  write(text: string): void;
  ensureNewLine(): void;
}

export interface PageBreakOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create<PageBreakOptions>({
  name: 'pageBreak',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  draggable: true,

  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState) {
          state.write('<!-- pagebreak -->\n\n');
        },
        parse: {
          // HTML comments are passed through by Marked; parseHTML handles them
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="pageBreak"]',
      },
      // Also parse the old comment-based format
      {
        tag: 'p',
        getAttrs: (node) => {
          if (typeof node === 'string') return false;
          const text = (node as HTMLElement).innerHTML;
          return text.includes('<!-- pagebreak -->') ? {} : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'pageBreak',
        class: 'page-break',
        style: 'page-break-before: always; break-before: page;',
      }),
      ['div', { class: 'page-break-label' }, 'Page Break'],
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-Enter': () => this.editor.commands.insertPageBreak(),
    };
  },
});

export default PageBreak;
