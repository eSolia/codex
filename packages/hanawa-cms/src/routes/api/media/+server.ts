/**
 * Media API Endpoint
 * Handles file uploads to R2 and asset listing
 *
 * InfoSec: File type validation, size limits (OWASP A04)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/media - List assets with filtering
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.media) {
    throw error(500, "Media service not available");
  }

  const siteId = url.searchParams.get("siteId") || undefined;
  const folder = url.searchParams.get("folder") || undefined;
  const mimeType = url.searchParams.get("mimeType") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  try {
    const result = await locals.media.list({
      siteId,
      folder,
      mimeType,
      search,
      limit,
      offset,
    });

    return json(result);
  } catch (err) {
    console.error("Media list error:", err);
    throw error(500, "Failed to list assets");
  }
};

/**
 * POST /api/media - Upload a file
 * InfoSec: Validates file type and size before upload
 */
export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.media) {
    throw error(500, "Media service not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw error(400, "No file provided");
    }

    // Parse options from form data
    const options = {
      siteId: (formData.get("siteId") as string) || undefined,
      folder: (formData.get("folder") as string) || "/",
      altText: (formData.get("altText") as string) || undefined,
      altTextJa: (formData.get("altTextJa") as string) || undefined,
      caption: (formData.get("caption") as string) || undefined,
      tags: formData.get("tags")
        ? JSON.parse(formData.get("tags") as string)
        : [],
    };

    const asset = await locals.media.upload(file, options, locals.auditContext);

    return json(asset, { status: 201 });
  } catch (err) {
    console.error("Media upload error:", err);
    if (err instanceof Response) throw err;

    // Return validation errors with proper message
    if (err instanceof Error) {
      if (
        err.message.includes("File type not allowed") ||
        err.message.includes("File too large")
      ) {
        throw error(400, err.message);
      }
    }

    throw error(500, "Failed to upload file");
  }
};
