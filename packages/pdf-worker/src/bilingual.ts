/**
 * Bilingual PDF Generation with TOC
 * Uses pdf-lib to merge PDFs and create a table of contents with page links
 */

import { PDFDocument, PDFPage, PDFName, PDFArray, PDFDict, rgb, StandardFonts } from "pdf-lib";
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

  // Add clickable links from TOC to language sections
  addTocLinks(combinedPdf, {
    tocPageIndex: 0,
    firstLangPageIndex: tocPages, // 0-indexed: page after TOC
    secondLangPageIndex: firstLanguage === "en" ? tocPages + enPageCount : tocPages + jaPageCount,
    firstEntryY: height - 60 - 30 - 30 - 20 - 60 - 40, // Match drawTocPage layout
    secondEntryY: height - 60 - 30 - 30 - 20 - 60 - 40 - 35,
    width,
    margin: 60,
  });

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

  // Title (English only - pdf-lib StandardFonts don't support CJK)
  page.drawText(title, {
    x: margin,
    y,
    size: 24,
    font: helveticaBold,
    color: ESOLIA_NAVY,
  });
  y -= 30;

  // Note: Japanese title omitted - StandardFonts cannot encode CJK characters
  // The full bilingual content is in the merged PDFs with proper font support

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

  // Date (English format only)
  page.drawText(`Date: ${date}`, {
    x: margin,
    y,
    size: 12,
    font: helvetica,
    color: GRAY_600,
  });
  y -= 60;

  // Table of Contents header
  page.drawText("Table of Contents", {
    x: margin,
    y,
    size: 16,
    font: helveticaBold,
    color: ESOLIA_NAVY,
  });
  y -= 40;

  // Draw TOC entries (English only - StandardFonts don't support CJK)
  const tocEntries = firstLanguage === "en"
    ? [
        { label: "English Version", startPage: enStartPage, pageCount: enPageCount },
        { label: "Japanese Version", startPage: jaStartPage, pageCount: jaPageCount },
      ]
    : [
        { label: "Japanese Version", startPage: jaStartPage, pageCount: jaPageCount },
        { label: "English Version", startPage: enStartPage, pageCount: enPageCount },
      ];

  for (const entry of tocEntries) {
    // Entry label
    const labelText = entry.label;
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

  // Footer (English only)
  const footerY = margin;
  page.drawText(`© ${new Date().getFullYear()} eSolia Inc. — Confidential`, {
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

interface TocLinkOptions {
  tocPageIndex: number;
  firstLangPageIndex: number;
  secondLangPageIndex: number;
  firstEntryY: number;
  secondEntryY: number;
  width: number;
  margin: number;
}

/**
 * Add clickable link annotations to TOC page
 */
function addTocLinks(pdf: PDFDocument, opts: TocLinkOptions): void {
  const {
    tocPageIndex,
    firstLangPageIndex,
    secondLangPageIndex,
    firstEntryY,
    secondEntryY,
    width,
    margin,
  } = opts;

  const tocPage = pdf.getPage(tocPageIndex);
  const context = pdf.context;

  // Helper to create a link annotation to a specific page
  function createLinkAnnotation(
    y: number,
    targetPageIndex: number
  ): PDFDict {
    const targetPage = pdf.getPage(targetPageIndex);

    // Create destination array: [page, /XYZ, left, top, zoom]
    const destArray = context.obj([
      targetPage.ref,
      PDFName.of("XYZ"),
      null, // left (null = current)
      null, // top (null = current, but we want top of page)
      null, // zoom (null = current)
    ]);

    // Create link annotation dictionary
    return context.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Link"),
      Rect: [margin, y - 10, width - margin, y + 20],
      Border: [0, 0, 0],
      Dest: destArray,
    }) as PDFDict;
  }

  // Create annotations for both TOC entries
  const firstLink = createLinkAnnotation(firstEntryY, firstLangPageIndex);
  const secondLink = createLinkAnnotation(secondEntryY, secondLangPageIndex);

  // Register annotations and get references
  const firstLinkRef = context.register(firstLink);
  const secondLinkRef = context.register(secondLink);

  // Add annotations to page's Annots array
  const existingAnnots = tocPage.node.lookup(PDFName.of("Annots"));
  let annotsArray: PDFArray;

  if (existingAnnots instanceof PDFArray) {
    annotsArray = existingAnnots;
  } else {
    annotsArray = context.obj([]) as PDFArray;
  }

  annotsArray.push(firstLinkRef);
  annotsArray.push(secondLinkRef);

  tocPage.node.set(PDFName.of("Annots"), annotsArray);
}
