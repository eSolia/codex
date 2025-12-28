// Hanawa Status Badge Extension
// Inline compliance status markers

import { Mark, mergeAttributes } from '@tiptap/core';

export type StatusType =
  | 'compliant'
  | 'non-compliant'
  | 'in-progress'
  | 'not-applicable'
  | 'pending-review';

export interface StatusBadgeAttributes {
  status: StatusType;
  controlId?: string;
  lastUpdated?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statusBadge: {
      setStatusBadge: (attributes: StatusBadgeAttributes) => ReturnType;
      unsetStatusBadge: () => ReturnType;
      updateStatusBadge: (attributes: Partial<StatusBadgeAttributes>) => ReturnType;
    };
  }
}

export const StatusBadgeExtension = Mark.create({
  name: 'statusBadge',
  excludes: 'statusBadge',
  spanning: false,

  addAttributes() {
    return {
      status: {
        default: 'pending-review',
        parseHTML: (element) => element.getAttribute('data-status') || 'pending-review',
        renderHTML: (attributes) => ({ 'data-status': attributes.status }),
      },
      controlId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-control-id'),
        renderHTML: (attributes) => {
          if (!attributes.controlId) return {};
          return { 'data-control-id': attributes.controlId };
        },
      },
      lastUpdated: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-last-updated'),
        renderHTML: (attributes) => {
          if (!attributes.lastUpdated) return {};
          return { 'data-last-updated': attributes.lastUpdated };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-status]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const status = HTMLAttributes['data-status'] as StatusType;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: `status-badge status-${status}`,
        role: 'status',
        'aria-label': `Status: ${formatStatusLabel(status)}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setStatusBadge:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, {
            ...attributes,
            lastUpdated: new Date().toISOString(),
          }),

      unsetStatusBadge:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),

      updateStatusBadge:
        (attributes) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            ...attributes,
            lastUpdated: new Date().toISOString(),
          }),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-s': () => {
        const { from } = this.editor.state.selection;
        const marks = this.editor.state.doc.nodeAt(from)?.marks || [];
        const statusMark = marks.find((m) => m.type.name === this.name);

        if (statusMark) {
          const currentStatus = statusMark.attrs.status as StatusType;
          const nextStatus = getNextStatus(currentStatus);
          return this.editor.commands.updateStatusBadge({ status: nextStatus });
        }

        return this.editor.commands.setStatusBadge({ status: 'pending-review' });
      },
    };
  },
});

function formatStatusLabel(status: StatusType): string {
  const labels: Record<StatusType, string> = {
    compliant: 'Compliant',
    'non-compliant': 'Non-Compliant',
    'in-progress': 'In Progress',
    'not-applicable': 'Not Applicable',
    'pending-review': 'Pending Review',
  };
  return labels[status] || status;
}

function getNextStatus(current: StatusType): StatusType {
  const cycle: StatusType[] = [
    'pending-review',
    'in-progress',
    'compliant',
    'non-compliant',
    'not-applicable',
  ];
  const currentIndex = cycle.indexOf(current);
  return cycle[(currentIndex + 1) % cycle.length];
}
