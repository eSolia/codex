/**
 * HTML Sanitization Module for Hanawa CMS
 * InfoSec: Prevents XSS attacks by sanitizing all user-generated HTML content
 *
 * OWASP A03:2021 - Injection Prevention
 * Every {@html} usage MUST pass through these functions.
 *
 * Note: This module uses regex-based sanitization to work in Cloudflare Workers
 * where DOM APIs are not available. For maximum security, content is also
 * validated on the server before storage.
 */

// Allowed HTML tags for rich content
const ALLOWED_TAGS = new Set([
  // Text formatting
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'mark',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'sub',
  'sup',
  'small',
  // Structure
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'blockquote',
  'hr',
  // Lists
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  // Tables
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'colgroup',
  'col',
  // Links and media
  'a',
  'img',
  'figure',
  'figcaption',
  // Task lists (Tiptap)
  'input',
  'label',
]);

// Allowed attributes (tag-agnostic for simplicity)
const ALLOWED_ATTRS = new Set([
  // Global
  'class',
  'id',
  'title',
  'lang',
  'dir',
  // Links
  'href',
  'target',
  'rel',
  // Images
  'src',
  'alt',
  'width',
  'height',
  'loading',
  // Tables
  'colspan',
  'rowspan',
  'scope',
  // Task checkboxes
  'type',
  'checked',
  'disabled',
  // Data attributes for Tiptap extensions
  'data-type',
  'data-status',
  'data-id',
  'data-level',
  'data-checked',
  'data-label',
  'data-callout-type',
  'data-fragment-id',
  'data-fragment-lang',
  'data-evidence-id',
  'data-evidence-type',
  'data-mask-type',
  // Mermaid diagram attributes
  'data-source',
  'data-caption',
  'data-caption-ja',
]);

// Dangerous attributes that should never be allowed
const FORBIDDEN_ATTRS = /^on\w+|^style$/i;

// Dangerous URL protocols
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data):/i;

/**
 * Escape HTML entities (no tags allowed)
 * Use when you need plain text display
 *
 * InfoSec: Complete XSS prevention - no HTML rendered
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Sanitize a URL, blocking dangerous protocols
 */
function sanitizeUrlValue(url: string): string {
  const trimmed = url.trim();
  if (DANGEROUS_PROTOCOLS.test(trimmed)) {
    return '';
  }
  return trimmed;
}

/**
 * Sanitize an HTML attribute value
 */
function sanitizeAttrValue(name: string, value: string): string {
  // Sanitize URL attributes
  if (name === 'href' || name === 'src') {
    return sanitizeUrlValue(value);
  }
  // Escape quotes in attribute values
  return value.replace(/"/g, '&quot;');
}

/**
 * Standard HTML sanitization for user content
 * Allows safe formatting tags, removes scripts and dangerous attributes
 *
 * InfoSec: Primary defense against stored XSS
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';

  // Remove script tags and their content completely
  let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove style tags and their content
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove comments
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  // Process tags
  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();

    // Remove disallowed tags entirely
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }

    // Parse and filter attributes
    const cleanAttrs: string[] = [];
    const attrRegex = /([a-z][a-z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
    let attrMatch;

    while ((attrMatch = attrRegex.exec(attrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

      // Skip forbidden attributes (event handlers, style)
      if (FORBIDDEN_ATTRS.test(attrName)) {
        continue;
      }

      // Only allow whitelisted attributes
      if (ALLOWED_ATTRS.has(attrName) || attrName.startsWith('data-')) {
        const sanitizedValue = sanitizeAttrValue(attrName, attrValue);
        if (sanitizedValue !== '' || attrName !== 'href') {
          cleanAttrs.push(`${attrName}="${sanitizedValue}"`);
        }
      }
    }

    // Handle boolean attributes without values
    const booleanAttrRegex = /\b(checked|disabled|readonly)\b(?!=)/gi;
    let boolMatch;
    while ((boolMatch = booleanAttrRegex.exec(attrs)) !== null) {
      const attrName = boolMatch[1].toLowerCase();
      if (ALLOWED_ATTRS.has(attrName)) {
        cleanAttrs.push(attrName);
      }
    }

    // Reconstruct the tag
    const attrsStr = cleanAttrs.length > 0 ? ' ' + cleanAttrs.join(' ') : '';

    // Self-closing tags
    if (['br', 'hr', 'img', 'input', 'col'].includes(tag)) {
      return `<${tag}${attrsStr} />`;
    }

    // Check if it's a closing tag
    if (match.startsWith('</')) {
      return `</${tag}>`;
    }

    return `<${tag}${attrsStr}>`;
  });

  return clean;
}

/**
 * Strict sanitization for comments and user-generated content
 * More restrictive - only basic formatting allowed
 *
 * InfoSec: Used for comment content where less HTML is needed
 */
export function sanitizeComment(dirty: string | null | undefined): string {
  if (!dirty) return '';

  const COMMENT_TAGS = new Set(['strong', 'em', 'code', 'br', 'p', 'a', 'mark']);

  // Remove all tags except allowed ones
  let clean = dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  clean = clean.replace(/<!--[\s\S]*?-->/g, '');

  clean = clean.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = tagName.toLowerCase();

    if (!COMMENT_TAGS.has(tag)) {
      return '';
    }

    // For links, preserve href
    if (tag === 'a') {
      const hrefMatch = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/i.exec(attrs);
      if (hrefMatch) {
        const href = sanitizeUrlValue(hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '');
        if (href && !DANGEROUS_PROTOCOLS.test(href)) {
          return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
        }
      }
      return '<a>';
    }

    if (match.startsWith('</')) {
      return `</${tag}>`;
    }

    if (tag === 'br') {
      return '<br />';
    }

    return `<${tag}>`;
  });

  return clean;
}

/**
 * Highlight search query matches in text
 * Safely escapes content and adds mark tags
 *
 * InfoSec: Safe highlighting that prevents XSS
 */
export function highlightSearchMatch(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text);

  // First escape the text to prevent XSS
  const escaped = escapeHtml(text);

  // Then add highlight marks for matching words
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  let result = escaped;
  for (const word of words) {
    // Escape regex special chars in the search word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedWord})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }

  return result;
}

/**
 * Validate and sanitize URLs
 * Returns empty string for dangerous URLs
 *
 * InfoSec: Prevents javascript: and data: URL injection
 */
export function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  return sanitizeUrlValue(url);
}

/**
 * Create a safe markdown renderer that sanitizes output
 * Use this instead of raw marked.parse()
 *
 * InfoSec: Wrapper for marked that ensures sanitization
 */
export function createSafeMarkdownRenderer(marked: { parse: (content: string) => string }) {
  return function renderMarkdownSafe(content: string | null | undefined): string {
    if (!content) return '';

    const html = marked.parse(content);
    return sanitizeHtml(html);
  };
}
