/**
 * Zod v4 Validation Schemas for Hanawa CMS
 * InfoSec: Input validation prevents injection attacks (OWASP A03)
 */

import { z } from 'zod';

// ===========================================================================
// COMMON VALIDATIONS
// ===========================================================================

const slug = z
  .string({ message: 'Slug is required' })
  .min(1, 'Slug is required')
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
  .trim();

const sensitivity = z.enum(['normal', 'confidential', 'embargoed'], {
  message: 'Invalid sensitivity level',
});

const language = z.enum(['en', 'ja'], { message: 'Language must be en or ja' });

const contentStatus = z.enum(['draft', 'published', 'archived'], {
  message: 'Invalid status',
});

// ===========================================================================
// CONTENT SCHEMAS
// ===========================================================================

export const createContentSchema = z.object({
  title: z.string({ message: 'Title is required' }).min(1, 'Title is required').trim(),
  slug,
  site_id: z.string({ message: 'Site is required' }).min(1, 'Site is required'),
  content_type_id: z
    .string({ message: 'Content type is required' })
    .min(1, 'Content type is required'),
  sensitivity: sensitivity.default('normal'),
  language: language.default('en'),
});

export const saveContentSchema = z.object({
  title: z.string({ message: 'Title is required' }).min(1, 'Title is required').trim(),
  title_ja: z.string().trim().optional().or(z.literal('')),
  slug,
  body: z.string().optional().or(z.literal('')),
  body_ja: z.string().trim().optional().or(z.literal('')),
  excerpt: z.string().trim().optional().or(z.literal('')),
  excerpt_ja: z.string().trim().optional().or(z.literal('')),
  status: contentStatus.default('draft'),
  language: language.default('en'),
  sensitivity: sensitivity.default('normal'),
  site_id: z.string().trim().optional().or(z.literal('')),
  content_type_id: z.string().trim().optional().or(z.literal('')),
  tags: z.string().trim().optional().or(z.literal('')),
  metadata: z.string().trim().optional().or(z.literal('')),
  approved_for_preview: z.boolean().default(false),
  embargo_until: z.string().trim().optional().or(z.literal('')),
});

export const publishContentSchema = z.object({
  publish: z.literal('true'),
});

export const deleteContentSchema = z.object({
  confirm: z.literal('delete'),
});

// ===========================================================================
// FRAGMENT SCHEMAS
// ===========================================================================

export const createFragmentSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required').trim(),
  category: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  content_en: z.string().optional().or(z.literal('')),
  content_ja: z.string().optional().or(z.literal('')),
  tags: z.string().trim().optional().or(z.literal('')),
});

export const saveFragmentSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required').trim(),
  content_en: z.string().optional().or(z.literal('')),
  content_ja: z.string().optional().or(z.literal('')),
  content_encoding: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  tags: z.string().optional().or(z.literal('')),
});

export const deleteFragmentSchema = z.object({
  confirm: z.literal('delete'),
});

// ===========================================================================
// DOCUMENT SCHEMAS
// ===========================================================================

export const createDocumentSchema = z.object({
  title: z.string({ message: 'Title is required' }).min(1, 'Title is required').trim(),
  title_ja: z.string().trim().optional().or(z.literal('')),
  client_code: z.string().trim().optional().or(z.literal('')),
  client_name: z.string().trim().optional().or(z.literal('')),
  client_name_ja: z.string().trim().optional().or(z.literal('')),
  language: language.default('en'),
  template_id: z.string().trim().optional().or(z.literal('')),
  fragments: z.string().trim().optional().or(z.literal('')),
});

const languageMode = z.enum(['en', 'ja', 'both_en_first', 'both_ja_first'], {
  message: 'Invalid language mode',
});

const proposalStatus = z.enum(['draft', 'review', 'approved', 'shared', 'archived'], {
  message: 'Invalid status',
});

export const saveDocumentSchema = z.object({
  title: z.string({ message: 'Title is required' }).min(1, 'Title is required').trim(),
  title_ja: z.string().trim().optional().or(z.literal('')),
  client_code: z.string().trim().optional().or(z.literal('')),
  client_name: z.string().trim().optional().or(z.literal('')),
  client_name_ja: z.string().trim().optional().or(z.literal('')),
  contact_name: z.string().trim().optional().or(z.literal('')),
  contact_name_ja: z.string().trim().optional().or(z.literal('')),
  language_mode: languageMode.default('en'),
  fragments: z.string().trim().optional().or(z.literal('')),
  cover_letter_en: z.string().trim().optional().or(z.literal('')),
  cover_letter_ja: z.string().trim().optional().or(z.literal('')),
});

export const updateDocumentStatusSchema = z.object({
  status: proposalStatus,
  review_notes: z.string().trim().optional().or(z.literal('')),
});

export const deleteDocumentSchema = z.object({
  confirm: z.literal('delete'),
});

// ===========================================================================
// TEMPLATE SCHEMAS
// ===========================================================================

const documentType = z.enum(['proposal', 'report', 'quote', 'sow', 'assessment'], {
  message: 'Invalid document type',
});

export const createTemplateSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required').trim(),
  name_ja: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  description_ja: z.string().trim().optional().or(z.literal('')),
  document_type: documentType.default('proposal'),
  is_default: z.boolean().default(false),
  fragments: z.string().trim().optional().or(z.literal('')),
});

export const saveTemplateSchema = z.object({
  name: z.string({ message: 'Name is required' }).min(1, 'Name is required').trim(),
  name_ja: z.string().trim().optional().or(z.literal('')),
  description: z.string().trim().optional().or(z.literal('')),
  description_ja: z.string().trim().optional().or(z.literal('')),
  document_type: documentType.default('proposal'),
  is_default: z.boolean().default(false),
  fragments: z.string().trim().optional().or(z.literal('')),
});

export const deleteTemplateSchema = z.object({
  confirm: z.literal('delete'),
});
