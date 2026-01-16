/**
 * Mermaid Block Extension for Tiptap
 * Renders Mermaid diagrams with live preview and code editing
 *
 * InfoSec: Mermaid code sanitized by library (OWASP A03)
 * Note: Uses dynamic import to avoid Vite bundling issues in production
 */

import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { NodeView, EditorView } from '@tiptap/pm/view';

// Lazy-loaded mermaid instance
let mermaidInstance: typeof import('mermaid').default | null = null;
let mermaidInitialized = false;

// Initialize mermaid lazily on first use
async function getMermaid() {
  if (!mermaidInstance) {
    const mermaidModule = await import('mermaid');
    mermaidInstance = mermaidModule.default;
  }

  if (!mermaidInitialized && mermaidInstance) {
    // InfoSec: securityLevel 'strict' prevents script injection (OWASP A03)
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: 'neutral',
      securityLevel: 'strict',
      fontFamily: 'IBM Plex Sans, sans-serif',
    });
    mermaidInitialized = true;
  }

  return mermaidInstance;
}

export interface MermaidBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaidBlock: {
      insertMermaid: (source?: string) => ReturnType;
      updateMermaidSource: (source: string) => ReturnType;
    };
  }
}

// Custom NodeView for Mermaid blocks
class MermaidNodeView implements NodeView {
  node: ProseMirrorNode;
  view: EditorView;
  getPos: () => number | undefined;
  dom: HTMLElement;
  contentDOM?: HTMLElement;

  private isEditing = false;
  private diagramContainer: HTMLElement;
  private editorContainer: HTMLElement;
  private textarea: HTMLTextAreaElement;
  private captionEnInput: HTMLInputElement;
  private captionJaInput: HTMLInputElement;
  private errorDisplay: HTMLElement;

  constructor(node: ProseMirrorNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    // Create DOM structure
    this.dom = document.createElement('div');
    this.dom.className = 'mermaid-block';
    this.dom.setAttribute('data-type', 'mermaidBlock');

    // Header
    const header = document.createElement('div');
    header.className = 'mermaid-header';
    const svgPath = node.attrs.svgPath;
    const statusBadge = svgPath
      ? '<span class="mermaid-status mermaid-status-exported" title="SVG exported to R2">✓ R2</span>'
      : '<span class="mermaid-status mermaid-status-pending" title="Not yet exported to R2">Local</span>';
    header.innerHTML = `
      <span class="mermaid-type-label">Mermaid Diagram ${statusBadge}</span>
      <div class="mermaid-actions">
        <button type="button" class="mermaid-export-btn" title="Export SVG to R2 for PDF">Export</button>
        <button type="button" class="mermaid-edit-btn">Edit</button>
        <button type="button" class="mermaid-delete-btn">×</button>
      </div>
    `;
    this.dom.appendChild(header);

    // Export button handler
    const exportBtn = header.querySelector('.mermaid-export-btn') as HTMLButtonElement;
    exportBtn.addEventListener('click', () => this.exportToR2());

    // Edit button handler
    const editBtn = header.querySelector('.mermaid-edit-btn') as HTMLButtonElement;
    editBtn.addEventListener('click', () => this.toggleEdit());

    // Delete button handler
    const deleteBtn = header.querySelector('.mermaid-delete-btn') as HTMLButtonElement;
    deleteBtn.addEventListener('click', () => this.deleteBlock());

    // Diagram container (visible in view mode)
    this.diagramContainer = document.createElement('div');
    this.diagramContainer.className = 'mermaid-diagram';
    this.dom.appendChild(this.diagramContainer);

    // Error display
    this.errorDisplay = document.createElement('div');
    this.errorDisplay.className = 'mermaid-error hidden';
    this.dom.appendChild(this.errorDisplay);

    // Editor container (visible in edit mode)
    this.editorContainer = document.createElement('div');
    this.editorContainer.className = 'mermaid-editor hidden';

    // Source textarea
    const sourceLabel = document.createElement('label');
    sourceLabel.textContent = 'Diagram Code';
    sourceLabel.className = 'mermaid-label';
    this.editorContainer.appendChild(sourceLabel);

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'mermaid-source';
    this.textarea.rows = 10;
    this.textarea.spellcheck = false;
    this.textarea.value = node.attrs.source;
    this.textarea.addEventListener('input', () => this.handleSourceChange());
    this.editorContainer.appendChild(this.textarea);

    // Caption fields
    const captionGrid = document.createElement('div');
    captionGrid.className = 'mermaid-caption-grid';

    // EN caption
    const enGroup = document.createElement('div');
    enGroup.className = 'mermaid-caption-group';
    const enLabel = document.createElement('label');
    enLabel.textContent = 'Caption (EN)';
    enLabel.className = 'mermaid-label';
    this.captionEnInput = document.createElement('input');
    this.captionEnInput.type = 'text';
    this.captionEnInput.className = 'mermaid-caption-input';
    this.captionEnInput.value = node.attrs.caption || '';
    this.captionEnInput.addEventListener('input', () => this.handleCaptionChange());
    enGroup.appendChild(enLabel);
    enGroup.appendChild(this.captionEnInput);
    captionGrid.appendChild(enGroup);

    // JA caption
    const jaGroup = document.createElement('div');
    jaGroup.className = 'mermaid-caption-group';
    const jaLabel = document.createElement('label');
    jaLabel.textContent = 'Caption (JA)';
    jaLabel.className = 'mermaid-label';
    this.captionJaInput = document.createElement('input');
    this.captionJaInput.type = 'text';
    this.captionJaInput.className = 'mermaid-caption-input';
    this.captionJaInput.value = node.attrs.caption_ja || '';
    this.captionJaInput.addEventListener('input', () => this.handleCaptionChange());
    jaGroup.appendChild(jaLabel);
    jaGroup.appendChild(this.captionJaInput);
    captionGrid.appendChild(jaGroup);

    this.editorContainer.appendChild(captionGrid);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'mermaid-save-btn';
    saveBtn.textContent = 'Save Changes';
    saveBtn.addEventListener('click', () => this.toggleEdit());
    this.editorContainer.appendChild(saveBtn);

    this.dom.appendChild(this.editorContainer);

    // Caption display (view mode)
    const captionDisplay = document.createElement('p');
    captionDisplay.className = 'mermaid-caption-display';
    if (node.attrs.caption) {
      captionDisplay.textContent = node.attrs.caption;
    }
    this.dom.appendChild(captionDisplay);

    // Render initial diagram
    this.renderDiagram();
  }

