import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitizeHtml,
  sanitizeComment,
  sanitizeUrl,
  highlightSearchMatch,
} from './sanitize';

describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;'
    );
  });

  it('escapes ampersands and special chars', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('sanitizeHtml', () => {
  it('removes script tags and content', () => {
    expect(sanitizeHtml('<p>Hello</p><script>alert("xss")</script>')).toBe('<p>Hello</p>');
  });

  it('removes style tags and content', () => {
    expect(sanitizeHtml('<p>Text</p><style>body{display:none}</style>')).toBe('<p>Text</p>');
  });

  it('removes event handler attributes', () => {
    const result = sanitizeHtml('<div onclick="alert(1)">test</div>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('<div>test</div>');
  });

  it('preserves allowed tags', () => {
    const input = '<p><strong>bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('removes iframe tags', () => {
    expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).toBe('');
  });

  it('removes javascript: protocol from href', () => {
    const result = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});

describe('sanitizeComment', () => {
  it('allows only strict tag subset', () => {
    const result = sanitizeComment('<strong>bold</strong> <em>italic</em> <code>code</code>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<code>code</code>');
  });

  it('removes script tags', () => {
    expect(sanitizeComment('<script>alert(1)</script>Hello')).toBe('Hello');
  });

  it('strips disallowed tags like div', () => {
    expect(sanitizeComment('<div>content</div>')).toBe('content');
  });
});

describe('sanitizeUrl', () => {
  it('blocks javascript: protocol', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
  });

  it('blocks data: protocol', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('');
  });

  it('preserves safe https URLs', () => {
    expect(sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('preserves safe http URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('returns empty string for null/undefined', () => {
    expect(sanitizeUrl(null)).toBe('');
    expect(sanitizeUrl(undefined)).toBe('');
  });
});

describe('highlightSearchMatch', () => {
  it('prevents XSS in text content', () => {
    const result = highlightSearchMatch('<script>alert(1)</script>', 'alert');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('<mark>alert</mark>');
  });

  it('returns escaped text for empty query', () => {
    expect(highlightSearchMatch('<b>test</b>', '')).toBe('&lt;b&gt;test&lt;&#x2F;b&gt;');
  });

  it('highlights multiple words', () => {
    const result = highlightSearchMatch('hello world today', 'hello today');
    expect(result).toContain('<mark>hello</mark>');
    expect(result).toContain('<mark>today</mark>');
  });
});
