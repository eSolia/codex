/**
 * Typst PDF Service — Shared Request/Response Types
 *
 * These types define the contract between hanawa-cms and the typst-pdf container.
 * The container runs pandoc + typst inside Docker to produce native-typeset PDFs.
 */

/** A single document section (maps to a manifest section) */
export interface PdfSection {
  /** Display label for the section */
  label: string;
  /** Japanese label (for bilingual mode) */
  labelJa?: string;
  /** English markdown content (frontmatter already stripped) */
  contentEn?: string;
  /** Japanese markdown content (frontmatter already stripped) */
  contentJa?: string;
  /** Insert page break before this section */
  pageBreakBefore?: boolean;
}

/** Request body for POST /pdf */
export interface TypstPdfRequest {
  /** "single" for one language, "bilingual" for EN+JA combined */
  mode: 'single' | 'bilingual';

  /** Document title (English) */
  title: string;
  /** Document title (Japanese) */
  titleJa?: string;

  /** Client/company name (English) */
  clientName?: string;
  /** Client/company name (Japanese) */
  clientNameJa?: string;

  /** Contact person name (English) */
  contactName?: string;
  /** Contact person name (Japanese) */
  contactNameJa?: string;

  /** Formatted date (English), e.g., "February 28, 2026" */
  dateEn: string;
  /** Formatted date (Japanese), e.g., "2026年2月28日" */
  dateJa?: string;

  /** Which language comes first in bilingual mode */
  firstLanguage?: 'en' | 'ja';

  /** Primary language for single mode */
  primaryLanguage?: 'en' | 'ja';

  /** Document sections in order */
  sections: PdfSection[];

  /** Cover letter markdown (English) */
  coverLetterEn?: string;
  /** Cover letter markdown (Japanese) */
  coverLetterJa?: string;

  /** Embedded images: filename → base64-encoded content (PNG or SVG) */
  images?: Record<string, string>;

  /** Watermark configuration */
  watermark?: {
    text: string;
    enabled: boolean;
  };
}

/** Response for single-language mode */
export interface TypstPdfResponseSingle {
  /** Base64-encoded PDF */
  combined: string;
  /** Page statistics */
  pageInfo: {
    totalPages: number;
  };
}

/** Response for bilingual mode */
export interface TypstPdfResponseBilingual {
  /** Base64-encoded combined PDF (cover + EN TOC + JA TOC + EN + JA) */
  combined: string;
  /** Base64-encoded English-only PDF */
  english: string;
  /** Base64-encoded Japanese-only PDF */
  japanese: string;
  /** Page statistics */
  pageInfo: {
    coverPages: number;
    englishPages: number;
    japanesePages: number;
    totalPages: number;
  };
}

/** Health check response */
export interface HealthResponse {
  status: 'ok' | 'error';
  version: string;
  pandoc?: string;
  typst?: string;
}