  private async renderDiagram() {
    const source = this.textarea?.value || this.node.attrs.source;
    if (!source) {
      this.diagramContainer.innerHTML =
        "<p class='mermaid-placeholder'>Enter Mermaid code to render diagram</p>";
      return;
    }

    try {
      // Dynamically load mermaid on first render
      const mermaid = await getMermaid();
      if (!mermaid) {
        throw new Error('Failed to load Mermaid library');
      }

      const id = `mermaid-${crypto.randomUUID()}`;
      const { svg } = await mermaid.render(id, source);
      this.diagramContainer.innerHTML = svg;
      this.errorDisplay.classList.add('hidden');
      this.errorDisplay.textContent = '';
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Render error';
      this.errorDisplay.textContent = message;
      this.errorDisplay.classList.remove('hidden');
      // Keep last valid diagram if there is one
      if (!this.diagramContainer.querySelector('svg')) {
        this.diagramContainer.innerHTML =
          "<p class='mermaid-placeholder'>Fix syntax to render diagram</p>";
      }
    }
  }

  private toggleEdit() {
    this.isEditing = !this.isEditing;
    const editBtn = this.dom.querySelector('.mermaid-edit-btn') as HTMLButtonElement;

    if (this.isEditing) {
      this.editorContainer.classList.remove('hidden');
      editBtn.textContent = 'Preview';
      this.textarea.focus();
    } else {
      this.editorContainer.classList.add('hidden');
      editBtn.textContent = 'Edit';
      this.renderDiagram();
    }
  }

