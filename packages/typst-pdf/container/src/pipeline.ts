/**
 * PDF Generation Pipeline
 *
 * Replicates tools/md-to-pdf/generate.sh in TypeScript:
 *   markdown → pre-process → pandoc → post-process → typst compile → PDF
 *
 * Supports two modes:
 * - "single": one language, one PDF
 * - "bilingual": EN+JA combined with scoped TOCs, plus separate EN/JA PDFs
 */
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preProcessMarkdown, postProcess } from './post-process.js';
import type {
  TypstPdfRequest,
  TypstPdfResponseSingle,
  TypstPdfResponseBilingual,
} from './types.js';

const ASSETS_DIR = '/app/assets';
const FONT_PATH = join(ASSETS_DIR, 'fonts');

/**
 * Strip YAML frontmatter from markdown content.
 * Sections from R2 may include frontmatter that shouldn't appear in the PDF.
 */
function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---')) return markdown;
  const match = markdown.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1]! : markdown;
}

/**
 * Create a temp working directory with required assets.
 */
function createWorkdir(): string {
  const workdir = mkdtempSync(join(tmpdir(), 'typst-pdf-'));
  // Copy template assets
  copyFileSync(join(ASSETS_DIR, 'logo.svg'), join(workdir, 'logo.svg'));
  return workdir;
}

/**
 * Write embedded images (base64) to the workdir.
 */
function writeImages(workdir: string, images: Record<string, string>): void {
  for (const [filename, base64Content] of Object.entries(images)) {
    const buffer = Buffer.from(base64Content, 'base64');
    writeFileSync(join(workdir, filename), buffer);
  }
}

/**
 * Convert markdown to Typst via pandoc.
 */
function markdownToTypst(markdown: string, workdir: string): string {
  const inputPath = join(workdir, 'input.md');
  const outputPath = join(workdir, 'pandoc-output.typ');

  writeFileSync(inputPath, markdown, 'utf-8');

  execSync(
    `pandoc -f markdown+pipe_tables+backtick_code_blocks+fenced_code_blocks -t typst --wrap=none "${inputPath}" -o "${outputPath}"`,
    { cwd: workdir, timeout: 30_000 }
  );

  return readFileSync(outputPath, 'utf-8');
}

/**
 * Compile Typst source to PDF.
 *
 * @param templateName - template filename in assets (e.g., "template.typ")
 * @param contentTypst - Typst content to include
 * @param workdir - working directory
 * @param watermark - optional watermark config
 * @returns PDF as Buffer
 */
function compileTypst(
  templateName: string,
  contentTypst: string,
  workdir: string,
  watermark?: { text: string; enabled: boolean }
): Buffer {
  // Copy template to workdir
  copyFileSync(join(ASSETS_DIR, templateName), join(workdir, templateName));

  // Write content file (referenced by template via #include "content.typ")
  writeFileSync(join(workdir, 'content.typ'), contentTypst, 'utf-8');

  const outputPath = join(workdir, 'output.pdf');

  // Build typst command
  const watermarkText = watermark?.text ?? '';
  const showWatermark = watermark?.enabled ? 'true' : 'false';

  const cmd = [
    'typst compile',
    `--root "${workdir}"`,
    `--font-path "${FONT_PATH}"`,
    `--input "watermark=${watermarkText}"`,
    `--input "show-watermark=${showWatermark}"`,
    `"${join(workdir, templateName)}"`,
    `"${outputPath}"`,
  ].join(' ');

  execSync(cmd, { cwd: workdir, timeout: 60_000 });

  return readFileSync(outputPath);
}

/**
 * Assemble markdown for a single language from sections.
 */
function assembleSingleLanguage(
  request: TypstPdfRequest,
  lang: 'en' | 'ja'
): string {
  const parts: string[] = [];

  // Cover letter
  const coverLetter = lang === 'ja' ? request.coverLetterJa : request.coverLetterEn;
  if (coverLetter) {
    parts.push(stripFrontmatter(coverLetter));
    parts.push('<!-- pagebreak -->');
  }

  // Sections
  for (const section of request.sections) {
    if (section.pageBreakBefore) {
      parts.push('<!-- pagebreak -->');
    }
    const content = lang === 'ja' ? (section.contentJa ?? section.contentEn) : (section.contentEn ?? section.contentJa);
    if (content) {
      parts.push(stripFrontmatter(content));
    }
  }

  return parts.join('\n\n');
}

