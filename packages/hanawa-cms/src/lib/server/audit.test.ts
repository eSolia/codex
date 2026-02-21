import { describe, it, expect } from 'vitest';
import { computeChecksum } from './audit';

describe('computeChecksum', () => {
  it('is deterministic: same input produces same hash', async () => {
    const data = { action: 'create', actor: 'user@test.com', timestamp: 1234567890 };
    const hash1 = await computeChecksum(data);
    const hash2 = await computeChecksum(data);
    expect(hash1).toBe(hash2);
  });

  it('different inputs produce different hashes', async () => {
    const hash1 = await computeChecksum({ action: 'create', actor: 'a@test.com' });
    const hash2 = await computeChecksum({ action: 'delete', actor: 'a@test.com' });
    expect(hash1).not.toBe(hash2);
  });

  it('key ordering is independent (sorted internally)', async () => {
    const hash1 = await computeChecksum({ b: 2, a: 1 });
    const hash2 = await computeChecksum({ a: 1, b: 2 });
    expect(hash1).toBe(hash2);
  });

  it('excludes checksum field from hash input', async () => {
    const data = { action: 'create', actor: 'user@test.com' };
    const hashWithout = await computeChecksum(data);
    const hashWith = await computeChecksum({ ...data, checksum: 'abc123' });
    expect(hashWithout).toBe(hashWith);
  });

  it('returns 64-char hex string (SHA-256)', async () => {
    const hash = await computeChecksum({ test: 'data' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('empty object produces valid hash', async () => {
    const hash = await computeChecksum({});
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles null values in data', async () => {
    const hash = await computeChecksum({ field: null, other: 'value' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles nested objects', async () => {
    const hash = await computeChecksum({ meta: { nested: true }, action: 'test' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
