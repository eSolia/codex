/**
 * Fragment Loading and Processing Library
 * Handles loading YAML fragments and expanding references in markdown
 */

import { parse as parseYaml } from "jsr:@std/yaml@1";
import { walk } from "jsr:@std/fs@1/walk";
import { join, dirname, fromFileUrl } from "jsr:@std/path@1";

export interface Fragment {
  id: string;
  title: {
    en: string;
    ja: string;
  };
  type: string;
  category: string;
  tags: string[];
  versions: {
    current: string;
  };
  content: {
    en: string;
    ja: string;
  };
  metadata: {
    last_updated: string;
    author: string;
    usage_notes?: string;
  };
}

// Cache for loaded fragments
const fragmentCache = new Map<string, Fragment>();

/**
 * Get the content directory path
 */
function getContentDir(): string {
  // If running from scripts/, go up one level
  const scriptDir = dirname(fromFileUrl(import.meta.url));
  return join(scriptDir, "..", "..", "content");
}

/**
 * Load a single fragment by ID
 * @param fragmentId - Fragment ID like "proposals/esolia-introduction"
 */
export async function loadFragment(fragmentId: string): Promise<Fragment | null> {
  // Check cache first
  if (fragmentCache.has(fragmentId)) {
    return fragmentCache.get(fragmentId)!;
  }

  const contentDir = getContentDir();
  const fragmentPath = join(contentDir, "fragments", `${fragmentId}.yaml`);

  try {
    const content = await Deno.readTextFile(fragmentPath);
    const fragment = parseYaml(content) as Fragment;
    fragmentCache.set(fragmentId, fragment);
    return fragment;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(`Fragment not found: ${fragmentId}`);
      return null;
    }
    throw error;
  }
}

/**
 * Load all fragments from the content/fragments directory
 */
export async function loadAllFragments(): Promise<Map<string, Fragment>> {
  const contentDir = getContentDir();
  const fragmentsDir = join(contentDir, "fragments");

  for await (const entry of walk(fragmentsDir, {
    exts: [".yaml", ".yml"],
    includeDirs: false,
  })) {
    // Convert path to fragment ID (e.g., "proposals/esolia-introduction")
    const relativePath = entry.path.replace(fragmentsDir + "/", "");
    const fragmentId = relativePath.replace(/\.ya?ml$/, "");

    if (!fragmentCache.has(fragmentId)) {
      try {
        const content = await Deno.readTextFile(entry.path);
        const fragment = parseYaml(content) as Fragment;
        fragmentCache.set(fragmentId, fragment);
      } catch (error) {
        console.error(`Error loading fragment ${fragmentId}:`, error);
      }
    }
  }

  return fragmentCache;
}

/**
 * Fragment reference pattern: {{fragment:id lang="xx" [other attrs]}}
 * Examples:
 *   {{fragment:proposals/esolia-introduction lang="en"}}
 *   {{fragment:products/m365-business-premium lang="ja"}}
 *   {{fragment:proposals/esolia-profile}}  (defaults to "en")
 *   {{fragment:proposals/esolia-project-types lang="en" filter="Medical Devices"}}
 */
const FRAGMENT_PATTERN = /\{\{fragment:([^\s}]+)(?:\s+lang="(en|ja)")?(?:\s+[^}]*)?\}\}/g;

/**
 * Expand all fragment references in markdown content
 * @param markdown - Markdown content with {{fragment:...}} references
 * @param defaultLang - Default language if not specified in reference
 */
export async function expandFragments(
  markdown: string,
  defaultLang: "en" | "ja" = "en"
): Promise<string> {
  // Find all fragment references
  const matches = [...markdown.matchAll(FRAGMENT_PATTERN)];

  if (matches.length === 0) {
    return markdown;
  }

  // Load all referenced fragments
  let result = markdown;

  for (const match of matches) {
    const [fullMatch, fragmentId, lang] = match;
    const language = (lang as "en" | "ja") || defaultLang;

    const fragment = await loadFragment(fragmentId);

    if (fragment) {
      const content = fragment.content[language] || fragment.content.en;
      result = result.replace(fullMatch, content.trim());
    } else {
      // Leave a warning comment if fragment not found
      result = result.replace(
        fullMatch,
        `<!-- WARNING: Fragment not found: ${fragmentId} -->`
      );
    }
  }

  return result;
}

/**
 * List all available fragments
 */
export async function listFragments(): Promise<string[]> {
  await loadAllFragments();
  return [...fragmentCache.keys()].sort();
}

/**
 * Validate that all fragment references in markdown are valid
 */
export async function validateFragmentReferences(
  markdown: string
): Promise<{ valid: boolean; missing: string[] }> {
  const matches = [...markdown.matchAll(FRAGMENT_PATTERN)];
  const missing: string[] = [];

  for (const match of matches) {
    const [, fragmentId] = match;
    const fragment = await loadFragment(fragmentId);
    if (!fragment) {
      missing.push(fragmentId);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

// CLI mode - run directly to test
if (import.meta.main) {
  console.log("Loading all fragments...");
  const fragments = await listFragments();
  console.log(`Found ${fragments.length} fragments:`);
  for (const id of fragments) {
    console.log(`  - ${id}`);
  }
}
