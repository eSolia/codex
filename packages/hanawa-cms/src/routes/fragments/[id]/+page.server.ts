/**
 * Fragment Detail Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad, Actions } from "./$types";
import { error, redirect } from "@sveltejs/kit";
import { createVersionService, type VersionListItem } from "$lib/server/versions";

interface FragmentRow {
  id: string;
  site_id: string;
  name: string;
  slug: string;
  content_en: string | null;
  content_ja: string | null;
  description: string | null;
  category: string | null;
  tags: string | null;
  version: number;
  status: string;
  is_bilingual: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export const load: PageServerLoad = async ({ platform, params, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  const db = platform.env.DB;
  const fragmentId = params.id;

  try {
    const result = await db
      .prepare("SELECT * FROM fragments WHERE id = ?")
      .bind(fragmentId)
      .first<FragmentRow>();

    if (!result) {
      throw error(404, "Fragment not found");
    }

    // Parse JSON fields
    const fragment = {
      ...result,
      tags: result.tags ? JSON.parse(result.tags) : [] as string[],
    };

    // Load version history
    let versions: VersionListItem[] = [];
    try {
      const versionService = locals.versions || createVersionService(db);
      versions = await versionService.list(fragmentId, { limit: 50 });
    } catch (vErr) {
      console.warn("Could not load versions:", vErr);
    }

    return { fragment, versions };
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw err;
    }
    console.error("Fragment load error:", err);
    throw error(500, "Failed to load fragment");
  }
};

export const actions: Actions = {
  update: async ({ platform, params, request, locals }) => {
    if (!platform?.env?.DB) {
      throw error(500, "Database not available");
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    // InfoSec: Validate and sanitize inputs
    const name = formData.get("name")?.toString().trim();
    const contentEn = formData.get("content_en")?.toString() || null;
    const contentJa = formData.get("content_ja")?.toString() || null;
    const description = formData.get("description")?.toString() || null;
    const category = formData.get("category")?.toString() || null;
    const tagsRaw = formData.get("tags")?.toString() || "[]";

    if (!name) {
      throw error(400, "Name is required");
    }

    // Parse and validate tags
    let tags: string[];
    try {
      tags = JSON.parse(tagsRaw);
      if (!Array.isArray(tags)) tags = [];
    } catch {
      tags = [];
    }

    try {
      // Get current state for version comparison
      const current = await db
        .prepare("SELECT * FROM fragments WHERE id = ?")
        .bind(params.id)
        .first<{ name: string; content_en: string | null; content_ja: string | null }>();

      // Update fragment
      await db
        .prepare(
          `UPDATE fragments
           SET name = ?, content_en = ?, content_ja = ?, description = ?,
               category = ?, tags = ?, is_bilingual = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          name,
          contentEn,
          contentJa,
          description,
          category,
          JSON.stringify(tags),
          contentEn && contentJa ? 1 : 0,
          params.id
        )
        .run();

      // Create version if content changed
      if (locals.versions && locals.auditContext) {
        const newContent = JSON.stringify({ name, content_en: contentEn, content_ja: contentJa });
        const oldContent = current
          ? JSON.stringify({ name: current.name, content_en: current.content_en, content_ja: current.content_ja })
          : null;

        if (newContent !== oldContent) {
          await locals.versions.create(
            params.id,
            {
              content: newContent,
              contentFormat: "json",
              title: name,
              versionType: "manual",
            },
            locals.auditContext
          );
        }
      }

      // Log audit event
      if (locals.audit && locals.auditContext) {
        await locals.audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: "fragment",
            resourceId: params.id,
            resourceTitle: name,
            changeSummary: `Updated fragment "${name}"`,
          },
          locals.auditContext
        );
      }

      return { success: true };
    } catch (err) {
      console.error("Fragment update error:", err);
      throw error(500, "Failed to update fragment");
    }
  },

  delete: async ({ platform, params, locals }) => {
    if (!platform?.env?.DB) {
      throw error(500, "Database not available");
    }

    const db = platform.env.DB;

    try {
      // Get fragment name for audit
      const fragment = await db
        .prepare("SELECT name FROM fragments WHERE id = ?")
        .bind(params.id)
        .first<{ name: string }>();

      await db
        .prepare("DELETE FROM fragments WHERE id = ?")
        .bind(params.id)
        .run();

      // Log audit event
      if (locals.audit && locals.auditContext) {
        await locals.audit.log(
          {
            action: "delete",
            actionCategory: "content",
            resourceType: "fragment",
            resourceId: params.id,
            resourceTitle: fragment?.name,
            changeSummary: `Deleted fragment "${fragment?.name || params.id}"`,
          },
          locals.auditContext
        );
      }

      throw redirect(303, "/fragments");
    } catch (err) {
      if ((err as { status?: number }).status === 303) {
        throw err;
      }
      console.error("Fragment delete error:", err);
      throw error(500, "Failed to delete fragment");
    }
  },
};
