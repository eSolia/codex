#!/usr/bin/env node
/**
 * Re-render Japanese mermaid diagrams with proper fonts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const R2_BUCKET = 'codex';
const DIAGRAMS_PREFIX = 'diagrams';
const TEMP_DIR = join(__dirname, '../.temp-diagrams');
const MERMAID_CONFIG = join(__dirname, 'mermaid-config.json');
const MERMAID_CSS = join(__dirname, 'mermaid-styles.css');
const MERMAID_PUPPETEER = join(__dirname, 'mermaid-puppeteer.json');

const MERMAID_REGEX = /```mermaid\n([\s\S]*?)```/g;

if (!existsSync(TEMP_DIR)) {
  mkdirSync(TEMP_DIR, { recursive: true });
}

// Read the original Japanese markdown
const jaContent = readFileSync('/Users/rcogley/Downloads/password-vault-comparison-ja.md', 'utf-8');

// Extract all mermaid blocks
const matches = [];
let match;
while ((match = MERMAID_REGEX.exec(jaContent)) !== null) {
  matches.push(match[1].trim());
}

console.log(`Found ${matches.length} mermaid diagrams in Japanese file\n`);

for (let i = 0; i < matches.length; i++) {
  const source = matches[i];
  const diagramId = `password-vault-comparison-ja-${i + 1}`;
  const svgFilename = `${diagramId}.svg`;
  const inputPath = join(TEMP_DIR, `${diagramId}.mmd`);
  const outputPath = join(TEMP_DIR, svgFilename);
  const r2Key = `${DIAGRAMS_PREFIX}/${svgFilename}`;

  console.log(`Processing diagram ${i + 1}: ${diagramId}`);

  // Write mermaid source
  writeFileSync(inputPath, source, 'utf-8');

  // Build mmdc args
  const mmdcArgs = ['-i', inputPath, '-o', outputPath, '-b', 'transparent'];
  if (existsSync(MERMAID_CONFIG)) mmdcArgs.push('-c', MERMAID_CONFIG);
  if (existsSync(MERMAID_CSS)) mmdcArgs.push('-C', MERMAID_CSS);
  if (existsSync(MERMAID_PUPPETEER)) mmdcArgs.push('-p', MERMAID_PUPPETEER);

  // Run mermaid-cli
  const result = spawnSync('mmdc', mmdcArgs, {
    stdio: 'pipe',
    timeout: 60000,
  });

  if (result.status !== 0) {
    console.error(`  ✗ Error rendering: ${result.stderr?.toString()}`);
    continue;
  }

  const svg = readFileSync(outputPath, 'utf-8');
  console.log(`  ✓ Rendered SVG (${svg.length} bytes)`);

  // Upload to R2
  const uploadResult = spawnSync(
    'wrangler',
    ['r2', 'object', 'put', `${R2_BUCKET}/${r2Key}`, '--file', outputPath, '--content-type', 'image/svg+xml', '--remote'],
    { stdio: 'pipe', timeout: 30000 }
  );

  if (uploadResult.status !== 0) {
    console.error(`  ✗ Upload failed: ${uploadResult.stderr?.toString()}`);
  } else {
    console.log(`  ✓ Uploaded to R2: ${r2Key}`);
  }

  // Cleanup
  if (existsSync(inputPath)) unlinkSync(inputPath);
  if (existsSync(outputPath)) unlinkSync(outputPath);
}

console.log('\nDone!');
