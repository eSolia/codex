/**
 * Bilingual PDF Generation with TOC
 * Generates TOC as HTML (with proper fonts), then merges all PDFs
 */

import { PDFDocument, PDFName, PDFArray, PDFDict } from "pdf-lib";
import type { Env, BilingualPdfRequest, BilingualPdfResponse } from "./types";
import { generatePdf } from "./rendering";

/**
 * Generate bilingual PDFs with a combined version featuring TOC
 */
export async function generateBilingualPdf(
  env: Env,
  request: BilingualPdfRequest
): Promise<BilingualPdfResponse> {
  const { htmlEn, htmlJa, toc, options, firstLanguage = "en" } = request;

  // Generate EN, JA, and TOC PDFs in parallel
  console.log("Generating EN, JA, and TOC PDFs in parallel...");

  // Build TOC HTML
  const tocHtml = buildTocHtml(toc, firstLanguage);

  const [enPdfBytes, jaPdfBytes, tocPdfBytes] = await Promise.all([
    generatePdf(env, htmlEn, options),
    generatePdf(env, htmlJa, options),
    generatePdf(env, tocHtml, {
      ...options,
      // TOC doesn't need header/footer since it has its own
      displayHeaderFooter: false,
    }),
  ]);

  console.log(`EN PDF: ${enPdfBytes.byteLength} bytes, JA PDF: ${jaPdfBytes.byteLength} bytes, TOC PDF: ${tocPdfBytes.byteLength} bytes`);

  // Load PDFs with pdf-lib
  const enPdf = await PDFDocument.load(enPdfBytes);
  const jaPdf = await PDFDocument.load(jaPdfBytes);
  const tocPdf = await PDFDocument.load(tocPdfBytes);

  const enPageCount = enPdf.getPageCount();
  const jaPageCount = jaPdf.getPageCount();
  const tocPageCount = tocPdf.getPageCount();

  console.log(`EN pages: ${enPageCount}, JA pages: ${jaPageCount}, TOC pages: ${tocPageCount}`);

  // Create combined PDF
  const combinedPdf = await PDFDocument.create();

  // Copy TOC pages first
  const tocPages = await combinedPdf.copyPages(tocPdf, tocPdf.getPageIndices());
  tocPages.forEach((page) => combinedPdf.addPage(page));

  // Copy language pages in the correct order
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

  // Calculate page indices for links
  const firstLangPageIndex = tocPageCount;
  const secondLangPageIndex = firstLanguage === "en"
    ? tocPageCount + enPageCount
    : tocPageCount + jaPageCount;

  // Add clickable links from TOC to language sections
  // The TOC entries are positioned at specific Y coordinates in the HTML
  const tocPage = combinedPdf.getPage(0);
  const { height } = tocPage.getSize();

  addTocLinks(combinedPdf, {
    tocPageIndex: 0,
    firstLangPageIndex,
    secondLangPageIndex,
    // These Y positions match the HTML layout (approximate)
    firstEntryY: height - 340,
    secondEntryY: height - 380,
    width: 595.28, // A4 width
    margin: 60,
  });

  // Serialize combined PDF
  const combinedBytes = await combinedPdf.save();

  console.log(`Combined PDF: ${combinedBytes.byteLength} bytes, ${combinedPdf.getPageCount()} pages`);

  return {
    combined: combinedBytes.buffer as ArrayBuffer,
    english: enPdfBytes,
    japanese: jaPdfBytes,
    pageInfo: {
      tocPages: tocPageCount,
      englishPages: enPageCount,
      japanesePages: jaPageCount,
      totalPages: tocPageCount + enPageCount + jaPageCount,
    },
  };
}

interface TocData {
  title: string;
  titleJa?: string;
  clientName?: string;
  date: string;
  dateJa?: string;
}

/**
 * Build TOC page as HTML with proper fonts
 */
