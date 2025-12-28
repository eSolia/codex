// Hanawa Privacy Mask Extension
// Redactable content for external sharing

import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type MaskType = 'pii' | 'internal' | 'financial' | 'technical' | 'custom';

export interface PrivacyMaskAttributes {
  maskType: MaskType;
  placeholder?: string;
  reason?: string;
}

export interface PrivacyMaskOptions {
  enabled: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    privacyMask: {
      setPrivacyMask: (attributes?: Partial<PrivacyMaskAttributes>) => ReturnType;
      unsetPrivacyMask: () => ReturnType;
      togglePrivacyMask: (attributes?: Partial<PrivacyMaskAttributes>) => ReturnType;
      updatePrivacyMaskType: (maskType: MaskType) => ReturnType;
      updatePrivacyMasks: (options: { enabled: boolean }) => ReturnType;
    };
  }
}

const privacyMaskPluginKey = new PluginKey('privacyMask');

export const PrivacyMaskExtension = Mark.create<PrivacyMaskOptions>({
  name: 'privacyMask',

  addOptions() {
    return { enabled: false };
  },

  addAttributes() {
    return {
      maskType: {
        default: 'pii',
        parseHTML: (element) => element.getAttribute('data-mask-type') || 'pii',
        renderHTML: (attributes) => ({ 'data-mask-type': attributes.maskType }),
      },
      placeholder: {
        default: '[REDACTED]',
        parseHTML: (element) => element.getAttribute('data-placeholder') || '[REDACTED]',
        renderHTML: (attributes) => ({ 'data-placeholder': attributes.placeholder }),
      },
      reason: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-mask-reason'),
        renderHTML: (attributes) => {
          if (!attributes.reason) return {};
          return { 'data-mask-reason': attributes.reason };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-privacy-mask]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const maskType = HTMLAttributes['data-mask-type'] || 'pii';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-privacy-mask': '',
        class: `privacy-mask mask-${maskType}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setPrivacyMask:
        (attributes = {}) =>
        ({ commands }) =>
          commands.setMark(this.name, {
            maskType: 'pii',
            placeholder: getDefaultPlaceholder(attributes.maskType || 'pii'),
            ...attributes,
          }),

      unsetPrivacyMask:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      togglePrivacyMask:
        (attributes = {}) =>
        ({ commands }) =>
          commands.toggleMark(this.name, {
            maskType: 'pii',
            placeholder: getDefaultPlaceholder(attributes.maskType || 'pii'),
            ...attributes,
          }),

      updatePrivacyMaskType:
        (maskType: MaskType) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            maskType,
            placeholder: getDefaultPlaceholder(maskType),
          }),

      updatePrivacyMasks:
        (options) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(privacyMaskPluginKey, options);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: privacyMaskPluginKey,
        state: {
          init() {
            return { enabled: extension.options.enabled };
          },
          apply(tr, value) {
            const meta = tr.getMeta(privacyMaskPluginKey);
            if (meta) return { ...value, ...meta };
            return value;
          },
        },
        props: {
          decorations(state) {
            const pluginState = this.getState(state);
            if (!pluginState?.enabled) return DecorationSet.empty;

            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (!node.isText) return;

              const marks = node.marks.filter(
                (mark) => mark.type.name === extension.name
              );

              for (const mark of marks) {
                const from = pos;
                const to = pos + node.nodeSize;
                const placeholder = mark.attrs.placeholder || '[REDACTED]';

                decorations.push(
                  Decoration.inline(from, to, {
                    class: 'privacy-mask-active',
                    'data-masked-content': placeholder,
                  })
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-p': () => this.editor.commands.togglePrivacyMask(),
    };
  },
});

function getDefaultPlaceholder(maskType: MaskType): string {
  const placeholders: Record<MaskType, string> = {
    pii: '[PERSONAL INFO REDACTED]',
    internal: '[INTERNAL]',
    financial: '[FINANCIAL DATA REDACTED]',
    technical: '[SYSTEM DETAILS REDACTED]',
    custom: '[REDACTED]',
  };
  return placeholders[maskType] || placeholders.custom;
}
