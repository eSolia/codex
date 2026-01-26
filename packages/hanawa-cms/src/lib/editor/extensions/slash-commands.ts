/**
 * Slash Commands Extension for Tiptap
 * Notion-style "/" menu for inserting block types
 *
 * InfoSec: No external dependencies, all commands validated
 */

import { Extension } from '@tiptap/core';
import Suggestion, { type SuggestionOptions } from '@tiptap/suggestion';
import type { Editor, Range } from '@tiptap/core';
import tippy, { type Instance as TippyInstance } from 'tippy.js';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

// Available slash commands
const slashCommands: SlashCommandItem[] = [
  {
    title: 'Paragraph',
    description: 'Plain text block',
    icon: '📝',
    keywords: ['text', 'paragraph', 'p'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    keywords: ['h1', 'heading', 'title'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    keywords: ['h2', 'heading', 'subtitle'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    keywords: ['h3', 'heading'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: '•',
    keywords: ['bullet', 'list', 'ul'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: '1.',
    keywords: ['numbered', 'list', 'ol', 'ordered'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: 'Task List',
    description: 'Checklist with checkboxes',
    icon: '☑️',
    keywords: ['task', 'todo', 'checklist', 'checkbox'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: 'Mermaid Diagram',
    description: 'Flowchart or diagram',
    icon: '📊',
    keywords: ['mermaid', 'diagram', 'flowchart', 'chart', 'graph'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertMermaid().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: '💻',
    keywords: ['code', 'pre', 'codeblock'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: 'Quote',
    description: 'Block quote',
    icon: '❝',
    keywords: ['quote', 'blockquote'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: 'Info Callout',
    description: 'Informational note',
    icon: 'ℹ️',
    keywords: ['callout', 'info', 'note', 'tip'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('info').run();
    },
  },
  {
    title: 'Warning Callout',
    description: 'Warning or caution',
    icon: '⚠️',
    keywords: ['callout', 'warning', 'caution'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('warning').run();
    },
  },
  {
    title: 'Danger Callout',
    description: 'Critical warning',
    icon: '🚨',
    keywords: ['callout', 'danger', 'error', 'critical'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('danger').run();
    },
  },
  {
    title: 'Success Callout',
    description: 'Success or completion note',
    icon: '✅',
    keywords: ['callout', 'success', 'done', 'complete'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout('success').run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal line separator',
    icon: '—',
    keywords: ['divider', 'hr', 'horizontal', 'line'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    title: 'Page Break',
    description: 'Force new page in PDF',
    icon: '📄',
    keywords: ['page', 'break', 'newpage', 'pagebreak'],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertPageBreak().run();
    },
  },
  {
    title: 'Table',
    description: 'Insert a table',
    icon: '📋',
    keywords: ['table', 'grid'],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
  {
    title: 'Fragment',
    description: 'Embed a reusable fragment',
    icon: '🧩',
    keywords: ['fragment', 'embed', 'include', 'reference', 'reuse'],
    command: ({ editor, range }) => {
      // Prompt for fragment ID (e.g., "diagrams/network-topology" or "proposals/esolia-intro")
      const fragmentId = prompt(
        'Enter fragment ID (e.g., diagrams/my-diagram or proposals/intro):'
      );
      if (fragmentId && fragmentId.trim()) {
        const lang = document.documentElement.lang === 'ja' ? 'ja' : 'en';
        editor.chain().focus().deleteRange(range).insertFragment(fragmentId.trim(), lang).run();
      }
    },
  },
];

// Create the slash menu DOM element
function createSlashMenuElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'slash-menu';
  return el;
}

// Render the menu items
function renderMenuItems(
  element: HTMLElement,
  items: SlashCommandItem[],
  selectedIndex: number,
  onSelect: (index: number) => void
): void {
  element.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'slash-menu-empty';
    empty.textContent = 'No matching commands';
    element.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `slash-menu-item ${index === selectedIndex ? 'selected' : ''}`;
    button.innerHTML = `
      <span class="slash-menu-icon">${item.icon}</span>
      <div class="slash-menu-content">
        <span class="slash-menu-title">${item.title}</span>
        <span class="slash-menu-description">${item.description}</span>
      </div>
    `;
    button.addEventListener('click', () => onSelect(index));
    button.addEventListener('mouseenter', () => {
      // Update selection on hover
      element.querySelectorAll('.slash-menu-item').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
      });
    });
    element.appendChild(button);
  });

  // Scroll selected item into view
  const selected = element.querySelector('.slash-menu-item.selected');
  if (selected) {
    selected.scrollIntoView({ block: 'nearest' });
  }
}

export interface SlashCommandsOptions {
  suggestion: Partial<SuggestionOptions<SlashCommandItem>>;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  onCreate() {
    console.log('[SlashCommands] Extension created');
  },

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => {
          console.log('[SlashCommands] Command selected:', props);
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    console.log('[SlashCommands] Adding ProseMirror plugins');
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        ...this.options.suggestion,

        items: ({ query }: { query: string }) => {
          console.log('[SlashCommands] Query:', query);
          const search = query.toLowerCase();
          const results = slashCommands.filter(
            (item) =>
              item.title.toLowerCase().includes(search) ||
              item.keywords.some((k) => k.includes(search))
          );
          console.log('[SlashCommands] Results:', results.length);
          return results;
        },

        render: () => {
          let element: HTMLElement;
          let popup: TippyInstance[];
          let selectedIndex = 0;
          let items: SlashCommandItem[] = [];
          let commandFn: ((item: SlashCommandItem) => void) | null = null;

          const selectItem = (index: number) => {
            const item = items[index];
            if (item && commandFn) {
              commandFn(item);
            }
          };

          return {
            onStart: (props) => {
              console.log('[SlashCommands] onStart, items:', props.items.length);
              element = createSlashMenuElement();
              items = props.items;
              selectedIndex = 0;
              commandFn = props.command;

              renderMenuItems(element, items, selectedIndex, selectItem);

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                theme: 'slash-menu',
                maxWidth: 320,
              });
            },

            onUpdate(props) {
              items = props.items;
              selectedIndex = 0;
              commandFn = props.command;

              renderMenuItems(element, items, selectedIndex, selectItem);

              popup[0].setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }

              if (props.event.key === 'ArrowUp') {
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                renderMenuItems(element, items, selectedIndex, selectItem);
                return true;
              }

              if (props.event.key === 'ArrowDown') {
                selectedIndex = (selectedIndex + 1) % items.length;
                renderMenuItems(element, items, selectedIndex, selectItem);
                return true;
              }

              if (props.event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
              }

              return false;
            },

            onExit() {
              popup[0].destroy();
              element.remove();
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommands;
