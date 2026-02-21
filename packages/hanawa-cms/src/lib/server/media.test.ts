import { describe, it, expect } from 'vitest';
import { sanitizeFilename, ALLOWED_MIME_TYPES } from './media';

describe('sanitizeFilename', () => {
  it('preserves normal filenames (lowercase, dashes)', () => {
    expect(sanitizeFilename('my-image.png')).toBe('my-image.png');
  });

  it('strips path separators from traversal attempts', () => {
    const result = sanitizeFilename('../../etc/passwd');
    expect(result).not.toContain('/');
    // Dots are preserved (needed for extensions) but slashes are removed,
    // neutralizing path traversal
    expect(result).toBe('....etcpasswd');
  });

  it('strips unicode and special characters', () => {
    const result = sanitizeFilename('file<name>&"test".png');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('&');
    expect(result).not.toContain('"');
  });

  it('converts spaces to dashes', () => {
    expect(sanitizeFilename('my file name.jpg')).toBe('my-file-name.jpg');
  });

  it('truncates long filenames to 100 chars', () => {
    const longName = 'a'.repeat(150) + '.png';
    const result = sanitizeFilename(longName);
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('preserves file extension', () => {
    const result = sanitizeFilename('document.pdf');
    expect(result).toBe('document.pdf');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeFilename('')).toBe('');
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  it('contains expected image types', () => {
    expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/svg+xml')).toBe(true);
  });

  it('contains expected document types', () => {
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('text/csv')).toBe(true);
  });

  it('does NOT contain executable types', () => {
    expect(ALLOWED_MIME_TYPES.has('application/x-executable')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('application/javascript')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('text/html')).toBe(false);
  });
});
