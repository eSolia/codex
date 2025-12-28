// Hanawa Evidence Link Extension
// Links to R2-stored compliance evidence documents

import { Mark, mergeAttributes } from '@tiptap/core';

export interface EvidenceLinkAttributes {
  evidenceId: string;
  fileType?: 'pdf' | 'image' | 'document' | 'spreadsheet' | 'other';
  uploadedAt?: string;
  uploadedBy?: string;
  accessLevel?: 'public' | 'internal' | 'confidential';
  href?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    evidenceLink: {
      setEvidenceLink: (attributes: EvidenceLinkAttributes) => ReturnType;
      unsetEvidenceLink: () => ReturnType;
      updateEvidenceLink: (attributes: Partial<EvidenceLinkAttributes>) => ReturnType;
    };
  }
}

export const EvidenceLinkExtension = Mark.create({
  name: 'evidenceLink',
  excludes: 'link',
  group: 'link',

  addAttributes() {
    return {
      evidenceId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-evidence-id'),
        renderHTML: (attributes) => ({ 'data-evidence-id': attributes.evidenceId }),
      },
      fileType: {
        default: 'other',
        parseHTML: (element) => element.getAttribute('data-file-type') || 'other',
        renderHTML: (attributes) => ({ 'data-file-type': attributes.fileType }),
      },
      uploadedAt: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-uploaded'),
        renderHTML: (attributes) => {
          if (!attributes.uploadedAt) return {};
          return { 'data-uploaded': attributes.uploadedAt };
        },
      },
      uploadedBy: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-uploaded-by'),
        renderHTML: (attributes) => {
          if (!attributes.uploadedBy) return {};
          return { 'data-uploaded-by': attributes.uploadedBy };
        },
      },
      accessLevel: {
        default: 'internal',
        parseHTML: (element) => element.getAttribute('data-access-level') || 'internal',
        renderHTML: (attributes) => ({ 'data-access-level': attributes.accessLevel }),
      },
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('href'),
        renderHTML: (attributes) => {
          const href = attributes.href || `/api/evidence/${attributes.evidenceId}`;
          return { href };
        },
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'a[data-evidence]' },
      { tag: 'a[data-evidence-id]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const fileType = HTMLAttributes['data-file-type'] || 'other';
    const accessLevel = HTMLAttributes['data-access-level'] || 'internal';

    const iconMap: Record<string, string> = {
      pdf: '📄',
      image: '🖼️',
      document: '📝',
      spreadsheet: '📊',
      other: '📎',
    };

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-evidence': '',
        class: `evidence-link evidence-${fileType} access-${accessLevel}`,
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
      ['span', { class: 'evidence-icon' }, iconMap[fileType] || '📎'],
      ['span', { class: 'evidence-text' }, 0],
    ];
  },

  addCommands() {
    return {
      setEvidenceLink:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, {
            ...attributes,
            uploadedAt: attributes.uploadedAt || new Date().toISOString().slice(0, 10),
          }),

      unsetEvidenceLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      updateEvidenceLink:
        (attributes) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attributes),
    };
  },
});
