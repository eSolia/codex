/**
 * Content Configuration Types
 * 
 * Defines the shape of content.config.ts
 */

export interface R2Config {
  enabled: boolean;
  bucket: string;
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  pathPrefix?: string;
}

export interface AISearchConfig {
  enabled: boolean;
  instanceName: string;
  autoReindex?: boolean;
}

export interface DocsConfig {
  enabled: boolean;
  framework: "starlight" | "docusaurus" | "vitepress";
  pagesProject: string;
  domain?: string;
  include?: string[];
  accessPolicy?: "public" | "authenticated";
}

export interface QuizConfig {
  enabled: boolean;
  databaseName: string;
  databaseId?: string;
}

export interface DeployConfig {
  r2?: R2Config;
  aiSearch?: AISearchConfig;
  docs?: DocsConfig;
  quiz?: QuizConfig;
}

export interface TransformConfig {
  renderMermaid?: boolean;
  generateExcerpts?: boolean;
  excerptLength?: number;
  stripFrontmatter?: boolean;
}

export interface ValidationConfig {
  strictFrontmatter?: boolean;
  checkLinks?: boolean;
  requiredSections?: Record<string, string[]>;
}

export interface ContentConfig {
  consumers: string[];
  deploy: DeployConfig;
  transform?: TransformConfig;
  validation?: ValidationConfig;
}

/**
 * Helper function to define configuration with type checking
 */
export function defineConfig(config: ContentConfig): ContentConfig {
  return config;
}

/**
 * Load configuration from file or environment
 */
export async function loadConfig(): Promise<ContentConfig> {
  try {
    // Try to load from content.config.ts
    const configModule = await import("../content.config.ts");
    return configModule.default;
  } catch {
    // Return default config if no file exists
    return {
      consumers: ["periodic", "pulse", "quiz", "nexus"],
      deploy: {
        r2: {
          enabled: true,
          bucket: process.env.R2_BUCKET || "security-content",
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
        aiSearch: {
          enabled: true,
          instanceName: process.env.AI_SEARCH_INSTANCE || "security-education",
        },
      },
    };
  }
}
