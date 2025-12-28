/**
 * Block Editor Type Definitions
 * Types for block-based content storage and rendering
 *
 * InfoSec: All block content validated via Zod schemas
 */

import { z } from 'zod';

// Block types
export const BlockType = z.enum([
  'paragraph',
  'heading',
  'mermaid',
  'code',
  'image',
  'table',
  'blockquote',
  'callout',
  'fragment',
  'hr',
]);

export type BlockType = z.infer<typeof BlockType>;

// Base block structure
export const BlockMetaSchema = z.object({
  collapsed: z.boolean().optional(),
  language: z.enum(['en', 'ja', 'both']).optional(),
});

export type BlockMeta = z.infer<typeof BlockMetaSchema>;

// Type-specific data schemas
export const ParagraphDataSchema = z.object({
  content: z.string(),
  content_ja: z.string().optional(),
});

export const HeadingDataSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  content: z.string(),
  content_ja: z.string().optional(),
});

export const MermaidDataSchema = z.object({
  source: z.string(),
  caption: z.string().optional(),
  caption_ja: z.string().optional(),
});

export const CodeDataSchema = z.object({
  language: z.string(),
  code: z.string(),
});

export const ImageDataSchema = z.object({
  assetId: z.string(),
  alt: z.string(),
  alt_ja: z.string().optional(),
  caption: z.string().optional(),
  caption_ja: z.string().optional(),
});

export const CalloutDataSchema = z.object({
  type: z.enum(['info', 'warning', 'danger', 'success']),
  title: z.string().optional(),
  title_ja: z.string().optional(),
  content: z.string(),
  content_ja: z.string().optional(),
});

export const FragmentDataSchema = z.object({
  fragmentId: z.string(),
  overrides: z.record(z.string()).optional(),
});

export const TableDataSchema = z.object({
  html: z.string(), // Store as HTML from Tiptap
});

export const HrDataSchema = z.object({});

// Block data union
export const BlockDataSchema = z.union([
  ParagraphDataSchema,
  HeadingDataSchema,
  MermaidDataSchema,
  CodeDataSchema,
  ImageDataSchema,
  CalloutDataSchema,
  FragmentDataSchema,
  TableDataSchema,
  HrDataSchema,
]);

export type BlockData = z.infer<typeof BlockDataSchema>;
export type ParagraphData = z.infer<typeof ParagraphDataSchema>;
export type HeadingData = z.infer<typeof HeadingDataSchema>;
export type MermaidData = z.infer<typeof MermaidDataSchema>;
export type CodeData = z.infer<typeof CodeDataSchema>;
export type ImageData = z.infer<typeof ImageDataSchema>;
export type CalloutData = z.infer<typeof CalloutDataSchema>;
export type FragmentData = z.infer<typeof FragmentDataSchema>;

// Full block schema
export const BlockSchema = z.object({
  id: z.string(),
  type: BlockType,
  data: BlockDataSchema,
  meta: BlockMetaSchema.optional(),
});

export type Block = z.infer<typeof BlockSchema>;

// Block document (full content structure)
export const BlockDocumentSchema = z.object({
  version: z.literal(1),
  blocks: z.array(BlockSchema),
  locale: z.enum(['en', 'ja', 'both']),
});

export type BlockDocument = z.infer<typeof BlockDocumentSchema>;

// Content format type
export const ContentFormat = z.enum(['html', 'blocks']);
export type ContentFormat = z.infer<typeof ContentFormat>;

// Helper functions

/**
 * Create an empty block document
 */
export function createEmptyDocument(locale: 'en' | 'ja' | 'both' = 'en'): BlockDocument {
  return {
    version: 1,
    blocks: [],
    locale,
  };
}

/**
 * Create a new block with a unique ID
 */
export function createBlock(type: BlockType, data: BlockData, meta?: BlockMeta): Block {
  return {
    id: crypto.randomUUID(),
    type,
    data,
    meta,
  };
}

/**
 * Migrate HTML content to a single-block document
 */
export function migrateHtmlToBlocks(html: string, html_ja?: string): BlockDocument {
  return {
    version: 1,
    locale: html_ja ? 'both' : 'en',
    blocks: [
      {
        id: crypto.randomUUID(),
        type: 'paragraph',
        data: {
          content: html,
          content_ja: html_ja,
        } as ParagraphData,
      },
    ],
  };
}

/**
 * Validate and parse a block document from JSON
 */
export function parseBlockDocument(json: string): BlockDocument | null {
  try {
    const parsed = JSON.parse(json);
    return BlockDocumentSchema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Serialize a block document to JSON
 */
export function serializeBlockDocument(doc: BlockDocument): string {
  return JSON.stringify(doc);
}
