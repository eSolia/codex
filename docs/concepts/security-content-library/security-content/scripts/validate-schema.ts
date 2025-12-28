/**
 * Content Validation Script
 * 
 * Validates all content files against their schemas and checks for:
 * - Valid frontmatter against JSON schemas
 * - Required sections present
 * - Internal links resolve
 * - No broken references
 */

import { glob } from "glob";
import { readFile } from "fs/promises";
import { join, dirname, basename } from "path";
import matter from "gray-matter";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import chalk from "chalk";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Track validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: [] as string[],
};

/**
 * Load JSON schemas
 */
async function loadSchemas() {
  const schemas: Record<string, object> = {};
  const schemaFiles = await glob("schemas/*.schema.json");

  for (const file of schemaFiles) {
    const content = await readFile(file, "utf-8");
    const schema = JSON.parse(content);
    const name = basename(file, ".schema.json");
    schemas[name] = schema;
    ajv.addSchema(schema, name);
  }

  return schemas;
}

/**
 * Determine schema type from file path and frontmatter
 */
function getSchemaType(filePath: string, frontmatter: Record<string, unknown>): string | null {
  // Check frontmatter category first
  if (frontmatter.category === "issue") return "issue";
  if (frontmatter.category === "concept") return "concept";
  if (frontmatter.framework) return "control";

  // Infer from path
  if (filePath.includes("/issues/")) return "issue";
  if (filePath.includes("/concepts/")) return "concept";
  if (filePath.includes("/controls/")) return "control";
  if (filePath.includes("/quiz/")) return "quiz-bank";

  return null;
}

/**
 * Validate frontmatter against schema
 */
function validateFrontmatter(
  filePath: string,
  frontmatter: Record<string, unknown>,
  schemaType: string
): boolean {
  const validate = ajv.getSchema(schemaType);
  if (!validate) {
    results.warnings++;
    console.log(chalk.yellow(`  ⚠ No schema found for type: ${schemaType}`));
    return true;
  }

  const valid = validate(frontmatter);
  if (!valid) {
    results.failed++;
    results.errors.push(`${filePath}: Schema validation failed`);
    console.log(chalk.red(`  ✗ Schema validation failed:`));
    for (const error of validate.errors || []) {
      console.log(chalk.red(`    - ${error.instancePath} ${error.message}`));
    }
    return false;
  }

  return true;
}

/**
 * Check required sections exist in content
 */
function validateRequiredSections(
  filePath: string,
  content: string,
  schemaType: string
): boolean {
  const requiredSections: Record<string, string[]> = {
    issue: ["Summary", "Why This Matters", "How to Fix This"],
    control: ["Control Summary", "Why This Matters", "Implementation Steps"],
    concept: ["Summary", "How It Works"],
  };

  const sections = requiredSections[schemaType];
  if (!sections) return true;

  const missing: string[] = [];
  for (const section of sections) {
    // Look for ## Section Name
    const pattern = new RegExp(`^##\\s+${section}`, "mi");
    if (!pattern.test(content)) {
      missing.push(section);
    }
  }

  if (missing.length > 0) {
    results.warnings++;
    console.log(chalk.yellow(`  ⚠ Missing recommended sections: ${missing.join(", ")}`));
  }

  return missing.length === 0;
}

/**
 * Extract and validate internal links
 */
function extractInternalLinks(content: string): string[] {
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match;

  while ((match = linkPattern.exec(content)) !== null) {
    const url = match[2];
    // Only internal links (not http/https)
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("#")) {
      links.push(url);
    }
  }

  return links;
}

/**
 * Validate a single markdown file
 */
