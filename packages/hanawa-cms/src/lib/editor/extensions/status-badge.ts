/**
 * Status Badge Extension for Tiptap
 * Inline compliance/workflow status markers
 *
 * Markdown syntax: {status:compliant id="..."}
 * InfoSec: Status IDs sanitized to prevent injection
 */

import { Node, mergeAttributes } from "@tiptap/core";

export type StatusType =
  | "compliant"
  | "non-compliant"
  | "in-progress"
  | "not-applicable"
  | "pending-review";

export interface StatusBadgeOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    statusBadge: {
      setStatusBadge: (status: StatusType, id?: string) => ReturnType;
      cycleStatus: () => ReturnType;
    };
  }
}

const STATUS_ORDER: StatusType[] = [
  "pending-review",
  "in-progress",
  "compliant",
  "non-compliant",
  "not-applicable",
];

export const StatusBadge = Node.create<StatusBadgeOptions>({
  name: "statusBadge",

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: "inline",

  inline: true,

  atom: true,

  addAttributes() {
    return {
      status: {
        default: "pending-review",
        parseHTML: (element) =>
          element.getAttribute("data-status") || "pending-review",
        renderHTML: (attributes) => ({
          "data-status": attributes.status,
        }),
      },
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-status-id"),
        // InfoSec: Sanitize ID to prevent XSS (OWASP A03)
        renderHTML: (attributes) =>
          attributes.id
            ? { "data-status-id": String(attributes.id).replace(/[<>"'&]/g, "") }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-status]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const status = node.attrs.status as StatusType;

    const statusClasses: Record<StatusType, string> = {
      compliant: "bg-green-100 text-green-800 border-green-200",
      "non-compliant": "bg-red-100 text-red-800 border-red-200",
      "in-progress": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "not-applicable": "bg-gray-100 text-gray-800 border-gray-200",
      "pending-review": "bg-blue-100 text-blue-800 border-blue-200",
    };

    const statusLabels: Record<StatusType, string> = {
      compliant: "Compliant",
      "non-compliant": "Non-Compliant",
      "in-progress": "In Progress",
      "not-applicable": "N/A",
      "pending-review": "Pending Review",
    };

    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `status-badge inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusClasses[status]}`,
        "data-status": status,
        contenteditable: "false",
      }),
      statusLabels[status],
    ];
  },

  addCommands() {
    return {
      setStatusBadge:
        (status: StatusType, id?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { status, id },
          });
        },
      cycleStatus:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);

          if (node?.type.name !== this.name) return false;

          const currentStatus = node.attrs.status as StatusType;
          const currentIndex = STATUS_ORDER.indexOf(currentStatus);
          const nextIndex = (currentIndex + 1) % STATUS_ORDER.length;
          const nextStatus = STATUS_ORDER[nextIndex];

          if (dispatch) {
            const tr = state.tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              status: nextStatus,
            });
            dispatch(tr);
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-s": () => this.editor.commands.cycleStatus(),
    };
  },
});

export default StatusBadge;
