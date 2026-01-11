/**
 * Environment bindings for the PDF Worker
 */
export interface Env {
  // Cloudflare credentials for Browser Rendering API
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_PDF_RENDER_TOKEN: string;

  // Shared secret for client authentication
  PDF_API_KEY: string;

  // Environment indicator
  ENVIRONMENT: string;

  // Future: R2 bucket for templates
  // TEMPLATES: R2Bucket;
}

/**
 * PDF generation request
 */
export interface PdfRequest {
  /** Raw HTML to render */
  html: string;

  /** PDF options */
  options?: PdfOptions;

  /** Apply a named template (future) */
  template?: "proposal" | "report" | "certificate" | "plain";
}

/**
 * PDF generation options
 */
export interface PdfOptions {
  /** Page format */
  format?: "A4" | "Letter";

  /** Landscape orientation */
  landscape?: boolean;

  /** Page margins */
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };

  /** Show header and footer */
  displayHeaderFooter?: boolean;

  /** HTML template for header */
  headerTemplate?: string;

  /** HTML template for footer */
  footerTemplate?: string;

  /** Print background graphics */
  printBackground?: boolean;

  /** Scale of the webpage rendering (0.1 to 2) */
  scale?: number;
}

/**
 * Screenshot generation request
 */
export interface ScreenshotRequest {
  /** Raw HTML to render */
  html: string;

  /** Screenshot options */
  options?: ScreenshotOptions;
}

/**
 * Screenshot generation options
 */
export interface ScreenshotOptions {
  /** Viewport width in pixels */
  width?: number;

  /** Viewport height in pixels */
  height?: number;

  /** Device scale factor (default 2 for retina) */
  scale?: number;

  /** Capture full page or just viewport */
  fullPage?: boolean;

  /** Image format */
  type?: "png" | "jpeg" | "webp";

  /** JPEG/WebP quality (0-100) */
  quality?: number;
}

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;
  details?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: "ok" | "error";
  version: string;
  environment: string;
}

/**
 * Bilingual PDF generation request
 */
export interface BilingualPdfRequest {
  /** English HTML content */
  htmlEn: string;

  /** Japanese HTML content */
  htmlJa: string;

  /** TOC configuration */
  toc: {
    /** Document title (shown on TOC page) */
    title: string;
    /** Japanese title */
    titleJa?: string;
    /** Client/company name (English) */
    clientNameEn?: string;
    /** Client/company name (Japanese) */
    clientNameJa?: string;
    /** Date string (English format) */
    dateEn: string;
    /** Date string (Japanese format) */
    dateJa?: string;
  };

  /** PDF options for individual PDFs */
  options?: PdfOptions;

  /** Which language comes first in combined PDF */
  firstLanguage?: "en" | "ja";
}

/**
 * Bilingual PDF generation response
 */
export interface BilingualPdfResponse {
  /** Combined PDF with TOC */
  combined: ArrayBuffer;
  /** English-only PDF */
  english: ArrayBuffer;
  /** Japanese-only PDF */
  japanese: ArrayBuffer;
  /** Page info */
  pageInfo: {
    tocPages: number;
    englishPages: number;
    japanesePages: number;
    totalPages: number;
  };
}