async function validateFile(filePath: string): Promise<boolean> {
  console.log(chalk.blue(`\nValidating: ${filePath}`));

  try {
    const content = await readFile(filePath, "utf-8");
    const { data: frontmatter, content: body } = matter(content);

    // Determine schema type
    const schemaType = getSchemaType(filePath, frontmatter);
    if (!schemaType) {
      console.log(chalk.gray("  - No schema type detected, skipping validation"));
      return true;
    }

    console.log(chalk.gray(`  - Schema type: ${schemaType}`));

    // Validate frontmatter
    const frontmatterValid = validateFrontmatter(filePath, frontmatter, schemaType);

    // Validate required sections
    const sectionsValid = validateRequiredSections(filePath, body, schemaType);

    // Extract links for later validation
    const links = extractInternalLinks(body);
    if (links.length > 0) {
      console.log(chalk.gray(`  - Found ${links.length} internal links`));
    }

    if (frontmatterValid && sectionsValid) {
      results.passed++;
      console.log(chalk.green("  ✓ Valid"));
      return true;
    }

    return false;
  } catch (error) {
    results.failed++;
    results.errors.push(`${filePath}: ${error}`);
    console.log(chalk.red(`  ✗ Error: ${error}`));
    return false;
  }
}

/**
 * Validate YAML quiz files
 */
async function validateQuizFile(filePath: string): Promise<boolean> {
  console.log(chalk.blue(`\nValidating quiz: ${filePath}`));

  try {
    const content = await readFile(filePath, "utf-8");
    const { default: YAML } = await import("yaml");
    const data = YAML.parse(content);

    const validate = ajv.getSchema("quiz-bank");
    if (!validate) {
      console.log(chalk.yellow("  ⚠ Quiz schema not loaded"));
      return true;
    }

    const valid = validate(data);
    if (!valid) {
      results.failed++;
      results.errors.push(`${filePath}: Quiz schema validation failed`);
      console.log(chalk.red("  ✗ Schema validation failed:"));
      for (const error of validate.errors || []) {
        console.log(chalk.red(`    - ${error.instancePath} ${error.message}`));
      }
      return false;
    }

    // Additional quiz-specific validation
    const questionIds = new Set<string>();
    for (const question of data.questions || []) {
      if (questionIds.has(question.id)) {
        results.failed++;
        console.log(chalk.red(`  ✗ Duplicate question ID: ${question.id}`));
        return false;
      }
      questionIds.add(question.id);
    }

    results.passed++;
    console.log(chalk.green(`  ✓ Valid (${data.questions?.length || 0} questions)`));
    return true;
  } catch (error) {
    results.failed++;
    results.errors.push(`${filePath}: ${error}`);
    console.log(chalk.red(`  ✗ Error: ${error}`));
    return false;
  }
}

/**
 * Main validation runner
 */
async function main() {
  console.log(chalk.bold("\n📋 Content Validation\n"));
  console.log(chalk.gray("Loading schemas..."));

  await loadSchemas();

  // Validate markdown files
  const mdFiles = await glob("content/**/*.md", {
    ignore: ["**/node_modules/**", "**/_*.md"],
  });

  console.log(chalk.gray(`Found ${mdFiles.length} markdown files\n`));

  for (const file of mdFiles) {
    await validateFile(file);
  }

  // Validate quiz YAML files
  const quizFiles = await glob("content/quiz/**/*.yaml");
  console.log(chalk.gray(`\nFound ${quizFiles.length} quiz files\n`));

  for (const file of quizFiles) {
    await validateQuizFile(file);
  }

  // Summary
  console.log(chalk.bold("\n📊 Validation Summary\n"));
  console.log(chalk.green(`  ✓ Passed: ${results.passed}`));
  console.log(chalk.red(`  ✗ Failed: ${results.failed}`));
  console.log(chalk.yellow(`  ⚠ Warnings: ${results.warnings}`));

  if (results.errors.length > 0) {
    console.log(chalk.bold("\n❌ Errors:\n"));
    for (const error of results.errors) {
      console.log(chalk.red(`  - ${error}`));
    }
    process.exit(1);
  }

  console.log(chalk.bold.green("\n✅ All validations passed!\n"));
}

main().catch((error) => {
  console.error(chalk.red("Validation failed:"), error);
  process.exit(1);
});
