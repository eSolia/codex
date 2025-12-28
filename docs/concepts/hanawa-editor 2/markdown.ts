// Hanawa Markdown Parser
// Bidirectional conversion between Markdown and HTML with custom block support

import { marked, type Tokens } from 'marked';
import TurndownService from 'turndown';

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN → HTML
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert Hanawa-flavored Markdown to HTML
 */
export function markdownToHTML(markdown: string): string {
  const customMarked = new marked.Marked();

  customMarked.use({
    extensions: [
      calloutExtension,
      statusBadgeExtension,
      evidenceLinkExtension,
      privacyMaskExtension,
      tocExtension,
    ],
  });

  return customMarked.parse(markdown) as string;
}

// Callout blocks: :::type{title="..."}
const calloutExtension: marked.TokenizerAndRendererExtension = {
  name: 'callout',
  level: 'block',
  start(src: string) {
    return src.match(/^:::/)?.index;
  },
  tokenizer(src: string) {
    const match = /^:::(\w+)(?:\{title="([^"]+)"\})?\n([\s\S]*?)\n:::/.exec(src);
    if (match) {
      return {
        type: 'callout',
        raw: match[0],
        calloutType: match[1],
        title: match[2],
        content: match[3],
      };
    }
  },
  renderer(token: any) {
    const titleAttr = token.title ? ` data-title="${escapeHtml(token.title)}"` : '';
    const content = marked.parse(token.content);
    return `<div data-callout="${token.calloutType}"${titleAttr}>${content}</div>\n`;
  },
};

// Status badges: {status:compliant id="..."}
const statusBadgeExtension: marked.TokenizerAndRendererExtension = {
  name: 'statusBadge',
  level: 'inline',
  start(src: string) {
    return src.match(/\{status:/)?.index;
  },
  tokenizer(src: string) {
    const match = /^\{status:(\w+(?:-\w+)*)(?:\s+id="([^"]+)")?(?:\s+text="([^"]+)")?\}/.exec(src);
    if (match) {
      return {
        type: 'statusBadge',
        raw: match[0],
        status: match[1],
        controlId: match[2],
        text: match[3] || formatStatusLabel(match[1]),
      };
    }
  },
  renderer(token: any) {
    const idAttr = token.controlId ? ` data-control-id="${escapeHtml(token.controlId)}"` : '';
    return `<span data-status="${token.status}"${idAttr}>${escapeHtml(token.text)}</span>`;
  },
};

// Evidence links: [text]{evidence id="..." type="..."}
const evidenceLinkExtension: marked.TokenizerAndRendererExtension = {
  name: 'evidenceLink',
  level: 'inline',
  start(src: string) {
    return src.match(/\[[^\]]+\]\{evidence/)?.index;
  },
  tokenizer(src: string) {
    const match = /^\[([^\]]+)\]\{evidence\s+id="([^"]+)"(?:\s+type="([^"]+)")?\}/.exec(src);
    if (match) {
      return {
        type: 'evidenceLink',
        raw: match[0],
        text: match[1],
        evidenceId: match[2],
        fileType: match[3],
      };
    }
  },
  renderer(token: any) {
    const typeAttr = token.fileType ? ` data-file-type="${token.fileType}"` : '';
    return `<a data-evidence data-evidence-id="${token.evidenceId}"${typeAttr} href="/api/evidence/${token.evidenceId}">${escapeHtml(token.text)}</a>`;
  },
};

