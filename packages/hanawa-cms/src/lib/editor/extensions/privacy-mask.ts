/**
 * Privacy Mask Extension for Tiptap
 * Marks sensitive content for optional redaction on export
 *
 * Markdown syntax: {mask type="pii"}content{/mask}
 * InfoSec: Core security feature for sensitive content protection (OWASP A01)
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export type MaskType = 'pii' | 'financial' | 'internal' | 'technical' | 'custom';

export interface PrivacyMaskOptions {
  HTMLAttributes: Record<string, unknown>;
  privacyMode: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    privacyMask: {
      setPrivacyMask: (type: MaskType) => ReturnType;
      togglePrivacyMask: (type: MaskType) => ReturnType;
      unsetPrivacyMask: () => ReturnType;
    };
  }
}

export const PrivacyMask = Mark.create<PrivacyMaskOptions>({
  name: 'privacyMask',

  addOptions() {
    return {
      HTMLAttributes: {},
      privacyMode: false, // When true, content is visually obscured
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'pii',
        parseHTML: (element) => element.getAttribute('data-mask-type') || 'pii',
        renderHTML: (attributes) => ({
          'data-mask-type': attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mask-type]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-mask-type'] as MaskType;

    const maskColors: Record<MaskType, string> = {
      pii: 'bg-purple-100 border-purple-300',
      financial: 'bg-green-100 border-green-300',
      internal: 'bg-gray-100 border-gray-300',
      technical: 'bg-blue-100 border-blue-300',
      custom: 'bg-yellow-100 border-yellow-300',
    };

    const maskIcons: Record<MaskType, string> = {
      pii: '👤',
      financial: '💰',
      internal: '🔒',
      technical: '⚙️',
      custom: '🏷️',
    };

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `privacy-mask inline px-1 border rounded ${maskColors[type]} ${this.options.privacyMode ? 'privacy-mode-active' : ''}`,
        'data-mask-type': type,
        'data-mask-icon': maskIcons[type],
        title: `${type.toUpperCase()} - Sensitive content`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setPrivacyMask:
        (type: MaskType) =>
        ({ commands }) => {
          return commands.setMark(this.name, { type });
        },
      togglePrivacyMask:
        (type: MaskType) =>
        ({ commands }) => {
          return commands.toggleMark(this.name, { type });
        },
      unsetPrivacyMask:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-p': () => this.editor.commands.togglePrivacyMask('pii'),
    };
  },
});

export default PrivacyMask;
