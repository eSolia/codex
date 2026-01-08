# Bilingual PDF Implementation

Technical documentation for the bilingual PDF generation feature, including the Table of Contents with clickable internal links.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Bilingual PDF Generation                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: htmlEn, htmlJa, toc data, firstLanguage                 │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  1. Generate     │  Browser Rendering API                    │
│  │     PDFs         │  ├── EN PDF from htmlEn                   │
│  │  (in parallel)   │  ├── JA PDF from htmlJa                   │
│  │                  │  └── TOC PDF from generated HTML          │
│  └────────┬─────────┘                                           │
│           │                                                      │
│  ┌────────▼─────────┐                                           │
│  │  2. Merge with   │  pdf-lib                                  │
│  │     pdf-lib      │  ├── Copy TOC pages first                 │
│  │                  │  ├── Copy first language pages            │
│  │                  │  └── Copy second language pages           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│  ┌────────▼─────────┐                                           │
│  │  3. Add TOC      │  pdf-lib annotations                      │
│  │     Links        │  ├── Calculate Y positions                │
│  │                  │  ├── Create GoTo actions                  │
│  │                  │  └── Register annotations                 │
│  └────────┬─────────┘                                           │
│           │                                                      │
│  Output: combined PDF, english PDF, japanese PDF                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Implementation Details

### 1. TOC Page Generation

The TOC page is generated as HTML and rendered via Browser Rendering API. This approach was chosen over pdf-lib's text drawing because:

- **Font support**: pdf-lib's `StandardFonts` (Helvetica, etc.) don't support custom fonts
- **Brand consistency**: eSolia uses IBM Plex Sans, which requires proper font loading
- **Layout flexibility**: HTML/CSS provides better control over complex layouts

```typescript
// TOC HTML includes Google Fonts via <link> tags
const tocHtml = buildTocHtml(toc, firstLanguage);
const tocPdfBytes = await generatePdf(env, tocHtml, options);
```

### 2. PDF Merging with pdf-lib

Pages are copied in the correct order based on `firstLanguage`:

```typescript
// Copy TOC pages first
const tocPages = await combinedPdf.copyPages(tocPdf, tocPdf.getPageIndices());
tocPages.forEach((page) => combinedPdf.addPage(page));

// Copy language pages in correct order
if (firstLanguage === "en") {
  // EN pages, then JA pages
} else {
  // JA pages, then EN pages
}
```

### 3. TOC Link Annotations

This was the most challenging part. PDF internal links require:

1. **Correct page references**: References to the actual page objects in the combined PDF
2. **Accurate Y coordinates**: PDF coordinates start from bottom-left (0,0)
3. **GoTo actions**: More reliable than direct `Dest` arrays

#### Coordinate System

```
PDF Page (US Letter: 612×792 points)
┌────────────────────────────────────┐ ▲
│                                    │ │
│   TOC Header area                  │ │
│   ─────────────────                │ │
│                                    │ │
│   Entry 1: "English Version"       │ │  Y increases
│   ─────────────────────────        │ │  going UP
│   Entry 2: "Japanese Version"      │ │
│   ─────────────────────────        │ │
│                                    │ │
│                                    │ │
│   Footer                           │ │
└────────────────────────────────────┘ │
(0,0) ──────────────────────────────────►
      X increases going RIGHT
```

#### Y Position Calculation

The TOC entries are positioned based on the HTML layout:

```typescript
// TOC entries are approximately 465px and 510px from the top
// PDF Y = page height - distance from top
firstEntryY: height - 465,  // ~465px from top (English Version)
secondEntryY: height - 510, // ~510px from top (Japanese Version)
```

**Important**: These values were determined empirically by:
1. Adding debug rectangles to visualize positions
2. Comparing rectangle positions to actual TOC entry text
3. Adjusting until alignment was correct

#### Creating Link Annotations

