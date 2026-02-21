import { describe, it, expect } from 'vitest';
import {
  securityLevels,
  encryptContent,
  decryptContent,
  deriveKey,
  getPreviewSecurityHeaders,
} from './security';

describe('securityLevels', () => {
  it('normal: watermark disabled, no maxViewDuration', () => {
    expect(securityLevels.normal.watermark).toBe(false);
    expect(securityLevels.normal.maxViewDuration).toBeNull();
    expect(securityLevels.normal.encryptAtRest).toBe(false);
  });

  it('confidential: watermark enabled, 30min max view, encrypt at rest', () => {
    expect(securityLevels.confidential.watermark).toBe(true);
    expect(securityLevels.confidential.maxViewDuration).toBe(30 * 60 * 1000);
    expect(securityLevels.confidential.encryptAtRest).toBe(true);
  });

  it('embargoed: all protections enabled, 10min max view, 3 max views', () => {
    expect(securityLevels.embargoed.watermark).toBe(true);
    expect(securityLevels.embargoed.blurOnUnfocus).toBe(true);
    expect(securityLevels.embargoed.viewAgreement).toBe(true);
    expect(securityLevels.embargoed.maxViewDuration).toBe(10 * 60 * 1000);
    expect(securityLevels.embargoed.previewMaxViews).toBe(3);
    expect(securityLevels.embargoed.encryptAtRest).toBe(true);
  });

  it('embargoed has shorter token expiry than confidential', () => {
    expect(securityLevels.embargoed.previewTokenExpiry).toBeLessThan(
      securityLevels.confidential.previewTokenExpiry
    );
  });
});

describe('encryptContent / decryptContent', () => {
  it('round-trip: encrypt then decrypt returns original', async () => {
    const key = await deriveKey('test-secret');
    const original = 'Hello, this is sensitive content.';
    const { encrypted, iv } = await encryptContent(original, key);
    const decrypted = await decryptContent(encrypted, iv, key);
    expect(decrypted).toBe(original);
  });

  it('produces different IVs for same content', async () => {
    const key = await deriveKey('test-secret');
    const content = 'Same content twice';
    const result1 = await encryptContent(content, key);
    const result2 = await encryptContent(content, key);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('round-trip with UTF-8 content (Japanese text)', async () => {
    const key = await deriveKey('test-secret');
    const original = 'Japanese text';
    const { encrypted, iv } = await encryptContent(original, key);
    const decrypted = await decryptContent(encrypted, iv, key);
    expect(decrypted).toBe(original);
  });

  it('round-trip with empty string', async () => {
    const key = await deriveKey('test-secret');
    const { encrypted, iv } = await encryptContent('', key);
    const decrypted = await decryptContent(encrypted, iv, key);
    expect(decrypted).toBe('');
  });
});

describe('deriveKey', () => {
  it('returns a CryptoKey usable for AES-GCM', async () => {
    const key = await deriveKey('my-secret');
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    // Verify it works by encrypting
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode('test');
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    expect(encrypted.byteLength).toBeGreaterThan(0);
  });

  it('same secret produces same key (deterministic via encrypt/decrypt)', async () => {
    const key1 = await deriveKey('same-secret');
    const key2 = await deriveKey('same-secret');
    // Verify by encrypting with key1 and decrypting with key2
    const { encrypted, iv } = await encryptContent('verification', key1);
    const decrypted = await decryptContent(encrypted, iv, key2);
    expect(decrypted).toBe('verification');
  });

  it('different secrets produce different keys', async () => {
    const key1 = await deriveKey('secret-a');
    const key2 = await deriveKey('secret-b');
    const { encrypted, iv } = await encryptContent('test data', key1);
    // Decrypting with a different key should fail
    await expect(decryptContent(encrypted, iv, key2)).rejects.toThrow();
  });
});

describe('getPreviewSecurityHeaders', () => {
  it('returns expected security headers', () => {
    const headers = getPreviewSecurityHeaders();
    expect(headers['Cache-Control']).toContain('no-store');
    expect(headers['X-Robots-Tag']).toContain('noindex');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('returns all 4 headers', () => {
    const headers = getPreviewSecurityHeaders();
    expect(Object.keys(headers)).toHaveLength(4);
  });
});