  private handleSourceChange() {
    const pos = this.getPos();
    if (pos === undefined) return;

    const source = this.textarea.value;

    // Update node attributes
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      source,
    });
    this.view.dispatch(tr);

    // Debounced render
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
    this.renderTimeout = setTimeout(() => this.renderDiagram(), 300);
  }

  private renderTimeout?: ReturnType<typeof setTimeout>;

  private handleCaptionChange() {
    const pos = this.getPos();
    if (pos === undefined) return;

    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      caption: this.captionEnInput.value,
      caption_ja: this.captionJaInput.value,
    });
    this.view.dispatch(tr);

    // Update display
    const display = this.dom.querySelector('.mermaid-caption-display');
    if (display) {
      display.textContent = this.captionEnInput.value;
    }
  }

  private deleteBlock() {
    const pos = this.getPos();
    if (pos === undefined) return;

    const tr = this.view.state.tr.delete(pos, pos + this.node.nodeSize);
    this.view.dispatch(tr);
  }

  private async exportToR2() {
    const pos = this.getPos();
    if (pos === undefined) return;

    // Get the rendered SVG from the diagram container
    const svgElement = this.diagramContainer.querySelector('svg');
    if (!svgElement) {
      this.errorDisplay.textContent = 'No diagram to export. Please render the diagram first.';
      this.errorDisplay.classList.remove('hidden');
      return;
    }

    // Clone and clean up the SVG
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    // Add XML declaration and namespace if missing
    if (!svgClone.getAttribute('xmlns')) {
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    const svgString = new XMLSerializer().serializeToString(svgClone);

    // Generate a unique ID for this diagram
    const diagramId = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Update button to show loading state
    const exportBtn = this.dom.querySelector('.mermaid-export-btn') as HTMLButtonElement;
    const originalText = exportBtn.textContent;
    exportBtn.textContent = 'Exporting...';
    exportBtn.disabled = true;

    try {
      // Upload SVG to R2 via API
      const response = await fetch('/api/diagrams/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: diagramId,
          svg: svgString,
          source: this.node.attrs.source,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Upload failed');
      }

      const result = (await response.json()) as { success: boolean; path: string; url: string };
      const svgPath = result.path; // e.g., "diagrams/mermaid-xxx.svg"

      // Update the node's svgPath attribute
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        svgPath,
      });
      this.view.dispatch(tr);

      // Update the status badge
      const statusSpan = this.dom.querySelector('.mermaid-status');
      if (statusSpan) {
        statusSpan.className = 'mermaid-status mermaid-status-exported';
        statusSpan.textContent = '✓ R2';
        statusSpan.setAttribute('title', `Exported to ${svgPath}`);
      }

      // Show success message with save reminder
      this.errorDisplay.className = 'mermaid-success';
      this.errorDisplay.textContent = '✓ Exported! Save the document to use in PDF.';
      this.errorDisplay.classList.remove('hidden');
      console.log('[Mermaid] Exported to R2:', svgPath);
    } catch (err) {
      console.error('[Mermaid] Export error:', err);
      this.errorDisplay.textContent = `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
      this.errorDisplay.classList.remove('hidden');
    } finally {
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;
    }
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;

    // Sync textarea if not focused
    if (document.activeElement !== this.textarea) {
      this.textarea.value = node.attrs.source;
    }

    // Sync status badge with current svgPath
    const statusSpan = this.dom.querySelector('.mermaid-status');
    if (statusSpan) {
      const svgPath = node.attrs.svgPath;
      if (svgPath) {
        statusSpan.className = 'mermaid-status mermaid-status-exported';
        statusSpan.textContent = '✓ R2';
        statusSpan.setAttribute('title', `Exported to ${svgPath}`);
      } else {
        statusSpan.className = 'mermaid-status mermaid-status-pending';
        statusSpan.textContent = 'Local';
        statusSpan.setAttribute('title', 'Not yet exported to R2');
      }
    }

    // Sync caption inputs if not focused
    if (document.activeElement !== this.captionEnInput) {
      this.captionEnInput.value = node.attrs.caption || '';
    }
    if (document.activeElement !== this.captionJaInput) {
      this.captionJaInput.value = node.attrs.caption_ja || '';
    }

    return true;
  }

  selectNode() {
    this.dom.classList.add('ProseMirror-selectednode');
  }

  deselectNode() {
    this.dom.classList.remove('ProseMirror-selectednode');
  }

  stopEvent(event: Event): boolean {
    // Allow interactions within the node view
    return (
      event.target instanceof HTMLElement &&
      (event.target.closest('.mermaid-editor') !== null ||
        event.target.closest('.mermaid-actions') !== null)
    );
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy() {
    if (this.renderTimeout) clearTimeout(this.renderTimeout);
  }
}

export const MermaidBlock = Node.create<MermaidBlockOptions>({
  name: 'mermaidBlock',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      source: {
        default: 'flowchart TB\n  A[Start] --> B[End]',
        parseHTML: (element) => element.getAttribute('data-source') || '',
        renderHTML: (attributes) => ({
          'data-source': attributes.source,
        }),
      },
      caption: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption') || '',
        renderHTML: (attributes) =>
          attributes.caption ? { 'data-caption': attributes.caption } : {},
      },
      caption_ja: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-caption-ja') || '',
        renderHTML: (attributes) =>
          attributes.caption_ja ? { 'data-caption-ja': attributes.caption_ja } : {},
      },
      svgPath: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-svg-path') || '',
        renderHTML: (attributes) =>
          attributes.svgPath ? { 'data-svg-path': attributes.svgPath } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaidBlock"]',
      },
      // Also parse legacy format
      {
        tag: 'div[data-type="mermaid"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mermaidBlock',
        class: 'mermaid-block',
      }),
      // Include diagram container for view mode rendering
      ['div', { class: 'mermaid-diagram' }],
    ];
  },

  addNodeView() {
    return ({ node, view, getPos }) => {
      return new MermaidNodeView(node, view, getPos as () => number | undefined);
    };
  },

  addCommands() {
    return {
      insertMermaid:
        (source?: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              source: source || 'flowchart TB\n  A[Start] --> B[End]',
            },
          });
        },
      updateMermaidSource:
        (source: string) =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const node = state.doc.nodeAt(selection.from);

          if (node?.type.name !== this.name) return false;

          if (dispatch) {
            const tr = state.tr.setNodeMarkup(selection.from, undefined, {
              ...node.attrs,
              source,
            });
            dispatch(tr);
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => this.editor.commands.insertMermaid(),
    };
  },
});

export default MermaidBlock;