function buildTocHtml(toc: TocData, firstLanguage: "en" | "ja"): string {
  const { title, titleJa, clientName, date, dateJa } = toc;

  // eSolia logo SVG
  const logoSvg = `<svg width="160" height="59" viewBox="0 0 531 195" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(39.1401, 37)" fill="none" fill-rule="evenodd">
      <path d="M156.657,52.998C147.81,52.656 139.181,54.04 131.058,56.877C132.812,45.67 132.677,32.026 128.98,15.586L127.844,10.512L123.041,12.49C103.935,20.354 89.655,35.493 82.833,55.123C76.647,72.934 77.724,92.052 85.706,106.261L86.147,107.044C85.494,110.44 85.111,113.837 85.164,117.168L85.188,118.934L86.895,119.375C88.237,119.729 90.297,120 92.94,120C97.772,120 104.524,119.081 112.276,115.997C127.809,109.822 148.487,94.383 158.805,55.917L159.559,53.11L156.657,52.998Z" fill="#FFBC68"/>
      <path d="M43.468,5.831L41.467,4.412L40.802,6.625C31.967,36.074 48.989,49.712 56.718,54.203L58.384,55.174L59.125,53.532C66.954,36.127 61.103,18.298 43.468,5.831" fill="#2D2F63"/>
      <g transform="translate(68.3362, 0)">
        <path d="M31.708,101.172C22.473,104.845 14.892,105.157 10.96,104.686C11.03,102.444 11.336,100.171 11.748,97.899C17.411,97.429 27.458,91.919 35.723,82.631C37.482,80.653 39.142,78.534 40.655,76.339C44.752,70.4 48.825,62.253 51.203,51.641C58.608,48.703 66.524,47.114 74.671,47.067C64.629,81.577 45.87,95.539 31.708,101.172M45.752,54.113C43.781,61.276 40.855,67.88 36.841,73.708C35.434,75.744 33.892,77.71 32.256,79.547C25.063,87.64 17.117,91.96 12.873,93.043C15.669,83.225 21.437,73.566 29.56,65.679C34.445,60.935 39.908,57.085 45.752,54.113M8.364,46.131C14.703,27.861 27.947,13.758 45.67,6.376C49.096,21.763 49.467,35.889 47.059,48.409C39.513,51.747 32.479,56.373 26.328,62.353C18.229,70.223 12.272,79.776 9.047,89.624C3.49,77.039 3.149,61.141 8.364,46.131M52.204,46.361C53.958,35.148 53.822,21.51 50.132,5.07L48.996,-0.004L44.187,1.974C25.08,9.832 10.801,24.977 3.985,44.607C-2.208,62.418 -1.13,81.536 6.851,95.745L7.293,96.528C6.639,99.924 6.263,103.321 6.31,106.652L6.339,108.418L8.046,108.859C9.382,109.213 11.448,109.483 14.085,109.483C18.918,109.483 25.669,108.565 33.421,105.481C48.954,99.306 69.638,83.867 79.957,45.401L80.71,42.594L77.808,42.482C68.955,42.14 60.326,43.524 52.204,46.361" fill="#2D2F63"/>
      </g>
      <path d="M0,37.696C5.038,69.14 32.903,97.381 61.18,95.998C60.609,68.734 32.032,38.944 0,37.696" fill="#2D2F63"/>
      <path d="M192.311,55.627C193.341,48.793 197.555,46.079 202.235,46.079C207.662,46.079 211.405,50.294 211.688,55.627L192.311,55.627ZM202.046,32.6C186.79,32.6 176.872,43.831 176.872,58.993C176.872,76.499 188.567,85.858 206.914,85.858C212.435,85.858 217.492,85.204 221.983,83.615L220.764,72.102C217.397,73.32 213.842,73.879 209.534,73.879C200.734,73.879 194.93,70.978 193.064,64.521L224.884,64.521C225.255,62.831 225.355,60.589 225.355,58.528C225.355,44.767 217.586,32.6 202.046,32.6Z" fill="#2D2F63"/>
      <path d="M260.156,44.769C252.387,42.992 250.05,41.302 250.05,38.218C250.05,34.568 253.323,32.414 259.874,32.414C265.96,32.414 271.105,33.538 276.443,35.222L277.285,19.312C272.04,17.157 267.361,16.033 259.032,16.033C241.904,16.033 234.511,25.204 234.511,37.376C234.511,49.919 241.904,55.064 254.818,57.872C262.311,59.555 265.583,61.244 265.583,65.082C265.583,69.102 261.84,71.445 254.258,71.445C247.054,71.445 240.408,69.856 236.006,67.984L235.258,82.116C240.873,84.265 245.647,85.86 255.194,85.86C273.259,85.86 281.123,76.684 281.123,64.705C281.123,52.35 273.353,47.671 260.156,44.769" fill="#2D2F63"/>
      <path d="M316.017,72.474C309.466,72.474 304.598,67.606 304.598,60.025C304.598,52.726 309.372,47.481 316.017,47.481C322.569,47.481 327.53,52.726 327.53,60.025C327.53,67.606 322.663,72.474 316.017,72.474M316.017,32.601C300.29,32.601 289.341,43.738 289.341,59.183C289.341,74.534 300.384,85.859 316.017,85.859C331.833,85.859 342.693,74.534 342.693,59.183C342.693,43.738 331.833,32.601 316.017,32.601" fill="#2D2F63"/>
      <polygon fill="#2D2F63" points="354.185 84.642 368.694 84.642 368.694 13.509 354.185 13.509"/>
      <path d="M390.121,11.727C384.977,11.727 381.227,15.1 381.227,20.338C381.227,25.577 385.065,28.95 390.121,28.95C395.177,28.95 399.015,25.577 399.015,20.338C399.015,15.1 395.365,11.727 390.121,11.727" fill="#2D2F63"/>
      <polygon fill="#2D2F63" points="382.915 84.642 397.424 84.642 397.424 33.822 382.915 33.822"/>
      <path d="M438.787,70.789C437.38,73.879 434.384,76.405 430.264,76.405C426.715,76.405 423.901,74.815 423.901,71.443C423.901,67.234 426.897,66.016 431.765,64.891C434.855,64.238 437.286,63.302 438.787,62.555L438.787,70.789ZM430.829,32.6C423.06,32.6 416.414,34.472 412.017,36.815L413.047,51.324C417.538,49.264 423.248,47.48 429.328,47.48C435.603,47.48 438.599,49.358 438.599,52.348C438.599,53.661 438.222,54.408 436.633,55.062C434.667,55.815 432.419,56.374 428.304,57.122C417.444,58.905 408.739,62.084 408.739,72.938C408.739,81.461 414.825,85.858 423.248,85.858C430.735,85.858 435.044,82.956 438.787,78.465L438.787,84.639L453.573,84.639L453.573,53.661C453.573,39.993 446.745,32.6 430.829,32.6Z" fill="#2D2F63"/>
    </g>
  </svg>`;

  const tocEntries = firstLanguage === "en"
    ? [
        { label: "English Version", labelJa: "英語版" },
        { label: "Japanese Version", labelJa: "日本語版" },
      ]
    : [
        { label: "Japanese Version", labelJa: "日本語版" },
        { label: "English Version", labelJa: "英語版" },
      ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Table of Contents</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+JP:wght@400;500;600;700&display=block" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'IBM Plex Sans', 'IBM Plex Sans JP', sans-serif;
      line-height: 1.6;
      color: #2D2F63;
      padding: 60px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .logo { margin-bottom: 40px; }
    .title {
      font-size: 28px;
      font-weight: 700;
      color: #2D2F63;
      margin-bottom: 8px;
    }
    .title-ja {
      font-size: 20px;
      font-weight: 500;
      color: #4a4c7a;
      margin-bottom: 20px;
    }
    .divider {
      height: 3px;
      background: #FFBC68;
      margin-bottom: 30px;
    }
    .meta {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
    }
    .toc-header {
      font-size: 18px;
      font-weight: 600;
      color: #2D2F63;
      margin-top: 50px;
      margin-bottom: 8px;
    }
    .toc-header-ja {
      font-size: 14px;
      color: #4a4c7a;
      margin-bottom: 30px;
    }
    .toc-entry {
      display: flex;
      align-items: baseline;
      padding: 12px 0;
      border-bottom: 1px dotted #ddd;
    }
    .toc-label {
      font-size: 16px;
      color: #2D2F63;
    }
    .toc-label-ja {
      font-size: 14px;
      color: #666;
      margin-left: 12px;
    }
    .spacer { flex: 1; }
    .footer {
      margin-top: auto;
      padding-top: 40px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="logo">${logoSvg}</div>

  <h1 class="title">${title}</h1>
  ${titleJa ? `<div class="title-ja">${titleJa}</div>` : ''}

  <div class="divider"></div>

  ${clientName ? `<div class="meta">Prepared for / 宛先: <strong>${clientName}</strong></div>` : ''}
  <div class="meta">Date / 日付: ${date}${dateJa ? ` (${dateJa})` : ''}</div>

  <div class="toc-header">Table of Contents</div>
  <div class="toc-header-ja">目次</div>

  ${tocEntries.map(entry => `
    <div class="toc-entry">
      <span class="toc-label">${entry.label}</span>
      <span class="toc-label-ja">${entry.labelJa}</span>
      <span class="spacer"></span>
    </div>
  `).join('')}

  <div class="footer">
    <span>© ${new Date().getFullYear()} eSolia Inc. — Confidential / 機密</span>
  </div>
</body>
</html>`;
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
      null,
      null,
      null,
    ]);

    // Create link annotation dictionary
    return context.obj({
      Type: PDFName.of("Annot"),
      Subtype: PDFName.of("Link"),
      Rect: [margin, y - 15, width - margin, y + 25],
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
