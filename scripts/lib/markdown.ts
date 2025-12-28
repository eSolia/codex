/**
 * Markdown Processing Library
 * Converts markdown to HTML with custom extensions
 */

// Simple markdown to HTML without syntax highlighting
// (keeps dependencies minimal for scripts)

/**
 * Simple markdown to HTML converter
 * Handles: headings, bold, italic, lists, tables, links, code blocks, blockquotes
 */
function simpleMarkdownToHtml(md: string): string {
  let html = md;

  // Remove HTML comments before processing
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Escape HTML (but not our already-processed content)
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code blocks (before other processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Tables
  html = html.replace(
    /^\|(.+)\|$/gm,
    (match) => {
      // Handle escaped pipes by replacing them with a placeholder
      const escapedMatch = match.replace(/\\\|/g, "___PIPE___");
      const cells = escapedMatch.slice(1, -1).split("|").map(c => c.trim().replace(/___PIPE___/g, "|"));
      // Check if it's a separator row
      if (cells.every(c => /^-+$/.test(c))) {
        return "___TABLE_SEP___";
      }
      return "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
    }
  );

  // Wrap table rows - match header + separator + only consecutive <tr> rows
  html = html.replace(
    /(<tr>.*?<\/tr>)\n___TABLE_SEP___\n((?:<tr>.*?<\/tr>\n?)+)/g,
    (_, header, body) => {
      // Convert first row to th
      const theadRow = header.replace(/<td>/g, "<th>").replace(/<\/td>/g, "</th>");
      return `<table><thead>${theadRow}</thead><tbody>${body}</tbody></table>`;
    }
  );

  // Clean up any remaining table separators
  html = html.replace(/___TABLE_SEP___/g, "");

  // Unordered lists
  html = html.replace(/^(\s*)-\s+(.+)$/gm, "$1<li>$2</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)\n(?!<li>)/g, "<ul>$1</ul>\n");

  // Ordered lists
  html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, "$1<li>$2</li>");

  // Paragraphs (wrap loose text)
  html = html.replace(/^(?!<[a-z]|$)(.+)$/gm, "<p>$1</p>");

  // Clean up empty paragraphs and extra whitespace
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/\n{3,}/g, "\n\n");

  return html;
}

/**
 * Custom callout syntax: :::type{title="..."}
 */
function processCallouts(html: string): string {
  // Pattern: :::type{title="Title"} ... :::
  const calloutPattern = /:::(info|warning|danger|success)(?:\{title="([^"]+)"\})?\s*([\s\S]*?):::/g;

  return html.replace(calloutPattern, (_, type, title, content) => {
    const titleHtml = title ? `<div class="callout-title">${title}</div>` : "";
    return `<div class="callout ${type}">${titleHtml}${content.trim()}</div>`;
  });
}

/**
 * Convert > **CONFIDENTIAL** blocks to styled notices
 */
function processConfidentialBlocks(html: string): string {
  return html.replace(
    /<blockquote>\s*<p><strong>CONFIDENTIAL<\/strong>/gi,
    '<div class="confidential"><p><strong>CONFIDENTIAL</strong>'
  ).replace(
    /<\/p>\s*<\/blockquote>/g,
    (match) => match.includes("confidential") ? "</p></div>" : match
  );
}

/**
 * Add classes to tables for styling
 */
function processTables(html: string): string {
  // Tables with only 2 columns and first column is bold = key-value table
  return html.replace(/<table>/g, '<table class="data-table">');
}

/**
 * Convert markdown to styled HTML
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  // First pass: convert markdown to HTML
  let html = simpleMarkdownToHtml(markdown);

  // Second pass: process custom syntax
  html = processCallouts(html);
  html = processConfidentialBlocks(html);
  html = processTables(html);

  return html;
}

/**
 * Extract frontmatter from markdown
 */
export function extractFrontmatter(
  markdown: string
): { frontmatter: Record<string, unknown>; content: string } {
  const frontmatterPattern = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = markdown.match(frontmatterPattern);

  if (!match) {
    return { frontmatter: {}, content: markdown };
  }

  // Simple YAML-like parsing for frontmatter
  const frontmatter: Record<string, unknown> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();

      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      frontmatter[key] = value;
    }
  }

  const content = markdown.slice(match[0].length);
  return { frontmatter, content };
}

/**
 * Generate table of contents from markdown headings
 */
export function generateToc(html: string): string {
  const headingPattern = /<h([23])[^>]*>(.*?)<\/h\1>/g;
  const headings: { level: number; text: string; id: string }[] = [];

  let match;
  while ((match = headingPattern.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, ""); // Strip HTML tags
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    headings.push({ level, text, id });
  }

  if (headings.length === 0) return "";

  let toc = '<nav class="toc"><h2>Table of Contents</h2><ul>';
  for (const h of headings) {
    const indent = h.level === 3 ? "margin-left: 1rem;" : "";
    toc += `<li style="${indent}"><a href="#${h.id}">${h.text}</a></li>`;
  }
  toc += "</ul></nav>";

  return toc;
}

/**
 * Replace [[toc]] placeholder with generated TOC
 */
export function replaceTocPlaceholder(html: string, toc: string): string {
  // Handle both escaped and unescaped versions
  return html
    .replace(/\[\[toc\]\]/gi, toc)
    .replace(/&lt;p&gt;\[\[toc\]\]&lt;\/p&gt;/gi, toc)
    .replace(/<p>\[\[toc\]\]<\/p>/gi, toc);
}

/**
 * Add IDs to headings for TOC links
 */
export function addHeadingIds(html: string): string {
  return html.replace(/<h([23456])>([^<]+)<\/h\1>/g, (_, level, text) => {
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    return `<h${level} id="${id}">${text}</h${level}>`;
  });
}
