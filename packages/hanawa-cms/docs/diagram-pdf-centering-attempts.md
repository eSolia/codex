# Diagram PDF Centering & Font Attempts

## Problem

Diagram SVGs rendered in PDF via Cloudflare Browser Rendering appear left/top aligned instead of centered. Additionally, fonts must be IBM Plex Sans JP for both EN and JA content.

## Root Cause

Mermaid exports SVGs with `width="100%"` and `style="max-width: Xpx;"`. Old import-script SVGs have narrow viewBoxes (~404px) which are narrower than the PDF content area (~700px at 96dpi), so they naturally center. New editor-exported SVGs have wide viewBoxes (~715px) which exceed the content area, filling 100% with no room to center.

## Attempts

| #   | Approach                                                                                    | Centering? | Fonts?         | Notes                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------- | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CSS `max-width: 90%` + `margin: 0 auto` on SVG element via class                            | No         | Yes            | CSS class rules not respected on inline SVGs in print renderer                                                                                        |
| 2   | Replace SVG `width="100%"` with viewBox pixel width, CSS `margin: 0 auto`                   | No         | Yes            | SVG attribute `width` ≠ CSS `width`; block SVG still fills container                                                                                  |
| 3   | `display: flex; justify-content: center` on container                                       | No         | Yes            | Flexbox not working in CF Browser Rendering print mode                                                                                                |
| 4   | Remove SVG `width`, set `style="display: block; width: 90%; margin: 0 auto;"` inline on SVG | No         | Yes            | Inline styles on SVG element ignored in print mode                                                                                                    |
| 5   | `<table width="100%"><tr><td align="center">` wrapping inline SVG                           | No         | Yes            | Table centering also didn't work with inline SVGs                                                                                                     |
| 6   | **Data URI `<img>` tag** (`data:image/svg+xml;base64,...`)                                  | **Yes**    | **No**         | Centering works! But `<img>` sandboxes the SVG - can't inherit page fonts                                                                             |
| 7   | Data URI `<img>` + `@font-face` URLs embedded in SVG `<style>`                              | Yes        | Partial        | EN font loads, JA font (2.2MB woff2) doesn't load from sandboxed `<img>`                                                                              |
| 8   | Inline SVG with explicit pixel `width`/`height` from viewBox                                | No         | Yes            | SVG still fills container despite explicit dimensions                                                                                                 |
| 9   | Inline SVG in `display: inline-block` wrapper div, parent `text-align: center`              | No         | Yes            | SVG defaults to 300px without width attr; still left-aligned; diagram too small                                                                       |
| 10  | Block `<div>` wrapper with `max-width: 90%; margin: 20px auto` + SVG `width="100%"`         | No         | Yes            | `margin: auto` on block div also not respected in CF print mode. Good size though.                                                                    |
| 11  | Data URI `<img>` + embedded IBM Plex Sans JP font (base64 in SVG `<style>`)                 | N/A        | N/A            | ~3MB woff2 per diagram × 12 = ~36MB HTML → PDF generation failed (too large)                                                                          |
| 12  | **Data URI `<img>`** + `sans-serif` font stack                                              | **Yes**    | Serif          | Centering works! But generic `sans-serif` renders as serif for Japanese chars                                                                         |
| 13  | **Data URI `<img>`** + Noto Sans CJK JP font stack + `overflow:visible` on foreignObject    | **Yes**    | **Yes (Noto)** | Centering + Japanese sans-serif both work! Text slightly clips in node boxes (Noto wider than Mermaid default font). `overflow:visible` fix deployed. |

## Key Findings

1. **Inline SVGs always fill their container** in CF Browser Rendering print mode, regardless of `width`, `height`, `max-width`, `margin: auto`, `display: block`, flex, or table centering. None of these CSS techniques work on inline SVGs in this renderer.

2. **Data URI `<img>` tags center correctly** with `text-align: center` on parent + `max-width: 90%` on img. This is the only proven centering method.

3. **Data URI `<img>` SVGs are sandboxed** - they cannot inherit page CSS fonts or load external `@font-face` URLs. Japanese font files are ~2.2MB (woff2), too large to embed as base64.

4. **Font inheritance requires inline SVG** - only inline SVGs can use the page's `@font-face` declarations and wildcard `* { font-family: 'IBM Plex Sans JP' }` rule.

## Constraint Summary

- Centering requires `<img>` (data URI) or a working inline-block wrapper
- Fonts require inline SVG (for page font inheritance)
- These two requirements conflict unless the inline-block wrapper approach works

## Current Approach (Attempt 13)

```html
<div style="text-align: center; margin: 20px 0;">
  <img src="data:image/svg+xml;base64,..." style="max-width: 90%; height: auto;" alt="Diagram" />
</div>
```

SVG pre-processing:

1. Strip all `font-family` (CSS and XML attributes)
2. Convert foreignObject cluster labels to `<text>` elements
3. Remove SVG `width` and `style` attributes (viewBox provides intrinsic size)
4. Inject `<defs><style>` with Noto Sans CJK JP font stack + `overflow:visible` on foreignObject
5. Base64-encode entire SVG → data URI `<img>` tag

**Key insight**: After 12 failed attempts, only `<img>` data URI centering works in CF Browser Rendering print mode. All CSS on inline `<svg>` elements is ignored (margin, flex, text-align, block, inline-block). Font embedding (attempt 11) was too large (~36MB). Solution: use system fonts (Noto Sans CJK JP available in headless Chromium) with `overflow:visible` to handle slight width differences.

## Remaining Issue

Noto Sans CJK JP is slightly wider than Mermaid's default font (trebuchet ms). Node box widths were calculated for trebuchet ms, so text clips slightly on the right. The `overflow:visible` CSS on foreignObject should fix this. Alternative: configure Mermaid editor to use Noto Sans for export.

## What Doesn't Work in CF Browser Rendering Print Mode

- Any CSS on `<svg>` elements (classes, inline styles, width, margin, display)
- Flexbox on containers
- `margin: 0 auto` on block wrapper divs
- `inline-block` + `text-align: center`
- Table centering
- Embedding 2.2MB woff2 fonts as base64 (HTML too large for Browser Rendering)
