/**
 * Bilingual PDF Generation with TOC
 * Uses pdf-lib to merge PDFs and create a table of contents with page links
 */

import { PDFDocument, PDFPage, rgb, StandardFonts } from "pdf-lib";
import type { Env, BilingualPdfRequest, BilingualPdfResponse, PdfOptions } from "./types";
import { generatePdf } from "./rendering";

// eSolia brand colors
const ESOLIA_NAVY = rgb(45 / 255, 47 / 255, 99 / 255); // #2D2F63
const ESOLIA_ORANGE = rgb(255 / 255, 188 / 255, 104 / 255); // #FFBC68
const GRAY_600 = rgb(75 / 255, 85 / 255, 99 / 255);

/**
 * Generate bilingual PDFs with a combined version featuring TOC
 */
export async function generateBilingualPdf(
  env: Env,
  request: BilingualPdfRequest
): Promise<BilingualPdfResponse> {
  const { htmlEn, htmlJa, toc, options, firstLanguage = "en" } = request;

  // Generate both PDFs in parallel
  console.log("Generating EN and JA PDFs in parallel...");
  const [enPdfBytes, jaPdfBytes] = await Promise.all([
    generatePdf(env, htmlEn, options),
    generatePdf(env, htmlJa, options),
  ]);

  console.log(`EN PDF: ${enPdfBytes.byteLength} bytes, JA PDF: ${jaPdfBytes.byteLength} bytes`);

  // Load PDFs with pdf-lib
  const enPdf = await PDFDocument.load(enPdfBytes);
  const jaPdf = await PDFDocument.load(jaPdfBytes);

  const enPageCount = enPdf.getPageCount();
  const jaPageCount = jaPdf.getPageCount();

  console.log(`EN pages: ${enPageCount}, JA pages: ${jaPageCount}`);

  // Create combined PDF with TOC
  const combinedPdf = await PDFDocument.create();

  // Embed fonts
  const helvetica = await combinedPdf.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await combinedPdf.embedFont(StandardFonts.HelveticaBold);

  // Create TOC page (A4 size: 595.28 x 841.89 points)
  const tocPage = combinedPdf.addPage([595.28, 841.89]);
  const { width, height } = tocPage.getSize();

  // Calculate page numbers
  const tocPages = 1;
  const firstLangStartPage = tocPages + 1;
  const secondLangStartPage = firstLanguage === "en"
    ? firstLangStartPage + enPageCount
    : firstLangStartPage + jaPageCount;

  const enStartPage = firstLanguage === "en" ? firstLangStartPage : secondLangStartPage;
  const jaStartPage = firstLanguage === "ja" ? firstLangStartPage : secondLangStartPage;

  // Draw TOC page
  await drawTocPage(tocPage, {
    title: toc.title,
    titleJa: toc.titleJa,
    clientName: toc.clientName,
    date: toc.date,
    dateJa: toc.dateJa,
    enStartPage,
    jaStartPage,
    enPageCount,
    jaPageCount,
    totalPages: tocPages + enPageCount + jaPageCount,
    width,
    height,
    helvetica,
    helveticaBold,
    firstLanguage,
  });

  // Copy pages in the correct order
  if (firstLanguage === "en") {
    const enPages = await combinedPdf.copyPages(enPdf, enPdf.getPageIndices());
    enPages.forEach((page) => combinedPdf.addPage(page));

    const jaPages = await combinedPdf.copyPages(jaPdf, jaPdf.getPageIndices());
    jaPages.forEach((page) => combinedPdf.addPage(page));
  } else {
    const jaPages = await combinedPdf.copyPages(jaPdf, jaPdf.getPageIndices());
    jaPages.forEach((page) => combinedPdf.addPage(page));

    const enPages = await combinedPdf.copyPages(enPdf, enPdf.getPageIndices());
    enPages.forEach((page) => combinedPdf.addPage(page));
  }

  // Note: Clickable TOC links deferred - page numbers are sufficient for navigation

  // Serialize PDFs
  const combinedBytes = await combinedPdf.save();

  console.log(`Combined PDF: ${combinedBytes.byteLength} bytes, ${combinedPdf.getPageCount()} pages`);

  return {
    combined: combinedBytes.buffer as ArrayBuffer,
    english: enPdfBytes,
    japanese: jaPdfBytes,
    pageInfo: {
      tocPages,
      englishPages: enPageCount,
      japanesePages: jaPageCount,
      totalPages: tocPages + enPageCount + jaPageCount,
    },
  };
}

