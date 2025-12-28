/**
 * Hanawa CMS Server Hooks
 * InfoSec: Centralized security controls following OWASP Top 10
 */

import { error, type Handle } from "@sveltejs/kit";
import { createAuditService, type AuditContext } from "$lib/server/audit";
import { createVersionService } from "$lib/server/versions";
import { createWorkflowService } from "$lib/server/workflow";
import { createCommentsService } from "$lib/server/comments";
import { createSchedulingService } from "$lib/server/scheduling";
import { createLocalizationService } from "$lib/server/localization";
import { createAIService } from "$lib/server/ai";
import { createCodexService } from "$lib/server/codex";

/**
 * Validate CSRF for API routes.
 * InfoSec: Form actions have built-in protection, but +server.ts routes don't.
 * OWASP A08: Software and Data Integrity Failures
 */
function validateCsrf(request: Request, url: URL): void {
  const isApiRoute = url.pathname.startsWith("/api/");
  const isStateChangingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method
  );

  if (!isApiRoute || !isStateChangingMethod) return;

  const origin = request.headers.get("origin");

  if (!origin) {
    const referer = request.headers.get("referer");
    if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== url.origin) {
        throw error(403, "CSRF check failed: invalid referer");
      }
    }
    return; // Same-origin requests without headers are OK
  }

  if (origin !== url.origin) {
    throw error(403, "CSRF check failed: origin mismatch");
  }
}

/**
 * Basic rate limiting for authentication endpoints.
 * InfoSec: OWASP A04 Insecure Design - prevent brute force
 */
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  const recent = requests.filter((t) => t > now - windowMs);

  if (recent.length >= limit) {
    return false; // Rate limited
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

export const handle: Handle = async ({ event, resolve }) => {
  // InfoSec: CSRF validation for API routes
  validateCsrf(event.request, event.url);

  // InfoSec: Rate limiting for sensitive endpoints
  if (event.url.pathname.startsWith("/api/auth")) {
    const ip = event.getClientAddress();
    if (!checkRateLimit(ip, 10, 60000)) {
      // 10 attempts per minute
      throw error(429, "Too many requests");
    }
  }

  // Generate request ID for correlation
  const requestId = crypto.randomUUID();
  event.locals.requestId = requestId;

  // Extract actor from Cloudflare Access headers (or use defaults for dev)
  const cfAccessEmail = event.request.headers.get(
    "cf-access-authenticated-user-email"
  );
  const cfAccessId = event.request.headers.get("cf-access-jwt-assertion");

  // Set up audit context
  const actorEmail = cfAccessEmail || "dev@hanawa.local";
  const actorId = cfAccessId || actorEmail;

  const auditContext: AuditContext = {
    actorId,
    actorEmail,
    actorName: actorEmail.split("@")[0],
    ipAddress: event.getClientAddress(),
    userAgent: event.request.headers.get("user-agent") || undefined,
    sessionId: event.cookies.get("session_id") || undefined,
    requestId,
  };

  event.locals.auditContext = auditContext;

  // Initialize services if DB is available
  if (event.platform?.env?.DB) {
    const db = event.platform.env.DB;
    const aiBinding = event.platform.env.AI;
    const vectorize = event.platform.env.VECTORIZE || null;

    const audit = createAuditService(db);
    const versions = createVersionService(db, audit);
    const workflow = createWorkflowService(db, audit, versions);
    const comments = createCommentsService(db, audit);
    const scheduling = createSchedulingService(db, audit, workflow);
    const localization = createLocalizationService(db, audit);

    event.locals.audit = audit;
    event.locals.versions = versions;
    event.locals.workflow = workflow;
    event.locals.comments = comments;
    event.locals.scheduling = scheduling;
    event.locals.localization = localization;

    // Initialize AI and Codex services if AI binding is available
    if (aiBinding) {
      const ai = createAIService(db, aiBinding, audit);
      const codex = createCodexService(db, vectorize, aiBinding, audit);

      event.locals.ai = ai;
      event.locals.codex = codex;
    }
  }

  const response = await resolve(event);

  // InfoSec: Security headers (OWASP A05)
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // Content Security Policy
  // Note: 'unsafe-inline' needed for Svelte's runtime styles
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
    ].join("; ")
  );

  return response;
};
