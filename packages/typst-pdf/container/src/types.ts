/**
 * Typst PDF Container — Request/Response Types
 *
 * Mirrors packages/typst-pdf/src/types.ts.
 * Kept as a standalone copy since the container is a separate Node.js app.
 */

/** A single document section */
export interface PdfSection {
  label: string;
  labelJa?: string;
  contentEn?: string;
  contentJa?: string;
  pageBreakBefore?: boolean;
}

/** Request body for POST /pdf */
export interface TypstPdfRequest {
  mode: 'single' | 'bilingual';
  title: string;
  titleJa?: string;
  clientName?: string;
  clientNameJa?: string;
  contactName?: string;
  contactNameJa?: string;
  dateEn: string;
  dateJa?: string;
  firstLanguage?: 'en' | 'ja';
  primaryLanguage?: 'en' | 'ja';
  sections: PdfSection[];
  coverLetterEn?: string;
  coverLetterJa?: string;
  images?: Record<string, string>;
  watermark?: {
    text: string;
    enabled: boolean;
  };
}

/** Response for single-language mode */
export interface TypstPdfResponseSingle {
  combined: string;
  pageInfo: {
    totalPages: number;
  };
}

/** Response for bilingual mode */
export interface TypstPdfResponseBilingual {
  combined: string;
  english: string;
  japanese: string;
  pageInfo: {
    coverPages: number;
    englishPages: number;
    japanesePages: number;
    totalPages: number;
  };
}
