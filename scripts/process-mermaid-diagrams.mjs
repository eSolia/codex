#!/usr/bin/env node
/**
 * Process Mermaid Diagrams in Markdown/YAML Content
 *
 * This script:
 * 1. Reads a markdown or YAML fragment file
 * 2. Extracts all mermaid code blocks
 * 3. Renders each to SVG using @mermaid-js/mermaid-cli
 * 4. Uploads SVGs to R2 via wrangler
 * 5. Replaces code blocks with proper Tiptap mermaidBlock HTML
 *
 * Usage:
 *   node scripts/process-mermaid-diagrams.mjs <input-file> --upload
 *
 * Prerequisites:
 *   npm install -g @mermaid-js/mermaid-cli
 *   wrangler must be authenticated with R2 access
 *
 * Example:
 *   node scripts/process-mermaid-diagrams.mjs content/fragments/comparisons/password-vault-comparison.yaml --upload
 *
 * After running, re-import the fragment to D1:
 *   cd packages/hanawa-cms && npx tsx scripts/import-single-fragment.ts ../../content/fragments/comparisons/password-vault-comparison.yaml
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { parse, stringify } from 'yaml';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const R2_BUCKET = 'codex';
// R2 path must match /api/diagrams/[id] which expects diagrams/{id}.svg (flat, no subdirs)
const DIAGRAMS_PREFIX = 'diagrams';
const TEMP_DIR = join(__dirname, '../.temp-diagrams');
const MERMAID_CONFIG = join(__dirname, 'mermaid-config.json');
const MERMAID_CSS = join(__dirname, 'mermaid-styles.css');
const MERMAID_PUPPETEER = join(__dirname, 'mermaid-puppeteer.json');

// Regex to match mermaid code blocks
const MERMAID_REGEX = /```mermaid\n([\s\S]*?)```/g;

/**
 * Check if mermaid-cli is installed
 */
function checkMermaidCli() {
  try {
    execSync('mmdc --version', { stdio: 'pipe' });
    return true;
  } catch {
    console.error('Error: @mermaid-js/mermaid-cli (mmdc) not found.');
    console.error('Install it with: npm install -g @mermaid-js/mermaid-cli');
    return false;
  }
}

/**
 * Render mermaid source to SVG file
 */
function renderMermaidToSvg(source, outputPath) {
  // Create temp input file
  const inputPath = outputPath.replace('.svg', '.mmd');
  writeFileSync(inputPath, source, 'utf-8');

  try {
    // Build mmdc arguments with config file and CSS for proper fonts
    const mmdcArgs = ['-i', inputPath, '-o', outputPath, '-b', 'transparent'];
    if (existsSync(MERMAID_CONFIG)) {
      mmdcArgs.push('-c', MERMAID_CONFIG);
    }
    if (existsSync(MERMAID_CSS)) {
      mmdcArgs.push('-C', MERMAID_CSS);
    }
    if (existsSync(MERMAID_PUPPETEER)) {
      mmdcArgs.push('-p', MERMAID_PUPPETEER);
    }

    // Run mermaid-cli with longer timeout for font loading
    const result = spawnSync('mmdc', mmdcArgs, {
      stdio: 'pipe',
      timeout: 60000,
    });

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() || '';
      throw new Error(`mmdc failed: ${stderr}`);
    }

    // Read and return the SVG content
    const svg = readFileSync(outputPath, 'utf-8');

    // Clean up input file
    unlinkSync(inputPath);

    return svg;
  } catch (err) {
    // Clean up on error
    if (existsSync(inputPath)) unlinkSync(inputPath);
    throw err;
  }
}

/**
 * Upload SVG to R2 using wrangler
 */
async function uploadToR2(svgContent, r2Key) {
  const tempSvgPath = join(TEMP_DIR, basename(r2Key));
  writeFileSync(tempSvgPath, svgContent, 'utf-8');

  try {
    // Use wrangler to upload to REMOTE R2 (not local)
    const result = spawnSync(
      'wrangler',
      ['r2', 'object', 'put', `${R2_BUCKET}/${r2Key}`, '--file', tempSvgPath, '--content-type', 'image/svg+xml', '--remote'],
      {
        stdio: 'pipe',
        timeout: 30000,
      }
    );

    if (result.status !== 0) {
      const stderr = result.stderr?.toString() || '';
      throw new Error(`wrangler r2 put failed: ${stderr}`);
    }

    // Debug: Show wrangler output
    const stdout = result.stdout?.toString() || '';
    if (stdout.includes('local') || stdout.includes('Local')) {
      console.warn(`  ⚠ Warning: Upload may be local - ${stdout.trim()}`);
    }
    console.log(`  ✓ Uploaded to R2: ${r2Key}`);
    return true;
  } finally {
    if (existsSync(tempSvgPath)) unlinkSync(tempSvgPath);
  }
}

/**
 * Process content and replace mermaid blocks with image references
 */
