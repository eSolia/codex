/**
 * New Document Page Server
 * Creates manifest-based documents with section files in R2.
 * InfoSec: Input validation with Zod (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { fail, redirect, isRedirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createDocumentSchema } from '$lib/schemas';
import { parseFrontmatter } from '$lib/server/frontmatter';
import {
  serializeManifest,
  slugify,
  type DocumentManifest,
  type ManifestSection,
} from '$lib/server/manifest';

interface Template {
  id: string;
  name: string;
  name_ja: string | null;
  description: string | null;
  description_ja: string | null;
  document_type: string;
  default_fragments: string;
  is_default: boolean;
}

interface FragmentIndex {
  id: string;
  category: string;
  title_en: string | null;
  title_ja: string | null;
  type: string;
  version: string | null;
  r2_key_en: string | null;
  r2_key_ja: string | null;
}

interface LegacyFragment {
  id: string;
  name: string;
  slug: string;
  category: string;
}

// Fallback fragment references for templates
const FALLBACK_FRAGMENTS = [
  { id: 'esolia-introduction', order: 1, enabled: true, required: true },
  { id: 'esolia-background', order: 2, enabled: true, required: false },
  { id: 'esolia-closing', order: 3, enabled: true, required: true },
];

export const load: PageServerLoad = async ({ platform, url }) => {
  const form = await superValidate(zod4(createDocumentSchema));

  if (!platform?.env?.DB) {
    return { form, templates: [], availableFragments: [], selectedTemplate: null };
  }

  const db = platform.env.DB;
  const templateId = url.searchParams.get('template');

  try {
    // Load templates
    let templates: Template[] = [];
    try {
      const templatesResult = await db
        .prepare(
          `SELECT id, name, name_ja, description, description_ja, document_type, default_fragments, is_default
           FROM templates
           WHERE is_active = TRUE
           ORDER BY is_default DESC, name ASC`
        )
        .all<Template>();
      templates = templatesResult.results ?? [];
    } catch {
      console.log('Templates table not available, using fallback');
    }

    // Load available fragments from fragment_index (markdown-first)
    let availableFragments: FragmentIndex[] = [];
    try {
      const indexResult = await db
        .prepare(
          `SELECT id, category, title_en, title_ja, type, version, r2_key_en, r2_key_ja
           FROM fragment_index
           WHERE status = 'production'
           ORDER BY category, title_en`
        )
        .all<FragmentIndex>();
      availableFragments = indexResult.results ?? [];
    } catch {
      // Fallback to legacy fragments table
      const legacyResult = await db
        .prepare(
          `SELECT id, name, slug, category
           FROM fragments
           WHERE category IN ('proposals', 'capabilities', 'services', 'terms', 'closing', 'company')
           ORDER BY category, name`
        )
        .all<LegacyFragment>();
      availableFragments = (legacyResult.results ?? []).map((f) => ({
        id: f.id,
        category: f.category,
        title_en: f.name,
        title_ja: null,
        type: 'text',
        version: null,
        r2_key_en: null,
        r2_key_ja: null,
      }));
    }

    // Find selected template
    let selectedTemplate: Template | null = null;
    let defaultFragments = FALLBACK_FRAGMENTS;

    if (templateId && templates.length > 0) {
      selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
      if (selectedTemplate) {
        try {
          defaultFragments = JSON.parse(selectedTemplate.default_fragments);
        } catch {
          defaultFragments = FALLBACK_FRAGMENTS;
        }
      }
    } else if (templates.length > 0) {
      selectedTemplate = templates.find((t) => t.is_default) ?? templates[0] ?? null;
      if (selectedTemplate) {
        try {
          defaultFragments = JSON.parse(selectedTemplate.default_fragments);
        } catch {
          defaultFragments = FALLBACK_FRAGMENTS;
        }
      }
    }

    return {
      form,
      templates,
      availableFragments,
      selectedTemplate,
      defaultFragments,
    };
  } catch (err) {
    console.error('Failed to load data:', err);
    return {
      form,
      templates: [],
      availableFragments: [],
      selectedTemplate: null,
      defaultFragments: FALLBACK_FRAGMENTS,
    };
  }
};

export const actions: Actions = {
  create: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const form = await superValidate(request, zod4(createDocumentSchema));
      form.message = 'Database or storage not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createDocumentSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const {
      title,
      title_ja,
      client_code,
      client_name,
      client_name_ja,
      language,
      document_type,
      template_id,
      fragments: fragmentsJson,
    } = form.data;

    // Generate document ID
    const slug = slugify(title);
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = Math.random().toString(36).substring(2, 6);
    const docId = client_code
      ? `${client_code}-${slug}-${datePart}`
      : `${slug}-${datePart}-${shortId}`;
    const r2Dir = `documents/${docId}`;
    const manifestKey = `${r2Dir}/manifest.yaml`;

    try {
      // Parse template fragment list
      let templateFragments: Array<{ id: string; order: number; enabled: boolean }> = [];
      if (fragmentsJson) {
        try {
          templateFragments = JSON.parse(fragmentsJson);
        } catch {
          templateFragments = [];
        }
      }

      // Build manifest sections from template fragments
      const sections: ManifestSection[] = [];
      const createdBy = locals.user?.email ?? 'unknown';
      const today = new Date().toISOString().slice(0, 10);

      // Look up each fragment in fragment_index and copy content
      for (let i = 0; i < templateFragments.length; i++) {
        const tf = templateFragments[i]!;
        if (!tf.enabled) continue;

        const prefix = String(i + 1).padStart(2, '0');

        // Look up in fragment_index
        const meta = await db
          .prepare(
            'SELECT id, category, title_en, title_ja, version, r2_key_en, r2_key_ja FROM fragment_index WHERE id = ?'
          )
          .bind(tf.id)
          .first<FragmentIndex>();

        if (meta) {
          const fileSlug = slugify(meta.title_en ?? tf.id);
          const fileStem = `${prefix}-${fileSlug}`;
          const source = `${meta.category}/${meta.id}`;

          // Copy fragment content from R2 into document directory
          let contentEn = '';
          let contentJa = '';

          if (meta.r2_key_en) {
            const obj = await r2.get(meta.r2_key_en);
            if (obj) {
              const raw = await obj.text();
              const { body } = parseFrontmatter(raw);
              contentEn = body;
            }
          }
          if (meta.r2_key_ja) {
            const obj = await r2.get(meta.r2_key_ja);
            if (obj) {
              const raw = await obj.text();
              const { body } = parseFrontmatter(raw);
              contentJa = body;
            }
          }

          // Write copies to document R2 directory
          await r2.put(`${r2Dir}/${fileStem}.en.md`, contentEn, {
            httpMetadata: { contentType: 'text/markdown' },
          });
          await r2.put(`${r2Dir}/${fileStem}.ja.md`, contentJa, {
            httpMetadata: { contentType: 'text/markdown' },
          });

          sections.push({
            file: fileStem,
            label: meta.title_en ?? tf.id,
            label_ja: meta.title_ja ?? undefined,
            source,
            source_version: meta.version ?? undefined,
            locked: false,
          });
        } else {
          // Fragment not in index — create empty custom section
          const fileSlug = slugify(tf.id);
          const fileStem = `${prefix}-${fileSlug}`;

          await r2.put(`${r2Dir}/${fileStem}.en.md`, '', {
            httpMetadata: { contentType: 'text/markdown' },
          });
          await r2.put(`${r2Dir}/${fileStem}.ja.md`, '', {
            httpMetadata: { contentType: 'text/markdown' },
          });

          sections.push({
            file: fileStem,
            label: tf.id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            source: null,
            locked: false,
          });
        }
      }

      // If no template fragments, create one empty exec summary section
      if (sections.length === 0) {
        const fileStem = '01-executive-summary';
        await r2.put(`${r2Dir}/${fileStem}.en.md`, '', {
          httpMetadata: { contentType: 'text/markdown' },
        });
        await r2.put(`${r2Dir}/${fileStem}.ja.md`, '', {
          httpMetadata: { contentType: 'text/markdown' },
        });
        sections.push({
          file: fileStem,
          label: 'Executive Summary',
          label_ja: 'エグゼクティブサマリー',
          source: null,
          locked: false,
        });
      }

      // Build and write manifest
      const manifest: DocumentManifest = {
        id: docId,
        document_type: document_type ?? 'proposal',
        client_code: client_code ?? '',
        client_name: client_name ?? '',
        client_name_ja: client_name_ja ?? '',
        title,
        title_ja: title_ja ?? '',
        language_mode: language === 'ja' ? 'ja' : 'en',
        status: 'draft',
        contact_name: '',
        contact_name_ja: '',
        created_by: createdBy,
        created_at: today,
        updated_at: today,
        sections,
      };

      await r2.put(manifestKey, serializeManifest(manifest), {
        httpMetadata: { contentType: 'text/yaml' },
      });

      // InfoSec: Parameterized insert (OWASP A03)
      await db
        .prepare(
          `INSERT INTO proposals (
            id, client_code, client_name, client_name_ja,
            title, title_ja, language, template_id, fragments, status,
            document_type, r2_manifest_key
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
        )
        .bind(
          docId,
          client_code ?? '',
          client_name ?? null,
          client_name_ja ?? null,
          title,
          title_ja ?? null,
          language,
          template_id ?? null,
          fragmentsJson ?? '[]',
          document_type ?? 'proposal',
          manifestKey
        )
        .run();

      redirect(303, `/documents/${docId}`);
    } catch (err) {
      // Re-throw SvelteKit redirect (it's not a Response in SvelteKit 2)
      if (isRedirect(err)) throw err;

      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to create document:', errMsg, err);
      form.message = `Failed to create document: ${errMsg}`;
      return fail(500, { form });
    }
  },

  aiTranslate: async ({ request, locals }) => {
    if (!locals.ai) {
      return fail(500, { error: 'AI service not available' });
    }

    const formData = await request.formData();
    const text = formData.get('text')?.toString() || '';
    const sourceLocale = formData.get('source_locale')?.toString() as 'en' | 'ja';

    if (!text || !sourceLocale) {
      return fail(400, { error: 'Text and source locale are required' });
    }

    // InfoSec: Validate locale enum (OWASP A03)
    if (!['en', 'ja'].includes(sourceLocale)) {
      return fail(400, { error: 'Invalid source locale' });
    }

    const targetLocale = sourceLocale === 'en' ? 'ja' : 'en';
    const userEmail = locals.user?.email || 'anonymous';

    try {
      const translated = await locals.ai.translate(text, sourceLocale, targetLocale, userEmail);
      return { success: true, translated, targetLocale };
    } catch (err) {
      console.error('Translation failed:', err);
      return fail(500, { error: 'Translation failed' });
    }
  },
};
