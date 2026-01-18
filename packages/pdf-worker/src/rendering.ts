/**
 * Cloudflare Browser Rendering API integration
 */

import type { Env, PdfOptions, ScreenshotOptions } from "./types";

const BROWSER_RENDERING_BASE = "https://api.cloudflare.com/client/v4/accounts";

/**
 * Generate PDF from HTML using Cloudflare Browser Rendering API
 * @see https://developers.cloudflare.com/browser-rendering/rest-api/pdf-endpoint/
 */
export async function generatePdf(
  env: Env,
  html: string,
  options: PdfOptions = {}
): Promise<ArrayBuffer> {
  const {
    format = "A4",
    landscape = false,
    margin = { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    displayHeaderFooter = false,
    headerTemplate = "<div></div>",
    footerTemplate = "<div></div>",
    printBackground = true,
    scale = 1,
  } = options;

  // Calculate viewport based on format and orientation
  // A4: 210mm x 297mm ≈ 794px x 1123px at 96 DPI
  const viewport = landscape
    ? { width: 1123, height: 794 }
    : { width: 794, height: 1123 };

  // Page dimensions
  const dimensions = format === "A4"
    ? { width: "210mm", height: "297mm" }
    : { width: "8.5in", height: "11in" };

  const response = await fetch(
    `${BROWSER_RENDERING_BASE}/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/pdf`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_PDF_RENDER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        viewport,
        // Wait for network to be mostly idle (allows 2 concurrent connections)
        // Using networkidle2 instead of networkidle0 for faster rendering
        // while still ensuring fonts and critical resources are loaded
        gotoOptions: {
          waitUntil: "networkidle2",
        },
        pdfOptions: {
          landscape,
          printBackground,
          displayHeaderFooter,
          headerTemplate,
          footerTemplate,
          margin,
          scale,
          preferCSSPageSize: false,
          width: landscape ? dimensions.height : dimensions.width,
          height: landscape ? dimensions.width : dimensions.height,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Browser Rendering PDF error: ${response.status}`, errorText);
    throw new Error(`PDF generation failed: ${response.status} - ${errorText}`);
  }

  return response.arrayBuffer();
}

/**
 * Generate screenshot from HTML using Cloudflare Browser Rendering API
 * @see https://developers.cloudflare.com/browser-rendering/rest-api/screenshot-endpoint/
 */
export async function generateScreenshot(
  env: Env,
  html: string,
  options: ScreenshotOptions = {}
): Promise<ArrayBuffer> {
  const {
    width = 1200,
    height = 800,
    scale = 2,
    fullPage = false,
    type = "png",
    quality,
  } = options;

  const screenshotOptions: Record<string, unknown> = {
    type,
    fullPage,
    omitBackground: false,
  };

  // Quality only applies to jpeg/webp
  if ((type === "jpeg" || type === "webp") && quality !== undefined) {
    screenshotOptions.quality = quality;
  }

  const response = await fetch(
    `${BROWSER_RENDERING_BASE}/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_PDF_RENDER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        viewport: {
          width,
          height,
          deviceScaleFactor: scale,
        },
        screenshotOptions,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Browser Rendering screenshot error: ${response.status}`, errorText);
    throw new Error(`Screenshot generation failed: ${response.status} - ${errorText}`);
  }

  return response.arrayBuffer();
}
