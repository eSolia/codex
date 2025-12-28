#!/usr/bin/env -S deno run -A
/**
 * Proposal Generator
 * Assembles fragments, converts to HTML, generates PDF via CF Browser Rendering
 *
 * Usage:
 *   deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-Support-202501.md
 *   deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-Support-202501.md --open
 *   deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-Support-202501.md --lang ja
 *   deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-Support-202501.md --html-only
 */

import { parseArgs } from "jsr:@std/cli@1";
import { parse as parseYaml } from "jsr:@std/yaml@1";
import { join, dirname, basename, fromFileUrl } from "jsr:@std/path@1";
import { ensureDir } from "jsr:@std/fs@1/ensure-dir";

import { expandFragments, validateFragmentReferences } from "./lib/fragments.ts";
import { markdownToHtml, extractFrontmatter, generateToc, addHeadingIds, replaceTocPlaceholder } from "./lib/markdown.ts";
import { generatePdf, loadConfig } from "./lib/pdf.ts";

// Get script directory for template paths
const SCRIPT_DIR = dirname(fromFileUrl(import.meta.url));
const TEMPLATE_DIR = join(SCRIPT_DIR, "..", "templates", "proposal");
const OUTPUT_DIR = join(SCRIPT_DIR, "..", "output");

interface ProposalMeta {
  title?: { en?: string; ja?: string };
  client?: {
    code?: string;
    name_en?: string;
    name_ja?: string;
    logo_url?: string;
  };
  contacts?: Array<{ name: string; title?: string; email?: string }>;
  proposal?: {
    date?: string;
    version?: string;
    preparers?: string[];
    language?: string;
  };
}

/**
 * Load and parse the proposal markdown file
 */
async function loadProposal(inputPath: string): Promise<{ meta: ProposalMeta; content: string }> {
  const markdown = await Deno.readTextFile(inputPath);
  const { frontmatter, content } = extractFrontmatter(markdown);

  // Parse YAML frontmatter more thoroughly
  const fullMarkdown = await Deno.readTextFile(inputPath);
  const yamlMatch = fullMarkdown.match(/^---\s*\n([\s\S]*?)\n---/);

  let meta: ProposalMeta = {};
  if (yamlMatch) {
    try {
      meta = parseYaml(yamlMatch[1]) as ProposalMeta;
    } catch {
      console.warn("Warning: Could not parse YAML frontmatter");
      meta = frontmatter as ProposalMeta;
    }
  }

  return { meta, content };
}

/**
 * Load CSS styles
 */
async function loadStyles(): Promise<string> {
  const stylesPath = join(TEMPLATE_DIR, "styles.css");
  return await Deno.readTextFile(stylesPath);
}

/**
 * Load HTML template
 */
async function loadTemplate(): Promise<string> {
  const templatePath = join(TEMPLATE_DIR, "template.html");
  return await Deno.readTextFile(templatePath);
}

/**
 * Build contacts HTML from metadata
 */
function buildContactsHtml(contacts?: ProposalMeta["contacts"]): string {
  if (!contacts || contacts.length === 0) return "";

  return contacts
    .map((c) => {
      const title = c.title ? `<br><span class="title">${c.title}</span>` : "";
      return `<p>${c.name}${title}</p>`;
    })
    .join("\n");
}

/**
 * Apply template with data
 */
