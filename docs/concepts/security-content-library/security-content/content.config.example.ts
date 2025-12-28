import { defineConfig, type DeployTarget } from "./scripts/config";

/**
 * Content Library Configuration
 * 
 * This file defines WHERE content gets deployed. The content package itself
 * is agnostic—it just produces outputs. Each consuming application configures
 * its own deployment targets.
 * 
 * Copy this file to `content.config.ts` and fill in your values.
 * The actual config file is gitignored to prevent credential leakage.
 */

export default defineConfig({
  /**
   * Which products consume this content?
   * Used to filter/transform content appropriately.
   */
  consumers: ["periodic", "pulse", "quiz", "nexus"],

  /**
   * Deployment targets - where does built content go?
   * Configure per-environment (dev, staging, prod).
   */
  deploy: {
    /**
     * R2 bucket for AI Search
     * Content is synced here for RAG retrieval
     */
    r2: {
      enabled: true,
      bucket: "security-content",
      // Credentials from environment variables
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      // Optional: prefix content by environment
      pathPrefix: process.env.CONTENT_ENV || "production",
    },

    /**
     * AI Search instance configuration
     * Triggers reindex after R2 sync
     */
    aiSearch: {
      enabled: true,
      instanceName: "security-education",
      // Reindex automatically after deploy?
      autoReindex: true,
    },

    /**
     * Static documentation site
     * Built with Astro/Starlight, deployed to Pages
     */
    docs: {
      enabled: true,
      framework: "starlight", // or "docusaurus", "vitepress"
      pagesProject: "security-docs",
      // Custom domain (optional)
      domain: "docs.yourdomain.com",
      // Which content sections to include?
      include: ["periodic", "pulse", "shared"],
      // Require authentication?
      accessPolicy: "public", // or "authenticated"
    },

    /**
     * Quiz database
     * Transforms YAML question banks to D1
     */
    quiz: {
      enabled: true,
      databaseName: "quiz-app",
      databaseId: process.env.D1_DATABASE_ID,
    },
  },

  /**
   * Content transformation options
   */
  transform: {
    /**
     * Mermaid diagrams: render to SVG during build?
     * If false, clients render at runtime
     */
    renderMermaid: true,

    /**
     * Generate summary/excerpt from content?
     * Useful for cards, tooltips, search results
     */
    generateExcerpts: true,
    excerptLength: 200,

    /**
     * Strip frontmatter from output?
     * Useful if consumers don't need metadata
     */
    stripFrontmatter: false,
  },

  /**
   * Validation rules
   */
  validation: {
    /**
     * Require all frontmatter fields defined in schema?
     */
    strictFrontmatter: true,

    /**
     * Check that all internal links resolve?
     */
    checkLinks: true,

    /**
     * Require specific sections in documents?
     */
    requiredSections: {
      issue: ["Summary", "Why This Matters", "How to Fix This"],
      control: ["Control Summary", "Why This Matters", "Implementation Steps"],
      concept: ["Summary", "How It Works"],
    },
  },
});
