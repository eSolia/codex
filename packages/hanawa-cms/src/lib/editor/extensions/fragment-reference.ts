/**
 * Fragment Reference Extension for Tiptap
 * Embeds reusable content fragments from the CMS
 *
 * Markdown syntax: {{fragment:path/to-fragment lang="en"}}
 * InfoSec: Fragment IDs validated server-side before rendering
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface FragmentReferenceOptions {
  HTMLAttributes: Record<string, unknown>;
  onFragmentLoad?: (id: string, lang: string) => Promise<string | null>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fragmentReference: {
      insertFragment: (id: string, lang?: string) => ReturnType;
      updateFragmentLang: (lang: string) => ReturnType;
    };
  }
}

export const FragmentReference = Node.create<FragmentReferenceOptions>({
  name: "fragmentReference",

  addOptions() {
    return {
      HTMLAttributes: {},
      onFragmentLoad: undefined,
    };
  },

  group: "block",

  atom: true,

  addAttributes() {
    return {
      fragmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-fragment-id"),
        // InfoSec: Sanitize fragment ID (OWASP A03)
        renderHTML: (attributes) => ({
          "data-fragment-id": String(attributes.fragmentId || "").replace(
            /[^a-zA-Z0-9\-_/]/g,
            ""
          ),
        }),
      },
      lang: {
        default: "en",
        parseHTML: (element) => element.getAttribute("data-fragment-lang") || "en",
        renderHTML: (attributes) => ({
          "data-fragment-lang": attributes.lang,
        }),
      },
      preview: {
        default: null,
        parseHTML: () => null, // Never parse from HTML
        renderHTML: () => ({}), // Never render to HTML
      },
      loading: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
      error: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-fragment-id]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const fragmentId = node.attrs.fragmentId;
    const lang = node.attrs.lang;
    const loading = node.attrs.loading;
    const error = node.attrs.error;
    const preview = node.attrs.preview;

    let content: string;
    if (loading) {
      content = "Loading fragment...";
    } else if (error) {
      content = `Error: ${error}`;
    } else if (preview) {
      content = preview;
    } else {
      content = `Fragment: ${fragmentId}`;
    }

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: `fragment-reference border-l-4 border-esolia-orange bg-gray-50 p-4 my-4 rounded-r ${loading ? "opacity-50" : ""} ${error ? "border-red-500 bg-red-50" : ""}`,
        "data-fragment-id": fragmentId,
        "data-fragment-lang": lang,
        contenteditable: "false",
      }),
      [
        "div",
        { class: "flex items-center justify-between mb-2" },
        [
          "span",
          { class: "text-xs font-medium text-gray-500 uppercase" },
          `Fragment • ${lang.toUpperCase()}`,
        ],
        [
          "code",
          { class: "text-xs bg-white px-2 py-1 rounded border" },
          fragmentId,
        ],
      ],
      [
        "div",
        { class: "fragment-preview text-sm" },
        content,
      ],
    ];
  },

  addCommands() {
    return {
      insertFragment:
        (id: string, lang = "en") =>
        ({ commands }) => {
          // InfoSec: Sanitize fragment ID before insertion
          const sanitizedId = id.replace(/[^a-zA-Z0-9\-_/]/g, "");
          return commands.insertContent({
            type: this.name,
            attrs: { fragmentId: sanitizedId, lang },
          });
        },
      updateFragmentLang:
        (lang: string) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);

          if (node?.type.name !== this.name) return false;

          if (dispatch) {
            const tr = state.tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              lang,
            });
            dispatch(tr);
          }

          return true;
        },
    };
  },
});

export default FragmentReference;
