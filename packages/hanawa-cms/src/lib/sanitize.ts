/**
 * HTML Sanitization Module for Hanawa CMS
 * InfoSec: Prevents XSS attacks by sanitizing all user-generated HTML content
 *
 * OWASP A03:2021 - Injection Prevention
 * Every {@html} usage MUST pass through these functions.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Standard HTML sanitization for user content
 * Allows safe formatting tags, removes scripts and dangerous attributes
 *
 * InfoSec: Primary defense against stored XSS
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
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
    ],
    ALLOWED_ATTR: [
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
    ],
    // Sanitize URLs
    ALLOW_DATA_ATTR: true,
    // Only allow safe URL protocols
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // Prevent DOM clobbering
    SANITIZE_DOM: true,
    // Strip dangerous CSS
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  });
}

/**
 * Strict sanitization for comments and user-generated content
 * More restrictive - only basic formatting allowed
 *
 * InfoSec: Used for comment content where less HTML is needed
 */
export function sanitizeComment(dirty: string | null | undefined): string {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['strong', 'em', 'code', 'br', 'p', 'a', 'mark'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
    ADD_ATTR: ['target'],
  });
}

/**
 * Sanitize content with highlighted search matches
 * Allows only <mark> tags for highlighting
 *
 * InfoSec: Used for search result highlighting
 */
export function sanitizeSearchResult(dirty: string | null | undefined): string {
  if (!dirty) return '';

  // First escape all HTML, then allow only mark tags
  const escaped = escapeHtml(dirty);
  return escaped;
}

/**
 * Escape HTML entities (no tags allowed)
 * Use when you need plain text display
 *
 * InfoSec: Complete XSS prevention - no HTML rendered
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';

  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
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

  const trimmed = url.trim().toLowerCase();

  // Block dangerous protocols
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:')
  ) {
    return '';
  }

  return url;
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
