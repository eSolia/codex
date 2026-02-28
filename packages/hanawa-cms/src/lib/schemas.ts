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
// FRAGMENT SCHEMAS (markdown-first, R2-backed)
// ===========================================================================

// Fragment ID: lowercase, hyphens, digits. No leading/trailing hyphens.
const fragmentId = z
  .string()
  .min(2, 'ID must be at least 2 characters')
  .max(100)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'ID must be lowercase with hyphens, no leading/trailing hyphens'
  )
  .trim();

const fragmentStatus = z.enum(['production', 'draft', 'deprecated', 'archived'], {
  message: 'Invalid fragment status',
});

export const saveFragmentSchema = z.object({
  title_en: z.string().trim().optional().or(z.literal('')),
  title_ja: z.string().trim().optional().or(z.literal('')),
  category: z.string().trim().optional().or(z.literal('')),
  type: z.string().trim().optional().or(z.literal('')),
  status: fragmentStatus.default('production'),
  sensitivity: sensitivity.default('normal'),
  tags: z.string().trim().optional().or(z.literal('')), // JSON array string
  author: z.string().trim().optional().or(z.literal('')),
  version: z.string().trim().optional().or(z.literal('')),
  content_en: z.string().optional().or(z.literal('')), // markdown body
  content_ja: z.string().optional().or(z.literal('')), // markdown body
});

export const renameFragmentSchema = z.object({
  new_id: fragmentId,
  new_category: z.string().trim().optional().or(z.literal('')),
});

export const createFragmentSchema = z.object({
  id: fragmentId,
  title_en: z.string().min(1, 'English title required').trim(),
  title_ja: z.string().trim().optional().or(z.literal('')),
  category: z.string().trim().optional().or(z.literal('')),
  type: z.string().trim().optional().or(z.literal('')),
  tags: z.string().trim().optional().or(z.literal('')),
});

export const deleteFragmentSchema = z.object({
  confirm: z.literal('delete'),
});

// ===========================================================================
// DOCUMENT SCHEMAS
// ===========================================================================

const documentType = z.enum(['proposal', 'report', 'quote', 'sow', 'assessment'], {
  message: 'Invalid document type',
});

export const createDocumentSchema = z.object({
  title: z.string({ message: 'Title is required' }).min(1, 'Title is required').trim(),
  title_ja: z.string().trim().optional().or(z.literal('')),
  client_code: z.string().trim().optional().or(z.literal('')),
  client_name: z.string().trim().optional().or(z.literal('')),
  client_name_ja: z.string().trim().optional().or(z.literal('')),
  language: language.default('en'),
  document_type: documentType.default('proposal'),
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

// Section action schemas (manifest-based documents)
export const insertSectionSchema = z.object({
  fragment_id: z.string().min(1, 'Fragment ID required').trim(),
  position: z.coerce.number().int().nonnegative().optional(),
});

export const reorderSectionSchema = z.object({
  from_index: z.coerce.number().int().nonnegative(),
  to_index: z.coerce.number().int().nonnegative(),
});

export const removeSectionSchema = z.object({
  section_index: z.coerce.number().int().nonnegative(),
});

export const refreshSectionSchema = z.object({
  section_index: z.coerce.number().int().nonnegative(),
});

export const addCustomSectionSchema = z.object({
  label: z.string().min(1, 'Section label required').trim(),
  label_ja: z.string().trim().optional().or(z.literal('')),
});

// ===========================================================================
// TEMPLATE SCHEMAS
// ===========================================================================

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

// ===========================================================================
// STANDARD SCHEMAS (monolingual, R2-backed coding/workflow standards)
// ===========================================================================

// Standard slug: lowercase, hyphens, digits. No leading/trailing hyphens.
const standardSlug = z
  .string()
  .min(2, 'Slug must be at least 2 characters')
  .max(150)
  .regex(
    /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
    'Slug must be lowercase with hyphens, no leading/trailing hyphens'
  )
  .trim();

const standardStatus = z.enum(['production', 'draft', 'deprecated', 'archived'], {
  message: 'Invalid standard status',
});

export const saveStandardSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  category: z.string().trim().optional().or(z.literal('')),
  status: standardStatus.default('production'),
  tags: z.string().trim().optional().or(z.literal('')), // JSON array string
  summary: z.string().trim().optional().or(z.literal('')),
  author: z.string().trim().optional().or(z.literal('')),
  content: z.string().optional().or(z.literal('')), // markdown body
});

export const createStandardSchema = z.object({
  slug: standardSlug,
  title: z.string().min(1, 'Title is required').trim(),
  category: z.string().trim().optional().or(z.literal('')),
  tags: z.string().trim().optional().or(z.literal('')),
  summary: z.string().trim().optional().or(z.literal('')),
});

export const renameStandardSchema = z.object({
  new_slug: standardSlug,
});

export const deleteStandardSchema = z.object({
  confirm: z.literal('delete'),
});