async function processContent(content, fragmentId, language, shouldUpload) {
  const diagrams = [];
  let processedContent = content;
  let diagramIndex = 0;

  // Reset regex
  MERMAID_REGEX.lastIndex = 0;

  // Find all matches first (to avoid modifying while iterating)
  const matches = [];
  let match;
  while ((match = MERMAID_REGEX.exec(content)) !== null) {
    matches.push({
      fullMatch: match[0],
      source: match[1].trim(),
      index: match.index,
    });
  }

  console.log(`  Found ${matches.length} mermaid diagrams in ${language} content`);

  for (const m of matches) {
    diagramIndex++;
    const diagramId = `${fragmentId}-${language}-${diagramIndex}`;
    const svgFilename = `${diagramId}.svg`;
    const r2Key = `${DIAGRAMS_PREFIX}/${svgFilename}`;
    const svgPath = join(TEMP_DIR, svgFilename);

    console.log(`  Processing diagram ${diagramIndex}: ${diagramId}`);

    try {
      // Render to SVG
      const svg = renderMermaidToSvg(m.source, svgPath);
      console.log(`    ✓ Rendered SVG (${svg.length} bytes)`);

      // Upload to R2 if requested
      if (shouldUpload) {
        await uploadToR2(svg, r2Key);
      }

      // Replace code block with image reference
      // Use a format that the PDF generator can handle
      const imageRef = `![${diagramId}](/api/diagrams/${diagramId})`;
      processedContent = processedContent.replace(m.fullMatch, imageRef);

      diagrams.push({
        id: diagramId,
        r2Key,
        language,
        uploaded: shouldUpload,
      });
    } catch (err) {
      console.error(`    ✗ Error: ${err.message}`);
      // Keep original code block on error
    }
  }

  return { content: processedContent, diagrams };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: node scripts/process-mermaid-diagrams.mjs <input-file> [--upload] [--dry-run]

Options:
  --upload    Upload SVGs to R2 (requires wrangler authentication)
  --dry-run   Show what would be done without making changes

Example:
  node scripts/process-mermaid-diagrams.mjs content/fragments/comparisons/password-vault-comparison.yaml --upload
`);
    process.exit(0);
  }

  const inputFile = args.find((a) => !a.startsWith('--'));
  const shouldUpload = args.includes('--upload');
  const dryRun = args.includes('--dry-run');

  if (!inputFile) {
    console.error('Error: No input file specified');
    process.exit(1);
  }

  // Check prerequisites
  if (!checkMermaidCli()) {
    process.exit(1);
  }

  // Create temp directory
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }

  console.log(`\nProcessing: ${inputFile}`);
  console.log(`Upload to R2: ${shouldUpload ? 'Yes' : 'No'}`);
  console.log(`Dry run: ${dryRun ? 'Yes' : 'No'}\n`);

  // Read input file
  const content = readFileSync(inputFile, 'utf-8');
  const isYaml = inputFile.endsWith('.yaml') || inputFile.endsWith('.yml');

  if (isYaml) {
    // Parse YAML fragment
    const fragment = parse(content);
    const fragmentId = fragment.id || basename(inputFile, '.yaml');

    console.log(`Fragment ID: ${fragmentId}`);

    const allDiagrams = [];

    // Process EN content
    if (fragment.content?.en) {
      console.log('\nProcessing EN content...');
      const result = await processContent(fragment.content.en, fragmentId, 'en', shouldUpload && !dryRun);
      fragment.content.en = result.content;
      allDiagrams.push(...result.diagrams);
    }

    // Process JA content
    if (fragment.content?.ja) {
      console.log('\nProcessing JA content...');
      const result = await processContent(fragment.content.ja, fragmentId, 'ja', shouldUpload && !dryRun);
      fragment.content.ja = result.content;
      allDiagrams.push(...result.diagrams);
    }

    // Summary
    console.log('\n--- Summary ---');
    console.log(`Total diagrams processed: ${allDiagrams.length}`);
    for (const d of allDiagrams) {
      console.log(`  - ${d.id}: ${d.uploaded ? '✓ uploaded' : 'local only'}`);
    }

    // Write updated YAML
    if (!dryRun && allDiagrams.length > 0) {
      const outputContent = stringify(fragment, { lineWidth: 0 });
      writeFileSync(inputFile, outputContent, 'utf-8');
      console.log(`\n✓ Updated: ${inputFile}`);
    } else if (dryRun) {
      console.log('\nDry run - no files modified');
    }
  } else {
    // Process as plain markdown
    console.log('Processing as markdown file...');
    const fragmentId = basename(inputFile, '.md');
    const result = await processContent(content, fragmentId, 'en', shouldUpload && !dryRun);

    console.log('\n--- Summary ---');
    console.log(`Diagrams processed: ${result.diagrams.length}`);

    if (!dryRun && result.diagrams.length > 0) {
      writeFileSync(inputFile, result.content, 'utf-8');
      console.log(`\n✓ Updated: ${inputFile}`);
    }
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
