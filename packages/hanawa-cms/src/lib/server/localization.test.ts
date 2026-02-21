import { describe, it, expect } from 'vitest';
import { hashText, rowToTranslationStatus } from './localization';

describe('hashText', () => {
  it('is deterministic: same text produces same hash', async () => {
    const hash1 = await hashText('hello world');
    const hash2 = await hashText('hello world');
    expect(hash1).toBe(hash2);
  });

  it('is case-insensitive (lowercased before hashing)', async () => {
    const hash1 = await hashText('Hello World');
    const hash2 = await hashText('hello world');
    expect(hash1).toBe(hash2);
  });

  it('trims whitespace before hashing', async () => {
    const hash1 = await hashText('  hello  ');
    const hash2 = await hashText('hello');
    expect(hash1).toBe(hash2);
  });

  it('different text produces different hash', async () => {
    const hash1 = await hashText('hello');
    const hash2 = await hashText('world');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 64-char hex string (SHA-256)', async () => {
    const hash = await hashText('test string');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('rowToTranslationStatus', () => {
  it('maps all fields from row correctly', () => {
    const row = {
      id: 'ts1',
      document_id: 'doc1',
      document_type: 'content',
      locale: 'ja',
      status: 'in_progress',
      progress_percent: 50,
      translated_fields: '["title","excerpt"]',
      pending_fields: '["body"]',
      assigned_to: 'user@test.com',
      assigned_at: 1700000000,
      created_at: 1699000000,
      last_updated: 1700000000,
      completed_at: null,
      notes: 'In progress',
    };
    const result = rowToTranslationStatus(row);
    expect(result.id).toBe('ts1');
    expect(result.documentId).toBe('doc1');
    expect(result.documentType).toBe('content');
    expect(result.locale).toBe('ja');
    expect(result.status).toBe('in_progress');
    expect(result.progressPercent).toBe(50);
    expect(result.translatedFields).toEqual(['title', 'excerpt']);
    expect(result.pendingFields).toEqual(['body']);
    expect(result.assignedTo).toBe('user@test.com');
  });

  it('handles missing optional fields', () => {
    const row = {
      id: 'ts2',
      document_id: 'doc2',
      document_type: 'fragment',
      locale: 'en',
      status: 'pending',
      progress_percent: null,
      translated_fields: null,
      pending_fields: null,
      assigned_to: undefined,
      assigned_at: undefined,
      created_at: 1699000000,
      last_updated: 1699000000,
      completed_at: undefined,
      notes: undefined,
    };
    const result = rowToTranslationStatus(row);
    expect(result.progressPercent).toBe(0);
    expect(result.translatedFields).toEqual([]);
    expect(result.pendingFields).toEqual([]);
    expect(result.assignedTo).toBeUndefined();
    expect(result.completedAt).toBeUndefined();
  });
});
