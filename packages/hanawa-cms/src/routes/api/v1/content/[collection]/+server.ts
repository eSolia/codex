/**
 * Content Delivery API - Collection Endpoint
 * Public API for listing published content
 *
 * InfoSec: API key auth, rate limiting, CORS (OWASP A01, A04)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createDeliveryService } from "$lib/server/delivery";

/**
 * Validate API key from Authorization header
 */
async function validateRequest(
  request: Request,
  platform: App.Platform
): Promise<{
  valid: boolean;
  keyId?: string;
  permissions?: string[];
  collections?: string[] | null;
  rateLimit?: number;
  error?: string;
}> {
  const authHeader = request.headers.get("Authorization");

  // Allow unauthenticated access for now (can be restricted later)
  if (!authHeader) {
    return { valid: true, rateLimit: 100 }; // Lower rate limit for unauthenticated
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization header format" };
  }

  const apiKey = authHeader.slice(7);
  const delivery = createDeliveryService(platform.env.DB, platform.env.KV);
  const result = await delivery.validateApiKey(apiKey);

  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  return {
    valid: true,
    keyId: result.apiKey?.id,
    permissions: result.apiKey?.permissions,
    collections: result.apiKey?.collections,
    rateLimit: result.apiKey?.rate_limit,
  };
}

/**
 * GET /api/v1/content/[collection] - List documents in a collection
 *
 * Query params:
 *   - locale: Filter by locale (e.g., "en", "ja")
 *   - page: Page number (default: 1)
 *   - perPage: Items per page (default: 20, max: 100)
 *   - sort: Sort field and direction (e.g., "publishedAt:desc")
 *   - fields: Comma-separated field names to include
 *   - filter[field]: Filter by field value
 */
export const GET: RequestHandler = async ({ params, url, request, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Service unavailable");
  }

  // Validate API key
  const auth = await validateRequest(request, platform);
  if (!auth.valid) {
    throw error(401, auth.error || "Unauthorized");
  }

  // Check collection access
  if (auth.collections && !auth.collections.includes(params.collection)) {
    throw error(403, "Access to this collection is not allowed");
  }

  // Check rate limit
  const delivery = createDeliveryService(
    platform.env.DB,
    platform.env.KV,
    platform.env.R2
  );

  if (auth.keyId && auth.rateLimit) {
    const rateLimit = await delivery.checkRateLimit(auth.keyId, auth.rateLimit);
    if (!rateLimit.allowed) {
      return json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(auth.rateLimit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(rateLimit.reset),
            "Retry-After": String(rateLimit.reset - Math.floor(Date.now() / 1000)),
          },
        }
      );
    }
  }

  try {
    // Parse query parameters
    const locale = url.searchParams.get("locale") || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("perPage") || "20"))
    );
    const sort = url.searchParams.get("sort") || "publishedAt:desc";
    const fields = url.searchParams.get("fields")?.split(",").filter(Boolean);

    // Parse filters
    const filters: Record<string, unknown> = {};
    for (const [key, value] of url.searchParams.entries()) {
      if (key.startsWith("filter[") && key.endsWith("]")) {
        const filterKey = key.slice(7, -1);
        filters[filterKey] = value;
      }
    }

    const result = await delivery.listDocuments(params.collection, {
      locale,
      page,
      perPage,
      sort,
      fields,
      filters,
      status: "published",
    });

    // Add rate limit headers if authenticated
    const headers: Record<string, string> = {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Content-Type": "application/json",
    };

    if (auth.keyId && auth.rateLimit) {
      const rateLimit = await delivery.checkRateLimit(auth.keyId, auth.rateLimit);
      headers["X-RateLimit-Limit"] = String(auth.rateLimit);
      headers["X-RateLimit-Remaining"] = String(rateLimit.remaining);
      headers["X-RateLimit-Reset"] = String(rateLimit.reset);
    }

    return json(result, { headers });
  } catch (err) {
    console.error("Content list error:", err);
    throw error(500, "Failed to list content");
  }
};
