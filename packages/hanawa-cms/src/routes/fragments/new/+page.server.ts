/**
 * New Fragment Page Server Actions
 * InfoSec: Input validation and parameterized queries (OWASP A03)
 */

import type { Actions } from "./$types";
import { error, redirect } from "@sveltejs/kit";

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `frag_${timestamp}${random}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const actions: Actions = {
  default: async ({ platform, request }) => {
    if (!platform?.env?.DB) {
      throw error(500, "Database not available");
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    // InfoSec: Validate and sanitize inputs
    const name = formData.get("name")?.toString().trim();
    const category = formData.get("category")?.toString().trim() || null;
    const description = formData.get("description")?.toString().trim() || null;
    const contentEn = formData.get("content_en")?.toString() || null;
    const contentJa = formData.get("content_ja")?.toString() || null;
    const tagsRaw = formData.get("tags")?.toString() || "";

    if (!name) {
      throw error(400, "Name is required");
    }

    const id = generateId();
    const slug = slugify(name);

    // Parse tags
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await db
        .prepare(
          `INSERT INTO fragments (
            id, name, slug, category, description,
            content_en, content_ja, is_bilingual,
            tags, version, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          id,
          name,
          slug,
          category,
          description,
          contentEn,
          contentJa,
          contentEn && contentJa ? 1 : 0,
          JSON.stringify(tags),
          "1.0",
          "active"
        )
        .run();

      throw redirect(303, `/fragments/${id}`);
    } catch (err) {
      if ((err as { status?: number }).status === 303) {
        throw err;
      }
      console.error("Fragment create error:", err);
      throw error(500, "Failed to create fragment");
    }
  },
};