```typescript
function createLinkAnnotation(y: number, targetPageIndex: number): PDFDict {
  const targetPage = pdf.getPage(targetPageIndex);
  const pageRef = targetPage.ref;

  // Destination: [page ref, /Fit] - fit entire page in window
  const destArray = context.obj([
    pageRef,
    PDFName.of("Fit"),
  ]);

  // GoTo action (more reliable than direct Dest)
  const action = context.obj({
    Type: PDFName.of("Action"),
    S: PDFName.of("GoTo"),
    D: destArray,
  });

  // Link annotation
  return context.obj({
    Type: PDFName.of("Annot"),
    Subtype: PDFName.of("Link"),
    Rect: [margin, y - 15, width - margin, y + 25], // Clickable area
    Border: [0, 0, 0], // No visible border
    A: action,
  }) as PDFDict;
}
```

#### Registering Annotations

```typescript
// Add P (page) entry for proper parent reference
firstLink.set(PDFName.of("P"), tocPageRef);
secondLink.set(PDFName.of("P"), tocPageRef);

// Register with PDF context
const firstLinkRef = context.register(firstLink);
const secondLinkRef = context.register(secondLink);

// Add to page's Annots array
const annotsArray = context.obj([firstLinkRef, secondLinkRef]) as PDFArray;
tocPage.node.set(PDFName.of("Annots"), annotsArray);
```

## Debugging Techniques

When TOC links don't work, use these debugging approaches:

### 1. Add Visible Debug Rectangles

```typescript
import { rgb } from "pdf-lib";

tocPage.drawRectangle({
  x: margin,
  y: firstEntryY - 15,
  width: width - 2 * margin,
  height: 40,
  borderColor: rgb(1, 0, 0), // Red
  borderWidth: 2,
});
```

This draws actual rectangles on the PDF to visualize where clickable areas are positioned.

### 2. Log Page References

```typescript
const totalPages = pdf.getPageCount();
for (let i = 0; i < totalPages; i++) {
  const p = pdf.getPage(i);
  console.log(`Page ${i}: ref=${p.ref}`);
}
```

Verify that page indices match expected page references.

### 3. Log Annotation Details

```typescript
console.log(`Creating link: y=${y}, targetPage=${targetPageIndex}`);
console.log(`Annotation rect: [${rect.join(', ')}]`);
```

## Common Issues and Solutions

### Issue: Links go to wrong page

**Cause**: Page references are being looked up before all pages are added to the combined PDF.

**Solution**: Create annotations AFTER all pages have been copied and added.

### Issue: Links not clickable

**Cause**: Y coordinates don't match actual TOC entry positions.

**Solution**: Use debug rectangles to visualize clickable areas, then adjust Y values.

### Issue: Only one link works

**Cause**: Annotations array not properly registered or Y coordinates overlapping.

**Solution**: Ensure both annotations are registered and added to the Annots array.

### Issue: Fonts don't render in TOC

**Cause**: Using pdf-lib's StandardFonts which don't support custom fonts.

**Solution**: Generate TOC as HTML with Google Fonts, render via Browser Rendering API.

## File Structure

```
packages/pdf-worker/
├── src/
│   ├── index.ts        # Hono router, endpoint definitions
│   ├── bilingual.ts    # Bilingual PDF generation logic
│   ├── rendering.ts    # Browser Rendering API wrapper
│   ├── types.ts        # TypeScript interfaces
│   └── auth.ts         # Authentication middleware
├── docs/
│   └── bilingual-pdf-implementation.md  # This file
└── README.md           # API documentation
```

## Dependencies

- **pdf-lib**: PDF manipulation (merging, annotations)
- **@cloudflare/puppeteer**: Browser Rendering API client
- **hono**: Web framework for routing

## Related Documentation

- [Cloudflare Browser Rendering API](https://developers.cloudflare.com/browser-rendering/)
- [pdf-lib Documentation](https://pdf-lib.js.org/)
- [PDF Reference - Annotations](https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf) (Section 12.5)

---

*Last updated: 2026-01-08*