// Privacy masks: {mask type="pii"}content{/mask}
const privacyMaskExtension: marked.TokenizerAndRendererExtension = {
  name: 'privacyMask',
  level: 'inline',
  start(src: string) {
    return src.match(/\{mask\s/)?.index;
  },
  tokenizer(src: string) {
    const match = /^\{mask\s+type="(\w+)"(?:\s+placeholder="([^"]+)")?\}([^{]+)\{\/mask\}/.exec(src);
    if (match) {
      return {
        type: 'privacyMask',
        raw: match[0],
        maskType: match[1],
        placeholder: match[2],
        content: match[3],
      };
    }
  },
  renderer(token: any) {
    const placeholder = token.placeholder || getDefaultPlaceholder(token.maskType);
    return `<span data-privacy-mask data-mask-type="${token.maskType}" data-placeholder="${escapeHtml(placeholder)}">${escapeHtml(token.content)}</span>`;
  },
};

// Table of contents: [[toc]]
const tocExtension: marked.TokenizerAndRendererExtension = {
  name: 'toc',
  level: 'block',
  start(src: string) {
    return src.match(/^\[\[toc\]\]/)?.index;
  },
  tokenizer(src: string) {
    const match = /^\[\[toc\]\]/.exec(src);
    if (match) {
      return { type: 'toc', raw: match[0] };
    }
  },
  renderer() {
    return '<nav data-toc class="toc"><div class="toc-header">Table of Contents</div><ul class="toc-list"></ul></nav>\n';
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// HTML → MARKDOWN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert HTML back to Hanawa-flavored Markdown
 */
export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // Callout rule
  turndown.addRule('callout', {
    filter: (node) => node.nodeName === 'DIV' && node.hasAttribute('data-callout'),
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const type = el.getAttribute('data-callout') || 'info';
      const title = el.getAttribute('data-title');
      const titleAttr = title ? `{title="${title}"}` : '';
      return `\n:::${type}${titleAttr}\n${content.trim()}\n:::\n\n`;
    },
  });

  // Status badge rule
  turndown.addRule('statusBadge', {
    filter: (node) => node.nodeName === 'SPAN' && node.hasAttribute('data-status'),
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const status = el.getAttribute('data-status') || 'pending-review';
      const controlId = el.getAttribute('data-control-id');
      const idAttr = controlId ? ` id="${controlId}"` : '';
      const textAttr = content !== formatStatusLabel(status) ? ` text="${content}"` : '';
      return `{status:${status}${idAttr}${textAttr}}`;
    },
  });

  // Evidence link rule
  turndown.addRule('evidenceLink', {
    filter: (node) =>
      node.nodeName === 'A' &&
      (node.hasAttribute('data-evidence') || node.hasAttribute('data-evidence-id')),
    replacement: (content, node) => {
      const el = node as HTMLAnchorElement;
      const evidenceId = el.getAttribute('data-evidence-id') || '';
      const fileType = el.getAttribute('data-file-type');
      const typeAttr = fileType ? ` type="${fileType}"` : '';
      return `[${content}]{evidence id="${evidenceId}"${typeAttr}}`;
    },
  });

  // Privacy mask rule
  turndown.addRule('privacyMask', {
    filter: (node) => node.nodeName === 'SPAN' && node.hasAttribute('data-privacy-mask'),
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const maskType = el.getAttribute('data-mask-type') || 'pii';
      const placeholder = el.getAttribute('data-placeholder');
      const placeholderAttr =
        placeholder && placeholder !== getDefaultPlaceholder(maskType)
          ? ` placeholder="${placeholder}"`
          : '';
      return `{mask type="${maskType}"${placeholderAttr}}${content}{/mask}`;
    },
  });

  // TOC rule
  turndown.addRule('tableOfContents', {
    filter: (node) => node.nodeName === 'NAV' && node.hasAttribute('data-toc'),
    replacement: () => '\n[[toc]]\n\n',
  });

  return turndown.turndown(html);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportOptions {
  /** Show actual content instead of placeholders for masked content */
  revealPrivacy?: boolean;
  /** Include table of contents block */
  includeToc?: boolean;
  /** YAML front matter to prepend */
  frontMatter?: Record<string, unknown>;
}

/**
 * Export HTML to Markdown with options for privacy and front matter
 */
export function exportToMarkdown(html: string, options: ExportOptions = {}): string {
  let markdown = htmlToMarkdown(html);

  // Replace masked content with placeholders if privacy not revealed
  if (!options.revealPrivacy) {
    markdown = markdown.replace(
      /\{mask type="(\w+)"(?:\s+placeholder="([^"]+)")?\}[^{]+\{\/mask\}/g,
      (_, type, placeholder) => placeholder || getDefaultPlaceholder(type)
    );
  }

  // Remove TOC if not included
  if (!options.includeToc) {
    markdown = markdown.replace(/\[\[toc\]\]\n*/g, '');
  }

  // Add front matter
  if (options.frontMatter && Object.keys(options.frontMatter).length > 0) {
    const yaml = Object.entries(options.frontMatter)
      .map(([key, value]) =>
        typeof value === 'string' ? `${key}: "${value}"` : `${key}: ${JSON.stringify(value)}`
      )
      .join('\n');

    markdown = `---\n${yaml}\n---\n\n${markdown}`;
  }

  return markdown;
}

/**
 * Import Markdown with front matter parsing
 */
export function importFromMarkdown(markdown: string): {
  html: string;
  frontMatter: Record<string, unknown>;
} {
  let content = markdown;
  let frontMatter: Record<string, unknown> = {};

  // Parse YAML front matter
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (match) {
    content = markdown.slice(match[0].length);

    const lines = match[1].split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value: unknown = line.slice(colonIndex + 1).trim();

        // Remove quotes from string values
        if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }

        // Try parsing JSON for complex values
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            value = JSON.parse(value);
          } catch {
            // Keep as string
          }
        }

        frontMatter[key] = value;
      }
    }
  }

  return { html: markdownToHTML(content), frontMatter };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    compliant: 'Compliant',
    'non-compliant': 'Non-Compliant',
    'in-progress': 'In Progress',
    'not-applicable': 'Not Applicable',
    'pending-review': 'Pending Review',
  };
  return labels[status] || status;
}

function getDefaultPlaceholder(maskType: string): string {
  const placeholders: Record<string, string> = {
    pii: '[PERSONAL INFO REDACTED]',
    internal: '[INTERNAL]',
    financial: '[FINANCIAL DATA REDACTED]',
    technical: '[SYSTEM DETAILS REDACTED]',
    custom: '[REDACTED]',
  };
  return placeholders[maskType] || placeholders.custom;
}