function applyTemplate(
  template: string,
  data: {
    lang: string;
    styles: string;
    title: string;
    titleEn: string;
    titleJa: string;
    date: string;
    version: string;
    preparers: string;
    contacts: string;
    clientNameEn: string;
    clientNameJa: string;
    clientLogo: string;
    content: string;
  }
): string {
  return template
    .replace("{{LANG}}", data.lang)
    .replace("{{STYLES}}", data.styles)
    .replace("{{TITLE}}", data.title)
    .replace("{{TITLE_EN}}", data.titleEn)
    .replace(/\{\{#if TITLE_JA\}\}(.*?)\{\{\/if\}\}/gs, data.titleJa ? "$1" : "")
    .replace("{{TITLE_JA}}", data.titleJa)
    .replace("{{DATE}}", data.date)
    .replace("{{VERSION}}", data.version)
    .replace("{{PREPARERS}}", data.preparers)
    .replace("{{CONTACTS}}", data.contacts)
    .replace("{{CLIENT_NAME_EN}}", data.clientNameEn)
    .replace(/\{\{#if CLIENT_NAME_JA\}\}(.*?)\{\{\/if\}\}/gs, data.clientNameJa ? "$1" : "")
    .replace("{{CLIENT_NAME_JA}}", data.clientNameJa)
    .replace("{{CLIENT_LOGO}}", data.clientLogo)
    .replace("{{CONTENT}}", data.content);
}

/**
 * Main proposal generation function
 */
async function generateProposal(
  inputPath: string,
  options: {
    lang?: "en" | "ja";
    htmlOnly?: boolean;
    open?: boolean;
    output?: string;
  } = {}
): Promise<void> {
  const { lang = "en", htmlOnly = false, open = false } = options;

  console.log(`📄 Loading proposal: ${inputPath}`);

  // Load proposal
  const { meta, content } = await loadProposal(inputPath);

  // Validate fragment references
  console.log("🔍 Validating fragment references...");
  const validation = await validateFragmentReferences(content);
  if (!validation.valid) {
    console.error("❌ Missing fragments:");
    for (const id of validation.missing) {
      console.error(`   - ${id}`);
    }
    Deno.exit(1);
  }
  console.log("✅ All fragments found");

  // Expand fragments
  console.log("🔧 Expanding fragments...");
  const expandedContent = await expandFragments(content, lang);

  // Convert to HTML
  console.log("📝 Converting to HTML...");
  let html = await markdownToHtml(expandedContent);
  html = addHeadingIds(html);

  // Generate TOC and replace [[toc]] placeholder
  const toc = generateToc(html);
  if (toc) {
    html = replaceTocPlaceholder(html, toc);
  }

  // Load template and styles
  const template = await loadTemplate();
  const styles = await loadStyles();

  // Build final HTML
  const titleEn = meta.title?.en || meta.client?.name_en || "Proposal";
  const titleJa = meta.title?.ja || "";
  const clientLogo = meta.client?.logo_url
    ? `<img class="client-logo" src="${meta.client.logo_url}" alt="${meta.client.name_en}">`
    : "";

  const finalHtml = applyTemplate(template, {
    lang: lang === "ja" ? "ja" : "en",
    styles,
    title: titleEn,
    titleEn,
    titleJa,
    date: meta.proposal?.date || new Date().toISOString().split("T")[0],
    version: meta.proposal?.version || "01",
    preparers: meta.proposal?.preparers?.join(", ") || "eSolia Inc.",
    contacts: buildContactsHtml(meta.contacts),
    clientNameEn: meta.client?.name_en || "",
    clientNameJa: meta.client?.name_ja || "",
    clientLogo,
    content: html,
  });

  // Ensure output directory exists
  await ensureDir(OUTPUT_DIR);

  // Determine output filename
  const inputBasename = basename(inputPath, ".md");
  const outputBasename = options.output || inputBasename;

  // Save HTML
  const htmlPath = join(OUTPUT_DIR, `${outputBasename}.html`);
  await Deno.writeTextFile(htmlPath, finalHtml);
  console.log(`✅ HTML saved: ${htmlPath}`);

  if (htmlOnly) {
    if (open) {
      const cmd = new Deno.Command("open", { args: [htmlPath] });
      await cmd.output();
    }
    return;
  }

  // Generate PDF via Cloudflare Browser Rendering
  console.log("🖨️  Generating PDF via Cloudflare Browser Rendering...");
  const config = await loadConfig();

  if (!config) {
    console.error("❌ Cloudflare credentials not found");
    console.error("   Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN");
    console.error("   in environment or .dev.vars file");
    console.log("");
    console.log("💡 You can still use the HTML file: " + htmlPath);
    console.log("   Or convert manually: open in browser → Print → Save as PDF");
    return;
  }

  // Build header/footer templates for PDF
  // Note: Puppeteer templates require inline styles and support special classes:
  // pageNumber, totalPages, date, title, url
  const footerTemplate = `
    <div style="width: 100%; font-size: 9px; font-family: 'IBM Plex Sans', sans-serif; padding: 0 20mm; display: flex; justify-content: space-between; color: #6b7280;">
      <span style="color: #9ca3af;">CONFIDENTIAL</span>
      <span>Page <span class="pageNumber"></span></span>
    </div>
  `;

  try {
    const pdfData = await generatePdf(finalHtml, config, {
      format: "A4",
      margin: { top: "15mm", right: "15mm", bottom: "25mm", left: "15mm" },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate,
    });

    const pdfPath = join(OUTPUT_DIR, `${outputBasename}.pdf`);
    await Deno.writeFile(pdfPath, pdfData);
    console.log(`✅ PDF saved: ${pdfPath}`);

    if (open) {
      const cmd = new Deno.Command("open", { args: [pdfPath] });
      await cmd.output();
    }
  } catch (error) {
    console.error("❌ PDF generation failed:", error);
    console.log("");
    console.log("💡 Fallback: HTML file is available at: " + htmlPath);
    console.log("   Open in browser → Print → Save as PDF");
  }
}

// CLI entry point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["lang", "output"],
    boolean: ["html-only", "open", "help"],
    alias: {
      l: "lang",
      o: "output",
      h: "help",
    },
    default: {
      lang: "en",
    },
  });

  if (args.help || args._.length === 0) {
    console.log(`
Proposal Generator - eSolia Codex

USAGE:
  deno run -A scripts/proposal.ts <input.md> [options]

OPTIONS:
  -l, --lang <en|ja>    Language for fragment expansion (default: en)
  -o, --output <name>   Output filename (without extension)
  --html-only           Generate HTML only, skip PDF
  --open                Open the output file when done
  -h, --help            Show this help message

EXAMPLES:
  # Generate PDF from proposal
  deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-202501.md

  # Generate and open
  deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-202501.md --open

  # Japanese version
  deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-202501.md --lang ja

  # HTML only (no CF credentials needed)
  deno run -A scripts/proposal.ts content/proposals/drafts/PROP-CLIENT-202501.md --html-only

REQUIREMENTS:
  For PDF generation, set these environment variables or create .dev.vars:
    CLOUDFLARE_ACCOUNT_ID=your-account-id
    CLOUDFLARE_API_TOKEN=your-api-token
`);
    Deno.exit(0);
  }

  const inputPath = String(args._[0]);
  await generateProposal(inputPath, {
    lang: args.lang as "en" | "ja",
    htmlOnly: args["html-only"],
    open: args.open,
    output: args.output,
  });
}