/**
 * Replace image URLs pointing to /api/diagrams/* with local filenames.
 * The images have been written to the workdir by writeImages().
 */
function rewriteImageUrls(markdown: string): string {
  // Markdown images: ![alt](/api/diagrams/xxx) → ![alt](xxx.svg)
  let result = markdown.replace(
    /!\[([^\]]*)\]\(\/api\/diagrams\/([^)]+)\)/g,
    (_match, alt: string, id: string) => {
      const filename = id.endsWith('.svg') ? id : `${id}.svg`;
      return `![${alt}](${filename})`;
    }
  );
  // HTML img tags: <img src="/api/diagrams/xxx" ... > → <img src="xxx.svg" ... >
  result = result.replace(
    /src=["']\/api\/diagrams\/([^"']+)["']/g,
    (_match, id: string) => {
      const filename = id.endsWith('.svg') ? id : `${id}.svg`;
      return `src="${filename}"`;
    }
  );
  return result;
}

/**
 * Count pages in a PDF file by looking for /Type /Page entries.
 * Simple heuristic — works for Typst-generated PDFs.
 */
function countPdfPages(pdfBuffer: Buffer): number {
  const content = pdfBuffer.toString('latin1');
  const matches = content.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

/**
 * Generate PDF(s) from the request.
 */
export async function generatePdf(
  request: TypstPdfRequest
): Promise<TypstPdfResponseSingle | TypstPdfResponseBilingual> {
  if (request.mode === 'single') {
    return generateSinglePdf(request);
  }
  return generateBilingualPdf(request);
}

/**
 * Generate a single-language PDF.
 */
async function generateSinglePdf(
  request: TypstPdfRequest
): Promise<TypstPdfResponseSingle> {
  const workdir = createWorkdir();
  const lang = request.primaryLanguage ?? 'en';

  // Write images
  if (request.images) {
    writeImages(workdir, request.images);
  }

  // Assemble markdown
  let markdown = assembleSingleLanguage(request, lang);
  markdown = rewriteImageUrls(markdown);
  markdown = preProcessMarkdown(markdown);

  // Pandoc convert
  let typstContent = markdownToTypst(markdown, workdir);

  // Post-process
  typstContent = postProcess(typstContent);

  // Set language in content
  if (lang === 'ja') {
    typstContent = '#set text(lang: "ja")\n' + typstContent;
  }

  // Compile
  const pdfBuffer = compileTypst('template.typ', typstContent, workdir, request.watermark);
  const totalPages = countPdfPages(pdfBuffer);

  return {
    combined: pdfBuffer.toString('base64'),
    pageInfo: { totalPages },
  };
}

/**
 * Generate bilingual PDFs (combined + EN-only + JA-only).
 *
 * The combined PDF uses template-bilingual.typ with scoped TOCs.
 * EN-only and JA-only use template.typ (same as single-language).
 */
async function generateBilingualPdf(
  request: TypstPdfRequest
): Promise<TypstPdfResponseBilingual> {
  const firstLang = request.firstLanguage ?? 'en';
  const secondLang = firstLang === 'en' ? 'ja' : 'en';

  // --- 1. Generate combined bilingual PDF ---
  const combinedWorkdir = createWorkdir();
  if (request.images) writeImages(combinedWorkdir, request.images);

  // Copy bilingual template
  if (existsSync(join(ASSETS_DIR, 'template-bilingual.typ'))) {
    copyFileSync(
      join(ASSETS_DIR, 'template-bilingual.typ'),
      join(combinedWorkdir, 'template-bilingual.typ')
    );
  }

  // Assemble EN and JA markdown blocks
  let markdownFirst = assembleSingleLanguage(request, firstLang);
  let markdownSecond = assembleSingleLanguage(request, secondLang);
  markdownFirst = rewriteImageUrls(markdownFirst);
  markdownSecond = rewriteImageUrls(markdownSecond);
  markdownFirst = preProcessMarkdown(markdownFirst);
  markdownSecond = preProcessMarkdown(markdownSecond);

  // Convert each language block through pandoc separately
  // (pandoc needs separate runs to avoid mixing up the content)
  const workdirFirst = createWorkdir();
  if (request.images) writeImages(workdirFirst, request.images);
  let typstFirst = markdownToTypst(markdownFirst, workdirFirst);
  typstFirst = postProcess(typstFirst);

  const workdirSecond = createWorkdir();
  if (request.images) writeImages(workdirSecond, request.images);
  let typstSecond = markdownToTypst(markdownSecond, workdirSecond);
  typstSecond = postProcess(typstSecond);

  // Assemble combined content with boundary labels
  const langSettingFirst = firstLang === 'ja' ? '#set text(lang: "ja")\n' : '';
  const langSettingSecond = secondLang === 'ja' ? '#set text(lang: "ja")\n' : '#set text(lang: "en")\n';

  const combinedContent = [
    '#metadata(none) <en-start>',
    firstLang === 'en' ? '' : '#metadata(none) <ja-start>',
    langSettingFirst,
    typstFirst,
    '#pagebreak()',
    firstLang === 'en' ? '#metadata(none) <ja-start>' : '#metadata(none) <en-start>',
    langSettingSecond,
    typstSecond,
  ].filter(Boolean).join('\n');

  // Write bilingual template inputs
  const bilingualTitle = request.title;
  const bilingualTitleJa = request.titleJa ?? request.title;
  const clientDisplay = [request.contactName, request.clientName].filter(Boolean).join(', ');
  const clientDisplayJa = [
    request.contactNameJa ?? request.contactName,
    request.clientNameJa ?? request.clientName,
  ].filter(Boolean).join(', ');

  // Write template inputs file for bilingual template
  const templateInputs = [
    `#let doc-title = "${escapeTypst(bilingualTitle)}"`,
    `#let doc-title-ja = "${escapeTypst(bilingualTitleJa)}"`,
    `#let client-display = "${escapeTypst(clientDisplay)}"`,
    `#let client-display-ja = "${escapeTypst(clientDisplayJa)}"`,
    `#let date-en = "${escapeTypst(request.dateEn)}"`,
    `#let date-ja = "${escapeTypst(request.dateJa ?? request.dateEn)}"`,
    `#let first-lang = "${firstLang}"`,
  ].join('\n');

  writeFileSync(join(combinedWorkdir, 'inputs.typ'), templateInputs, 'utf-8');

  // Compile combined
  const combinedPdf = compileTypst(
    'template-bilingual.typ',
    combinedContent,
    combinedWorkdir,
    request.watermark
  );

  // --- 2. Generate EN-only PDF ---
  const enWorkdir = createWorkdir();
  if (request.images) writeImages(enWorkdir, request.images);
  let enMarkdown = assembleSingleLanguage(request, 'en');
  enMarkdown = rewriteImageUrls(enMarkdown);
  enMarkdown = preProcessMarkdown(enMarkdown);
  let enTypst = markdownToTypst(enMarkdown, enWorkdir);
  enTypst = postProcess(enTypst);
  const enPdf = compileTypst('template.typ', enTypst, enWorkdir, request.watermark);

  // --- 3. Generate JA-only PDF ---
  const jaWorkdir = createWorkdir();
  if (request.images) writeImages(jaWorkdir, request.images);
  let jaMarkdown = assembleSingleLanguage(request, 'ja');
  jaMarkdown = rewriteImageUrls(jaMarkdown);
  jaMarkdown = preProcessMarkdown(jaMarkdown);
  let jaTypst = markdownToTypst(jaMarkdown, jaWorkdir);
  jaTypst = postProcess(jaTypst);
  jaTypst = '#set text(lang: "ja")\n' + jaTypst;
  const jaPdf = compileTypst('template.typ', jaTypst, jaWorkdir, request.watermark);

  // Count pages
  const combinedPages = countPdfPages(combinedPdf);
  const enPages = countPdfPages(enPdf);
  const jaPages = countPdfPages(jaPdf);

  return {
    combined: combinedPdf.toString('base64'),
    english: enPdf.toString('base64'),
    japanese: jaPdf.toString('base64'),
    pageInfo: {
      coverPages: 1,
      englishPages: enPages,
      japanesePages: jaPages,
      totalPages: combinedPages,
    },
  };
}

/**
 * Escape special Typst characters in strings used in template variables.
 */
function escapeTypst(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/#/g, '\\#');
}
