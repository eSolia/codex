#!/usr/bin/env node
/**
 * Generate the password-vault-comparison YAML fragment from source markdown files
 */

import { readFileSync, writeFileSync } from 'fs';
import { stringify } from 'yaml';

// Read the source markdown files
const enContent = readFileSync('/Users/rcogley/Downloads/password-vault-comparison-en.md', 'utf-8');
const jaContent = readFileSync('/Users/rcogley/Downloads/password-vault-comparison-ja.md', 'utf-8');

// Process content: remove header (Date/Version) and Contact sections
// NOTE: Blockquote callouts (> **ℹ️ Title**) are kept as-is.
// The import script converts them directly to Tiptap HTML.
function processContent(content) {
  // Remove the header section (title, date, version, first ---)
  let processed = content
    .replace(/^#[^\n]+\n\n\*\*Date:\*\*[^\n]+\n\*\*Version:\*\*[^\n]+\n\n---\n/m, '')
    .replace(/^#[^\n]+\n\n\*\*作成日:\*\*[^\n]+\n\*\*バージョン:\*\*[^\n]+\n\n---\n/m, '');

  // Remove the Contact section at the end
  processed = processed
    .replace(/\n---\n\n## Contact\n[\s\S]*$/m, '')
    .replace(/\n---\n\n## お問い合わせ\n[\s\S]*$/m, '');

  // Remove final disclaimer
  processed = processed
    .replace(/\n---\n\n\*This document is provided[^\n]+\*\n?$/m, '')
    .replace(/\n---\n\n\*本書は情報提供[^\n]+\*\n?$/m, '');

  // Blockquotes with emoji (> **ℹ️ Title**) are kept as blockquotes.
  // The import-single-fragment.ts script handles conversion to Tiptap callout HTML.

  return processed.trim();
}

const fragment = {
  id: 'password-vault-comparison',
  category: 'comparisons',
  version: '2026-01',
  title: {
    en: 'Password Vault Solutions: A Comparison Guide',
    ja: 'パスワード管理ソリューション比較ガイド'
  },
  type: 'comparison',
  tags: [
    'security',
    'password-manager',
    '1password',
    'bitwarden',
    'codebook',
    'authentication',
    'enterprise'
  ],
  status: 'active',
  created: '2026-01-26',
  modified: '2026-01-26',
  author: 'rick.cogley@esolia.co.jp',
  reviewer: null,
  review_due: '2026-04-26',
  sensitivity: 'normal',
  allowed_collections: ['proposals', 'help', 'concepts', 'tutorials'],
  content: {
    en: processContent(enContent),
    ja: processContent(jaContent)
  }
};

// Write YAML with proper formatting
const yamlContent = `# Password Vault Comparison Guide Fragment
# ═══════════════════════════════════════════════════════════════════════════════
# Comprehensive comparison of password manager solutions
# ═══════════════════════════════════════════════════════════════════════════════

${stringify(fragment, { lineWidth: 0 })}`;

writeFileSync(
  '/Users/rcogley/dev/codex/content/fragments/comparisons/password-vault-comparison.yaml',
  yamlContent,
  'utf-8'
);

console.log('Fragment generated successfully!');
console.log(`EN content: ${fragment.content.en.length} characters`);
console.log(`JA content: ${fragment.content.ja.length} characters`);
