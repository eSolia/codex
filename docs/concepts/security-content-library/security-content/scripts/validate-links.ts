/**
 * Internal Link Validation Script
 * 
 * Checks that all internal links in content files resolve to existing files.
 */

import { glob } from "glob";
import { readFile, access } from "fs/promises";
import { join, dirname, resolve } from "path";
import chalk from "chalk";

interface LinkInfo {
  source: string;
  target: string;
  line: number;
  text: string;
}

const brokenLinks: LinkInfo[] = [];
const checkedLinks = new Map<string, boolean>();

/**
 * Extract all internal links from markdown content
 */
function extractLinks(content: string, sourcePath: string): LinkInfo[] {
  const links: LinkInfo[] = [];
  const lines = content.split("\n");
  
  // Match [text](url) pattern
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = linkPattern.exec(line)) !== null) {
      const [, text, url] = match;
      
      // Skip external links, anchors, and mailto
      if (
        url.startsWith("http://") ||
        url.startsWith("https://") ||
        url.startsWith("#") ||
        url.startsWith("mailto:")
      ) {
        continue;
      }

      links.push({
        source: sourcePath,
        target: url,
        line: index + 1,
        text,
      });
    }
  });

  return links;
}

/**
 * Resolve a link path relative to the source file
 */
function resolveLinkPath(link: LinkInfo): string {
  const { source, target } = link;
  
  // Remove any anchor
  const [path] = target.split("#");
  
  // Handle absolute paths from content root
  if (path.startsWith("/")) {
    // Map /concepts/ -> content/periodic/concepts/, etc.
    const mappings: Record<string, string> = {
      "/concepts/": "content/periodic/concepts/",
      "/issues/": "content/periodic/issues/",
      "/controls/": "content/pulse/frameworks/",
      "/remediation/": "content/periodic/remediation/",
    };

    for (const [prefix, replacement] of Object.entries(mappings)) {
      if (path.startsWith(prefix)) {
        const relativePath = path.slice(prefix.length);
        return join(replacement, relativePath + ".md");
      }
    }

    // Default: assume content/ prefix
    return join("content", path.slice(1) + ".md");
  }

  // Handle relative paths
  const sourceDir = dirname(source);
  let resolved = resolve(sourceDir, path);
  
  // Add .md extension if not present
  if (!resolved.endsWith(".md") && !resolved.endsWith(".yaml")) {
    resolved += ".md";
  }

  return resolved;
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  if (checkedLinks.has(path)) {
    return checkedLinks.get(path)!;
  }

  try {
    await access(path);
    checkedLinks.set(path, true);
    return true;
  } catch {
    checkedLinks.set(path, false);
    return false;
  }
}

/**
 * Validate all links in a file
 */
async function validateFile(filePath: string): Promise<number> {
  const content = await readFile(filePath, "utf-8");
  const links = extractLinks(content, filePath);
  let broken = 0;

  for (const link of links) {
    const resolvedPath = resolveLinkPath(link);
    const exists = await fileExists(resolvedPath);

    if (!exists) {
      brokenLinks.push(link);
      broken++;
    }
  }

  return broken;
}

/**
 * Main validation runner
 */
async function main() {
  console.log(chalk.bold("\n🔗 Link Validation\n"));

  const files = await glob("content/**/*.md", {
    ignore: ["**/node_modules/**"],
  });

  console.log(chalk.gray(`Checking ${files.length} files...\n`));

  let totalLinks = 0;
  let totalBroken = 0;

  for (const file of files) {
    const broken = await validateFile(file);
    totalBroken += broken;
    
    const content = await readFile(file, "utf-8");
    const links = extractLinks(content, file);
    totalLinks += links.length;
  }

  // Report results
  console.log(chalk.bold("\n📊 Link Check Summary\n"));
  console.log(chalk.gray(`  Total links checked: ${totalLinks}`));
  console.log(chalk.green(`  Valid links: ${totalLinks - totalBroken}`));
  
  if (totalBroken > 0) {
    console.log(chalk.red(`  Broken links: ${totalBroken}`));
    console.log(chalk.bold("\n❌ Broken Links:\n"));

    for (const link of brokenLinks) {
      console.log(chalk.red(`  ${link.source}:${link.line}`));
      console.log(chalk.gray(`    [${link.text}](${link.target})`));
      console.log(chalk.gray(`    Resolved to: ${resolveLinkPath(link)}`));
      console.log();
    }

    process.exit(1);
  }

  console.log(chalk.bold.green("\n✅ All links valid!\n"));
}

main().catch((error) => {
  console.error(chalk.red("Link validation failed:"), error);
  process.exit(1);
});
