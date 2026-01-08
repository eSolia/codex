/**
 * Authentication middleware for PDF Worker
 */

import type { Context, Next } from "hono";
import type { Env } from "./types";

/**
 * Allowed origins for CORS
 * Supports wildcards for localhost ports
 */
const ALLOWED_ORIGINS = [
  // Production
  "https://codex.esolia.co.jp",
  "https://hanawa.esolia.co.jp",
  "https://chocho.esolia.co.jp",
  "https://pulse.esolia.co.jp",
  "https://periodic.esolia.co.jp",
  "https://nexus.esolia.co.jp",
  "https://courier.esolia.co.jp",

  // Staging
  "https://*.pages.dev",

  // Development
  "http://localhost",
  "http://127.0.0.1",
];

/**
 * Check if an origin matches the allowed list
 */
function isOriginAllowed(origin: string): boolean {
  for (const allowed of ALLOWED_ORIGINS) {
    // Exact match
    if (allowed === origin) {
      return true;
    }

    // Wildcard subdomain match (e.g., https://*.pages.dev)
    if (allowed.includes("*")) {
      const pattern = allowed
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape regex chars
        .replace(/\*/g, ".*"); // Convert * to .*
      if (new RegExp(`^${pattern}(:\\d+)?$`).test(origin)) {
        return true;
      }
    }

    // Localhost with any port
    if (
      (allowed === "http://localhost" || allowed === "http://127.0.0.1") &&
      (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * CORS configuration for allowed origins
 */
export function getCorsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  return isOriginAllowed(origin) ? origin : null;
}

/**
 * Authentication middleware
 * Validates either:
 * 1. Service binding requests (no origin, internal CF network)
 * 2. Origin header (for browser requests from allowed domains)
 * 3. X-API-Key header (for server-to-server requests)
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<Response | void> {
  const origin = c.req.header("Origin");
  const apiKey = c.req.header("X-API-Key");
  const cfConnectingIp = c.req.header("CF-Connecting-IP");

  // Allow service binding requests (internal worker-to-worker)
  // Service bindings don't have Origin header and may not have CF-Connecting-IP
  // InfoSec: Service bindings are trusted internal Cloudflare network calls
  if (!origin && !cfConnectingIp) {
    console.log("Auth: Service binding request (internal)");
    await next();
    return;
  }

  // Allow if origin is in whitelist (browser requests)
  if (origin && isOriginAllowed(origin)) {
    await next();
    return;
  }

  // Allow if API key matches (server-to-server)
  if (apiKey && apiKey === c.env.PDF_API_KEY) {
    await next();
    return;
  }

  // Reject
  console.warn(`Auth rejected: origin=${origin}, hasApiKey=${!!apiKey}, hasCfIp=${!!cfConnectingIp}`);
  return c.json({ error: "Unauthorized" }, 401);
}

/**
 * Validate that required secrets are configured
 */
export function validateConfig(env: Env): { valid: boolean; missing: string[] } {
  const required = ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_PDF_RENDER_TOKEN", "PDF_API_KEY"];
  const missing = required.filter((key) => !env[key as keyof Env]);

  return {
    valid: missing.length === 0,
    missing,
  };
}
