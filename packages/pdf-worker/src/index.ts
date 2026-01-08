/**
 * PDF Worker - Shared PDF generation service for eSolia apps
 *
 * Endpoints:
 *   POST /pdf           - Generate PDF from HTML
 *   POST /pdf/bilingual - Generate bilingual PDF (EN+JA) with TOC
 *   POST /screenshot    - Generate screenshot from HTML
 *   GET  /health        - Health check
 *
 * Authentication:
 *   - Browser requests: Origin must be in whitelist
 *   - Server requests: X-API-Key header required
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Env, PdfRequest, ScreenshotRequest, HealthResponse, BilingualPdfRequest } from "./types";
import { generatePdf, generateScreenshot } from "./rendering";
import { generateBilingualPdf } from "./bilingual";
import { authMiddleware, getCorsOrigin, validateConfig } from "./auth";

// Version for health checks
const VERSION = "1.0.0";

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Logging
app.use("*", logger());

// CORS - allow whitelisted origins
app.use(
  "*",
  cors({
    origin: (origin) => getCorsOrigin(origin),
    allowMethods: ["POST", "GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-API-Key"],
    maxAge: 86400, // 24 hours
  })
);

// Health check (no auth required)
app.get("/health", (c) => {
  const config = validateConfig(c.env);

  const response: HealthResponse = {
    status: config.valid ? "ok" : "error",
    version: VERSION,
    environment: c.env.ENVIRONMENT || "unknown",
  };

  if (!config.valid) {
    return c.json(
      { ...response, error: `Missing secrets: ${config.missing.join(", ")}` },
      503
    );
  }

  return c.json(response);
});

// Auth middleware for protected endpoints
app.use("/pdf", authMiddleware);
app.use("/pdf/bilingual", authMiddleware);
app.use("/screenshot", authMiddleware);

// PDF generation
app.post("/pdf", async (c) => {
  try {
    const body = await c.req.json<PdfRequest>();

    if (!body.html) {
      return c.json({ error: "Missing required field: html" }, 400);
    }

    // Validate HTML size (Browser Rendering has limits)
    if (body.html.length > 5_000_000) {
      return c.json({ error: "HTML too large (max 5MB)" }, 413);
    }

    console.log(`Generating PDF: ${body.html.length} bytes HTML`);

    const pdfBuffer = await generatePdf(c.env, body.html, body.options);

    console.log(`PDF generated: ${pdfBuffer.byteLength} bytes`);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=document.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: "PDF generation failed", details: message }, 500);
  }
});

// Bilingual PDF generation (EN + JA with TOC)
app.post("/pdf/bilingual", async (c) => {
  try {
    const body = await c.req.json<BilingualPdfRequest>();

    if (!body.htmlEn || !body.htmlJa) {
      return c.json({ error: "Missing required fields: htmlEn and htmlJa" }, 400);
    }

    if (!body.toc?.title || !body.toc?.date) {
      return c.json({ error: "Missing required TOC fields: title and date" }, 400);
    }

    // Validate HTML sizes
    if (body.htmlEn.length > 5_000_000 || body.htmlJa.length > 5_000_000) {
      return c.json({ error: "HTML too large (max 5MB per language)" }, 413);
    }

    console.log(`Generating bilingual PDF: EN ${body.htmlEn.length} bytes, JA ${body.htmlJa.length} bytes`);

    const result = await generateBilingualPdf(c.env, body);

    console.log(`Bilingual PDF generated: ${result.pageInfo.totalPages} total pages`);

    // Return as JSON with base64-encoded PDFs
    // This allows the caller to get all three PDFs in one request
    return c.json({
      combined: arrayBufferToBase64(result.combined),
      english: arrayBufferToBase64(result.english),
      japanese: arrayBufferToBase64(result.japanese),
      pageInfo: result.pageInfo,
    });
  } catch (error) {
    console.error("Bilingual PDF generation error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: "Bilingual PDF generation failed", details: message }, 500);
  }
});

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Screenshot generation
app.post("/screenshot", async (c) => {
  try {
    const body = await c.req.json<ScreenshotRequest>();

    if (!body.html) {
      return c.json({ error: "Missing required field: html" }, 400);
    }

    // Validate HTML size
    if (body.html.length > 5_000_000) {
      return c.json({ error: "HTML too large (max 5MB)" }, 413);
    }

    const imageType = body.options?.type || "png";
    console.log(`Generating ${imageType} screenshot: ${body.html.length} bytes HTML`);

    const imageBuffer = await generateScreenshot(c.env, body.html, body.options);

    console.log(`Screenshot generated: ${imageBuffer.byteLength} bytes`);

    const contentType =
      imageType === "jpeg"
        ? "image/jpeg"
        : imageType === "webp"
          ? "image/webp"
          : "image/png";

    return new Response(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename=screenshot.${imageType}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Screenshot generation error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return c.json({ error: "Screenshot generation failed", details: message }, 500);
  }
});

// 404 for other routes
app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      endpoints: {
        "POST /pdf": "Generate PDF from HTML",
        "POST /pdf/bilingual": "Generate bilingual PDF (EN+JA) with TOC",
        "POST /screenshot": "Generate screenshot from HTML",
        "GET /health": "Health check",
      },
    },
    404
  );
});

// Error handler
app.onError((error, c) => {
  console.error("Unhandled error:", error);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
