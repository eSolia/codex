// Hanawa Callout Extension
// Alert blocks for info, warning, danger, success, note

import { Node, mergeAttributes } from '@tiptap/core';

export type CalloutType = 'info' | 'warning' | 'danger' | 'success' | 'note';

export interface CalloutAttributes {
  type: CalloutType;
  title?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: Partial<CalloutAttributes>) => ReturnType;
      toggleCallout: (attributes?: Partial<CalloutAttributes>) => ReturnType;
      unsetCallout: () => ReturnType;
      updateCalloutType: (type: CalloutType) => ReturnType;
      updateCalloutTitle: (title: string) => ReturnType;
    };
  }
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-callout') || 'info',
        renderHTML: (attributes) => ({ 'data-callout': attributes.type }),
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes) => {
          if (!attributes.title) return {};
          return { 'data-title': attributes.title };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type as CalloutType;
    const title = node.attrs.title as string | null;

    const iconMap: Record<CalloutType, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      danger: '🚨',
      success: '✅',
      note: '📝',
    };

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `callout callout-${type}`,
        role: 'alert',
      }),
      ...(title
        ? [[
            'div',
            { class: 'callout-title' },
            ['span', { class: 'callout-icon' }, iconMap[type] || 'ℹ️'],
            ['span', { class: 'callout-title-text' }, title],
          ]]
        : []),
      ['div', { class: 'callout-content' }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attributes = {}) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { type: 'info', ...attributes }),

      toggleCallout:
        (attributes = {}) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { type: 'info', ...attributes }),

      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),

      updateCalloutType:
        (type: CalloutType) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { type }),

      updateCalloutTitle:
        (title: string) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { title }),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.toggleCallout(),
    };
  },
});
