// Hanawa Table of Contents Extension
// Auto-generated navigation from headings

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface TocItem {
  level: number;
  text: string;
  id: string;
  pos: number;
}

export interface TableOfContentsOptions {
  levels: number[];
  title: string;
  scrollOffset: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableOfContents: {
      insertTableOfContents: () => ReturnType;
      removeTableOfContents: () => ReturnType;
      refreshTableOfContents: () => ReturnType;
    };
  }
}

const tocPluginKey = new PluginKey('tableOfContents');

export const TableOfContentsExtension = Node.create<TableOfContentsOptions>({
  name: 'tableOfContents',
  group: 'block',
  atom: true,

  addOptions() {
    return {
      levels: [1, 2, 3, 4],
      title: 'Table of Contents',
      scrollOffset: 80,
    };
  },

  addAttributes() {
    return {
      title: {
        default: this.options.title,
        parseHTML: (element) => element.getAttribute('data-title') || this.options.title,
        renderHTML: (attributes) => ({ 'data-title': attributes.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'nav[data-toc]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'nav',
      mergeAttributes(HTMLAttributes, {
        'data-toc': '',
        class: 'toc',
        role: 'navigation',
        'aria-label': 'Table of contents',
      }),
      ['div', { class: 'toc-header' }, HTMLAttributes['data-title'] || this.options.title],
      ['ul', { class: 'toc-list' }],
    ];
  },

  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { title: this.options.title },
          }),

      removeTableOfContents:
        () =>
        ({ state, tr, dispatch }) => {
          let tocPos: number | null = null;

          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name) {
              tocPos = pos;
              return false;
            }
          });

          if (tocPos !== null && dispatch) {
            tr.delete(tocPos, tocPos + 1);
            dispatch(tr);
            return true;
          }

          return false;
        },

      refreshTableOfContents:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(tocPluginKey, { refresh: true });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: tocPluginKey,
        view(editorView) {
          const updateToc = () => {
            const headings = extractHeadings(
              editorView.state.doc,
              extension.options.levels
            );
            renderTocContent(editorView.dom, headings, extension.options);
          };

          setTimeout(updateToc, 0);

          return {
            update(view, prevState) {
              if (!view.state.doc.eq(prevState.doc)) {
                updateToc();
              }
            },
          };
        },
      }),
    ];
  },
});

function extractHeadings(doc: any, levels: number[]): TocItem[] {
  const headings: TocItem[] = [];

  doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'heading' && levels.includes(node.attrs.level)) {
      const text = node.textContent;
      const id = generateAnchorId(text, headings);

      headings.push({ level: node.attrs.level, text, id, pos });
    }
  });

  return headings;
}

function generateAnchorId(text: string, existing: TocItem[]): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  let id = base || 'heading';
  let counter = 1;

  while (existing.some((h) => h.id === id)) {
    id = `${base}-${counter}`;
    counter++;
  }

  return id;
}

function renderTocContent(
  editorDom: Element,
  headings: TocItem[],
  options: TableOfContentsOptions
) {
  const tocNav = editorDom.querySelector('nav[data-toc]');
  if (!tocNav) return;

  let tocList = tocNav.querySelector('.toc-list');
  if (!tocList) {
    tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    tocNav.appendChild(tocList);
  }

  tocList.innerHTML = '';

  if (headings.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'toc-empty';
    emptyItem.textContent = 'No headings found';
    tocList.appendChild(emptyItem);
    return;
  }

  for (const heading of headings) {
    const li = document.createElement('li');
    li.className = `toc-item toc-h${heading.level}`;

    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.text;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToHeading(heading.id, options.scrollOffset);
    });

    li.appendChild(link);
    tocList.appendChild(li);
  }

  // Add IDs to actual headings
  const headingElements = editorDom.querySelectorAll('h1, h2, h3, h4');
  let headingIndex = 0;

  headingElements.forEach((el) => {
    if (headingIndex < headings.length) {
      el.id = headings[headingIndex].id;
      headingIndex++;
    }
  });
}

function scrollToHeading(id: string, offset: number) {
  const element = document.getElementById(id);
  if (element) {
    const y = element.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

/**
 * Get document headings for external use
 */
export function getDocumentHeadings(editor: any): TocItem[] {
  return extractHeadings(editor.state.doc, [1, 2, 3, 4]);
}
