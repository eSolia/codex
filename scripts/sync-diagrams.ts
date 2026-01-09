/**
 * Sync draw.io diagrams to R2 and create fragment YAML files
 *
 * Finds .drawio files in content/diagrams/, exports them to SVG,
 * uploads to R2, and creates/updates corresponding fragment YAML
 *
 * Run with: npx tsx scripts/sync-diagrams.ts
 *
 * Options:
 *   --local    Skip R2 upload, embed SVG in fragment (for testing)
 *   --dry-run  Show what would be done without making changes
 *
 * Requirements:
 * - draw.io Desktop app installed (for local export)
 * - wrangler CLI configured (for R2 upload)
 * - Or use GitHub Actions with Docker for CI
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse, stringify } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIAGRAMS_DIR = join(__dirname, '..', 'content', 'diagrams');
const FRAGMENTS_DIR = join(__dirname, '..', 'content', 'fragments', 'diagrams');
const R2_BUCKET = 'codex';
const R2_PREFIX = 'diagrams'; // Files stored at diagrams/{filename}.svg in R2

// Parse command line args
const args = process.argv.slice(2);
const LOCAL_MODE = args.includes('--local');
const DRY_RUN = args.includes('--dry-run');

// Detect draw.io CLI path based on platform
function getDrawioCLI(): string {
  const paths = [
    '/Applications/draw.io.app/Contents/MacOS/draw.io', // macOS
    '/usr/bin/drawio', // Linux (snap/apt)
    '/snap/bin/drawio', // Linux (snap)
    'C:\\Program Files\\draw.io\\draw.io.exe', // Windows
    'drawio', // PATH fallback
  ];

  for (const p of paths) {
    try {
      if (p.includes('/') || p.includes('\\')) {
        if (existsSync(p)) return p;
      } else {
        // Check if command exists in PATH
        execSync(`which ${p} 2>/dev/null || where ${p} 2>nul`, { stdio: 'ignore' });
        return p;
      }
    } catch {
      // Continue to next path
    }
  }

  throw new Error(
    'draw.io CLI not found. Please install draw.io Desktop from https://www.drawio.com/'
  );
}

// Check if wrangler is available
function hasWrangler(): boolean {
  try {
    execSync('wrangler --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

interface FragmentYaml {
  id: string;
  category: string;
  version: string;
  title: { en: string; ja: string };
  type: string;
  tags: string[];
  status: string;
  created: string;
  modified: string;
  author: string;
  reviewer: string | null;
  review_due: string;
  sensitivity: string;
  allowed_collections: string[];
  diagram: {
    format: string;
    storage: 'r2' | 'embedded';
    r2_path?: string;
    r2_url?: string;
    source?: string; // For embedded SVG content
    source_file: string;
    file_size?: number;
  };
  content: { en: string; ja: string };
}

function findDrawioFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    console.log(`Directory ${dir} does not exist, creating...`);
    mkdirSync(dir, { recursive: true });
    return [];
  }

  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.drawio')) {
      files.push(join(dir, entry.name));
    }
  }

  return files;
}

function exportToSVG(drawioPath: string, svgPath: string, cli: string): boolean {
  try {
    console.log(`  Exporting: ${basename(drawioPath)} → ${basename(svgPath)}`);

    if (DRY_RUN) {
      console.log(`  [dry-run] Would export SVG`);
      return existsSync(svgPath); // Return true if SVG already exists
    }

    // draw.io CLI export command
    // -x: export mode
    // -f svg: output format
    // -o: output file
    const cmd = `"${cli}" -x -f svg -o "${svgPath}" "${drawioPath}"`;

    execSync(cmd, {
      stdio: 'pipe',
      timeout: 60000, // 60 second timeout for large diagrams
    });

    return existsSync(svgPath);
  } catch (error) {
    console.error(`  Failed to export ${basename(drawioPath)}:`, error);
    return false;
  }
}

function uploadToR2(svgPath: string, r2Key: string): boolean {
  try {
    console.log(`  Uploading to R2: ${r2Key}`);

    if (DRY_RUN) {
      console.log(`  [dry-run] Would upload to R2`);
      return true;
    }

    // Use wrangler r2 object put
    // InfoSec: File content is read from local filesystem, validated by draw.io export
    const cmd = `wrangler r2 object put "${R2_BUCKET}/${r2Key}" --file="${svgPath}" --content-type="image/svg+xml"`;

    execSync(cmd, {
      stdio: 'pipe',
      timeout: 120000, // 2 minute timeout for large files
      cwd: join(__dirname, '..'), // Run from repo root
    });

    console.log(`  ✓ Uploaded to R2: ${r2Key}`);
    return true;
  } catch (error) {
    console.error(`  Failed to upload to R2:`, error);
    return false;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createFragmentYaml(
  id: string,
  svgPath: string,
  sourceFile: string,
  r2Path: string | null,
  existingFragment?: Partial<FragmentYaml>
): FragmentYaml {
  const now = new Date().toISOString().split('T')[0];
  const reviewDue = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Preserve existing metadata if updating
  const existing = existingFragment || {};

  // Generate title from ID (kebab-case to Title Case)
  const defaultTitle = id
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Get file size
  const fileSize = existsSync(svgPath) ? statSync(svgPath).size : 0;

  // Build diagram object based on storage mode
  const diagram: FragmentYaml['diagram'] = {
    format: 'svg',
    storage: r2Path ? 'r2' : 'embedded',
    source_file: sourceFile,
    file_size: fileSize,
  };

  if (r2Path) {
    // R2 storage mode
    diagram.r2_path = r2Path;
    // URL pattern: served through Hanawa API (with or without .svg extension)
    diagram.r2_url = `/api/diagrams/${id}`;
  } else {
    // Embedded mode (local/testing)
    diagram.source = readFileSync(svgPath, 'utf-8');
  }

  // Preserve existing content/captions or use defaults
  const defaultCaption = `Diagram: ${defaultTitle}`;
  const content = existing.content || {
    en: defaultCaption,
    ja: defaultCaption,
  };

  // If switching from embedded to R2, don't carry over SVG content as caption
  if (
    existing.content?.en &&
    existing.content.en.startsWith('<svg') &&
    r2Path
  ) {
    content.en = defaultCaption;
    content.ja = defaultCaption;
  }

  return {
    id,
    category: 'diagrams',
    version: existing.version || now.slice(0, 7), // YYYY-MM
    title: existing.title || {
      en: defaultTitle,
      ja: defaultTitle, // Placeholder - should be translated
    },
    type: 'diagram',
    tags: existing.tags || ['diagram'],
    status: existing.status || 'production',
    created: existing.created || now,
    modified: now,
    author: existing.author || 'rick.cogley@esolia.co.jp',
    reviewer: existing.reviewer || null,
    review_due: existing.review_due || reviewDue,
    sensitivity: existing.sensitivity || 'normal',
    allowed_collections: existing.allowed_collections || ['proposals', 'help', 'concepts', 'blog'],
    diagram,
    content,
  };
}

function syncDiagram(drawioPath: string, cli: string, useR2: boolean): boolean {
  const filename = basename(drawioPath, '.drawio');
  const id = filename; // Use filename as fragment ID

  // Export paths
  const svgPath = join(dirname(drawioPath), `${filename}.svg`);
  const fragmentPath = join(FRAGMENTS_DIR, `${filename}.yaml`);
  const r2Key = `${R2_PREFIX}/${filename}.svg`;

  console.log(`\nProcessing: ${filename}.drawio`);

  // Export to SVG
  if (!exportToSVG(drawioPath, svgPath, cli)) {
    return false;
  }

  // Get file size for reporting
  const fileSize = existsSync(svgPath) ? statSync(svgPath).size : 0;
  console.log(`  SVG size: ${formatFileSize(fileSize)}`);

  // Upload to R2 if enabled
  let r2Path: string | null = null;
  if (useR2) {
    if (uploadToR2(svgPath, r2Key)) {
      r2Path = r2Key;
    } else {
      console.log(`  ⚠ R2 upload failed, falling back to embedded mode`);
    }
  }

  // Check for existing fragment (to preserve metadata)
  let existingFragment: Partial<FragmentYaml> | undefined;
  if (existsSync(fragmentPath)) {
    try {
      const content = readFileSync(fragmentPath, 'utf-8');
      // Find where YAML starts (after header comments)
      const yamlMatch = content.match(/^id:/m);
      if (yamlMatch && yamlMatch.index !== undefined) {
        existingFragment = parse(content.substring(yamlMatch.index)) as Partial<FragmentYaml>;
      } else {
        existingFragment = parse(content) as Partial<FragmentYaml>;
      }
      console.log(`  Updating existing fragment`);
    } catch {
      console.log(`  Creating new fragment`);
    }
  } else {
    console.log(`  Creating new fragment`);
  }

  // Create fragment YAML
  const fragment = createFragmentYaml(
    id,
    svgPath,
    `content/diagrams/${filename}.drawio`,
    r2Path,
    existingFragment
  );

  // Ensure fragments directory exists
  if (!existsSync(FRAGMENTS_DIR)) {
    mkdirSync(FRAGMENTS_DIR, { recursive: true });
  }

  if (DRY_RUN) {
    console.log(`  [dry-run] Would write fragment: ${fragmentPath}`);
    console.log(`  [dry-run] Storage: ${r2Path ? 'R2' : 'embedded'}`);
    return true;
  }

  // Write fragment YAML with header comment
  const storageNote = r2Path
    ? `SVG stored in R2: ${r2Path}`
    : 'SVG embedded in content (use --no-local for R2 storage)';

  const yamlContent = `# ${fragment.title.en} Diagram Fragment
# ${'═'.repeat(75)}
# Auto-generated from: ${fragment.diagram.source_file}
# ${storageNote}
# Last synced: ${new Date().toISOString()}
# ${'═'.repeat(75)}

${stringify(fragment, { lineWidth: 0 })}`;

  writeFileSync(fragmentPath, yamlContent);
  console.log(`  ✓ Fragment saved: ${basename(fragmentPath)}`);

  return true;
}

// Main
async function main() {
  console.log('Draw.io Diagram Sync');
  console.log('====================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - no changes will be made\n');
  }

  // Find draw.io CLI
  let cli: string;
  try {
    cli = getDrawioCLI();
    console.log(`Using draw.io CLI: ${cli}`);
  } catch (error) {
    console.error((error as Error).message);
    console.log('\nAlternative: Run in GitHub Actions with Docker.');
    process.exit(1);
  }

  // Check R2 upload capability
  const canUploadR2 = !LOCAL_MODE && hasWrangler();
  if (LOCAL_MODE) {
    console.log('Local mode: SVGs will be embedded in fragments');
  } else if (canUploadR2) {
    console.log(`R2 bucket: ${R2_BUCKET}/${R2_PREFIX}/`);
  } else {
    console.log('⚠ wrangler not found, falling back to embedded mode');
    console.log('  Install wrangler: npm install -g wrangler');
  }

  // Find .drawio files
  const drawioFiles = findDrawioFiles(DIAGRAMS_DIR);

  if (drawioFiles.length === 0) {
    console.log(`\nNo .drawio files found in ${DIAGRAMS_DIR}`);
    console.log('Add .drawio files to this directory and run again.');
    process.exit(0);
  }

  console.log(`\nFound ${drawioFiles.length} diagram(s) to sync`);

  // Process each diagram
  let successCount = 0;
  for (const file of drawioFiles) {
    if (syncDiagram(file, cli, canUploadR2)) {
      successCount++;
    }
  }

  console.log('\n====================');
  console.log(`Synced ${successCount}/${drawioFiles.length} diagrams`);

  if (successCount > 0) {
    console.log('\nNext steps:');
    console.log('1. Review/edit generated fragments in content/fragments/diagrams/');
    console.log('2. Update titles/captions (especially Japanese)');
    console.log('3. Commit changes');
    if (!canUploadR2 && !LOCAL_MODE) {
      console.log('\n⚠ SVGs are embedded. For R2 storage:');
      console.log('   npm install -g wrangler && wrangler login');
    }
  }
}

main().catch(console.error);
