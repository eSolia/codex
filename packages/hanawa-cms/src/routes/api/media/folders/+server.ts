/**
 * Media Folders API Endpoint
 * Lists unique folders for asset organization
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * GET /api/media/folders - Get all unique folders
 */
export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.media) {
    throw error(500, "Media service not available");
  }

  const siteId = url.searchParams.get("siteId") || undefined;

  try {
    const folders = await locals.media.getFolders(siteId);
    return json({ folders });
  } catch (err) {
    console.error("Media folders error:", err);
    throw error(500, "Failed to get folders");
  }
};