interface TocDrawOptions {
  title: string;
  titleJa?: string;
  clientName?: string;
  date: string;
  dateJa?: string;
  enStartPage: number;
  jaStartPage: number;
  enPageCount: number;
  jaPageCount: number;
  totalPages: number;
  width: number;
  height: number;
  helvetica: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  helveticaBold: Awaited<ReturnType<PDFDocument["embedFont"]>>;
  firstLanguage: "en" | "ja";
}

/**
 * Draw the Table of Contents page
 */
async function drawTocPage(page: PDFPage, opts: TocDrawOptions): Promise<void> {
  const {
    title,
    titleJa,
    clientName,
    date,
    dateJa,
    enStartPage,
    jaStartPage,
    enPageCount,
    jaPageCount,
    totalPages,
    width,
    height,
    helvetica,
    helveticaBold,
    firstLanguage,
  } = opts;

  const margin = 60;
  let y = height - margin;

  // Title
  page.drawText(title, {
    x: margin,
    y,
    size: 24,
    font: helveticaBold,
    color: ESOLIA_NAVY,
  });
  y -= 30;

  // Japanese title (if provided)
  if (titleJa) {
    page.drawText(titleJa, {
      x: margin,
      y,
      size: 18,
      font: helvetica,
      color: ESOLIA_NAVY,
    });
    y -= 25;
  }

  // Orange underline
  page.drawRectangle({
    x: margin,
    y: y - 5,
    width: width - 2 * margin,
    height: 2,
    color: ESOLIA_ORANGE,
  });
  y -= 30;

  // Client name
  if (clientName) {
    page.drawText(`Prepared for: ${clientName}`, {
      x: margin,
      y,
      size: 12,
      font: helvetica,
      color: GRAY_600,
    });
    y -= 20;
  }

  // Date
  const dateText = dateJa ? `${date} / ${dateJa}` : date;
  page.drawText(`Date: ${dateText}`, {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: GRAY_600,
  });
  y -= 60;

  // Table of Contents header
  page.drawText("Table of Contents / 目次", {
    x: margin,
    y,
    size: 16,
    font: helveticaBold,
    color: ESOLIA_NAVY,
  });
  y -= 40;

  // Draw TOC entries
  const tocEntries = firstLanguage === "en"
    ? [
        { label: "English Version", labelJa: "英語版", startPage: enStartPage, pageCount: enPageCount },
        { label: "Japanese Version", labelJa: "日本語版", startPage: jaStartPage, pageCount: jaPageCount },
      ]
    : [
        { label: "Japanese Version", labelJa: "日本語版", startPage: jaStartPage, pageCount: jaPageCount },
        { label: "English Version", labelJa: "英語版", startPage: enStartPage, pageCount: enPageCount },
      ];

  for (const entry of tocEntries) {
    // Entry label
    const labelText = `${entry.label} / ${entry.labelJa}`;
    page.drawText(labelText, {
      x: margin + 20,
      y,
      size: 14,
      font: helvetica,
      color: ESOLIA_NAVY,
    });

    // Page number (right-aligned)
    const pageRange = entry.pageCount > 1
      ? `pp. ${entry.startPage}-${entry.startPage + entry.pageCount - 1}`
      : `p. ${entry.startPage}`;
    const pageWidth = helvetica.widthOfTextAtSize(pageRange, 14);
    page.drawText(pageRange, {
      x: width - margin - pageWidth,
      y,
      size: 14,
      font: helvetica,
      color: GRAY_600,
    });

    // Dotted line between label and page number
    const dotsStartX = margin + 20 + helvetica.widthOfTextAtSize(labelText, 14) + 10;
    const dotsEndX = width - margin - pageWidth - 10;
    const dotSpacing = 6;
    for (let dotX = dotsStartX; dotX < dotsEndX; dotX += dotSpacing) {
      page.drawCircle({
        x: dotX,
        y: y + 4,
        size: 1,
        color: GRAY_600,
      });
    }

    y -= 35;
  }

  // Footer
  const footerY = margin;
  page.drawText(`© ${new Date().getFullYear()} eSolia Inc. — Confidential / 機密`, {
    x: margin,
    y: footerY,
    size: 9,
    font: helvetica,
    color: GRAY_600,
  });

  const totalPagesText = `Total: ${totalPages} pages`;
  const totalPagesWidth = helvetica.widthOfTextAtSize(totalPagesText, 9);
  page.drawText(totalPagesText, {
    x: width - margin - totalPagesWidth,
    y: footerY,
    size: 9,
    font: helvetica,
    color: GRAY_600,
  });
}

// Note: Clickable links in TOC are deferred - pdf-lib's annotation API
// requires low-level PDF object manipulation. The page numbers in TOC
// are sufficient for manual navigation.
