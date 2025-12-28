/**
 * R2 Deployment Script
 * 
 * Syncs content to R2 bucket for AI Search consumption.
 * Can be run standalone or as part of CI/CD pipeline.
 */

import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { glob } from "glob";
import { readFile, stat } from "fs/promises";
import { basename, relative } from "path";
import matter from "gray-matter";
import chalk from "chalk";
import { createHash } from "crypto";

// Configuration from environment
const config = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET || "security-content",
  pathPrefix: process.env.CONTENT_ENV || "",
  dryRun: process.argv.includes("--dry-run"),
};

if (!config.accountId || !config.accessKeyId || !config.secretAccessKey) {
  console.error(chalk.red("Missing required environment variables:"));
  console.error("  CLOUDFLARE_ACCOUNT_ID");
  console.error("  R2_ACCESS_KEY_ID");
  console.error("  R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

/**
 * Calculate content hash for change detection
 */
function hashContent(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

/**
 * Get R2 key from local file path
 */
function getR2Key(filePath: string): string {
  const relativePath = relative("content", filePath);
  return config.pathPrefix ? `${config.pathPrefix}/${relativePath}` : relativePath;
}

/**
 * List existing objects in R2
 */
async function listExistingObjects(): Promise<Map<string, string>> {
  const objects = new Map<string, string>();
  let continuationToken: string | undefined;

  do {
    const response = await r2.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: config.pathPrefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents || []) {
      if (obj.Key && obj.ETag) {
        objects.set(obj.Key, obj.ETag.replace(/"/g, ""));
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

/**
 * Upload a single file to R2
 */
async function uploadFile(filePath: string, content: string): Promise<void> {
  const key = getR2Key(filePath);
  const { data: frontmatter } = matter(content);

  const metadata: Record<string, string> = {};
  if (frontmatter.id) metadata["x-content-id"] = String(frontmatter.id);
  if (frontmatter.category) metadata["x-category"] = String(frontmatter.category);
  if (frontmatter.severity) metadata["x-severity"] = String(frontmatter.severity);
  if (frontmatter.last_updated) metadata["x-last-updated"] = String(frontmatter.last_updated);
  if (frontmatter.products) metadata["x-products"] = frontmatter.products.join(",");

  if (config.dryRun) {
    console.log(chalk.gray(`  [DRY RUN] Would upload: ${key}`));
    return;
  }

  await r2.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: content,
      ContentType: filePath.endsWith(".yaml") ? "application/yaml" : "text/markdown",
      Metadata: metadata,
    })
  );
}

/**
 * Delete a file from R2
 */
async function deleteFile(key: string): Promise<void> {
  if (config.dryRun) {
    console.log(chalk.gray(`  [DRY RUN] Would delete: ${key}`));
    return;
  }

  await r2.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

/**
 * Main sync function
 */
async function sync() {
  console.log(chalk.bold("\n🚀 R2 Content Sync\n"));
  console.log(chalk.gray(`Bucket: ${config.bucket}`));
  console.log(chalk.gray(`Prefix: ${config.pathPrefix || "(none)"}`));
  if (config.dryRun) {
    console.log(chalk.yellow("\n⚠️  DRY RUN MODE - No changes will be made\n"));
  }

  // Get local files
  const localFiles = await glob("content/**/*.{md,yaml}", {
    ignore: ["**/node_modules/**", "**/_*.md"],
  });

  console.log(chalk.gray(`Found ${localFiles.length} local files`));

  // Get existing R2 objects
  console.log(chalk.gray("Fetching existing R2 objects..."));
  const existingObjects = await listExistingObjects();
  console.log(chalk.gray(`Found ${existingObjects.size} existing objects`));

  // Track changes
  const stats = {
    uploaded: 0,
    unchanged: 0,
    deleted: 0,
    errors: 0,
  };

  // Track which keys we've processed
  const processedKeys = new Set<string>();

  // Process local files
  console.log(chalk.bold("\n📤 Uploading changes...\n"));

  for (const filePath of localFiles) {
    const key = getR2Key(filePath);
    processedKeys.add(key);

    try {
      const content = await readFile(filePath, "utf-8");
      const contentHash = hashContent(content);
      const existingHash = existingObjects.get(key);

      if (existingHash === contentHash) {
        stats.unchanged++;
        continue;
      }

      console.log(chalk.cyan(`  ↑ ${key}`));
      await uploadFile(filePath, content);
      stats.uploaded++;
    } catch (error) {
      console.log(chalk.red(`  ✗ ${key}: ${error}`));
      stats.errors++;
    }
  }

  // Delete orphaned files
  console.log(chalk.bold("\n🗑️  Cleaning up orphaned files...\n"));

  for (const [key] of existingObjects) {
    if (!processedKeys.has(key)) {
      console.log(chalk.yellow(`  - ${key}`));
      try {
        await deleteFile(key);
        stats.deleted++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to delete ${key}: ${error}`));
        stats.errors++;
      }
    }
  }

  // Summary
  console.log(chalk.bold("\n📊 Sync Summary\n"));
  console.log(chalk.cyan(`  ↑ Uploaded:  ${stats.uploaded}`));
  console.log(chalk.gray(`  = Unchanged: ${stats.unchanged}`));
  console.log(chalk.yellow(`  - Deleted:   ${stats.deleted}`));
  if (stats.errors > 0) {
    console.log(chalk.red(`  ✗ Errors:    ${stats.errors}`));
  }

  if (stats.errors > 0) {
    process.exit(1);
  }

  console.log(chalk.bold.green("\n✅ Sync complete!\n"));
}

sync().catch((error) => {
  console.error(chalk.red("Sync failed:"), error);
  process.exit(1);
});
