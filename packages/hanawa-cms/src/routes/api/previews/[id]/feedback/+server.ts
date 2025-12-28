/**
 * Preview Feedback API Endpoint
 * Manage feedback for previews
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createPreviewService } from "$lib/server/previews";

/**
 * GET /api/previews/:id/feedback - Get feedback for a preview
 */
export const GET: RequestHandler = async ({ params, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  try {
    const previews = createPreviewService(platform.env.DB);
    const feedback = await previews.getFeedback(params.id);

    return json({ feedback });
  } catch (err) {
    console.error("Preview feedback get error:", err);
    throw error(500, "Failed to get feedback");
  }
};

/**
 * POST /api/previews/:id/feedback - Add feedback to a preview
 */
export const POST: RequestHandler = async ({ params, request, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.content || !body.authorEmail) {
      throw error(400, "type, content, and authorEmail are required");
    }

    // Validate feedback type
    if (!["comment", "issue", "approval"].includes(body.type)) {
      throw error(400, "type must be 'comment', 'issue', or 'approval'");
    }

    // InfoSec: Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.authorEmail)) {
      throw error(400, "Invalid email format");
    }

    const previews = createPreviewService(platform.env.DB);

    const feedback = await previews.addFeedback(params.id, {
      type: body.type,
      content: body.content,
      authorEmail: body.authorEmail,
      pagePath: body.pagePath,
    });

    return json(feedback, { status: 201 });
  } catch (err) {
    console.error("Preview feedback add error:", err);
    if (err instanceof Response) throw err;
    throw error(500, "Failed to add feedback");
  }
};
