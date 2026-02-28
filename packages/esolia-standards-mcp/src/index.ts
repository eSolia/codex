import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandardMetadata {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  summary: string;
}

interface StandardDocument extends StandardMetadata {
  content: string;
}

interface Env {
  STANDARDS_R2: R2Bucket;
  MCP_OBJECT: DurableObjectNamespace;
  SHARED_SECRET?: string;
}

// ─── Frontmatter parsing ─────────────────────────────────────────────────────

function parseFrontmatter(raw: string): {
  metadata: Record<string, string | string[]>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: raw };
  }

  const frontmatter = match[1];
  const body = match[2].trim();
  const metadata: Record<string, string | string[]> = {};

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: string | string[] = line.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if (
      typeof value === "string" &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }

    // Handle YAML arrays like [tag1, tag2, tag3]
    if (
      typeof value === "string" &&
      value.startsWith("[") &&
      value.endsWith("]")
    ) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

// ─── R2 helpers ──────────────────────────────────────────────────────────────

const R2_PREFIX = "standards/";

async function listStandards(r2: R2Bucket): Promise<StandardMetadata[]> {
  const listed = await r2.list({ prefix: R2_PREFIX });
  const results: StandardMetadata[] = [];

  for (const obj of listed.objects) {
    // Only process .md files
    if (!obj.key.endsWith(".md")) continue;

    const content = await r2.get(obj.key);
    if (!content) continue;

    const raw = await content.text();
    const { metadata } = parseFrontmatter(raw);

    const slug =
      (metadata.slug as string) ??
      obj.key.replace(R2_PREFIX, "").replace(/\.md$/, "");

    results.push({
      slug,
      title: (metadata.title as string) ?? slug,
      category: (metadata.category as string) ?? "uncategorized",
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      summary: (metadata.summary as string) ?? "",
    });
  }

  return results;
}

async function getStandard(
  r2: R2Bucket,
  slug: string
): Promise<StandardDocument | null> {
  // InfoSec: R2 key is constructed from validated slug parameter
  // Try direct slug first, then scan by frontmatter slug
  const directKey = `${R2_PREFIX}${slug}.md`;
  let obj = await r2.get(directKey);

  // If not found by direct key, scan subdirectories
  if (!obj) {
    const listed = await r2.list({ prefix: R2_PREFIX });
    for (const item of listed.objects) {
      if (!item.key.endsWith(".md")) continue;
      const candidate = await r2.get(item.key);
      if (!candidate) continue;
      const raw = await candidate.text();
      const { metadata } = parseFrontmatter(raw);
      if (metadata.slug === slug) {
        // Re-fetch to get a fresh body (candidate already consumed)
        obj = await r2.get(item.key);
        break;
      }
    }
  }

  if (!obj) return null;

  const raw = await obj.text();
  const { metadata, body } = parseFrontmatter(raw);

  return {
    slug,
    title: (metadata.title as string) ?? slug,
    category: (metadata.category as string) ?? "uncategorized",
    tags: Array.isArray(metadata.tags) ? metadata.tags : [],
    summary: (metadata.summary as string) ?? "",
    content: body,
  };
}

async function searchStandards(
  r2: R2Bucket,
  query: string
): Promise<StandardDocument[]> {
  const listed = await r2.list({ prefix: R2_PREFIX });
  const queryLower = query.toLowerCase();
  const matches: StandardDocument[] = [];

  for (const obj of listed.objects) {
    if (!obj.key.endsWith(".md")) continue;

    const content = await r2.get(obj.key);
    if (!content) continue;

    const raw = await content.text();
    const { metadata, body } = parseFrontmatter(raw);

    const slug =
      (metadata.slug as string) ??
      obj.key.replace(R2_PREFIX, "").replace(/\.md$/, "");
    const title = (metadata.title as string) ?? slug;
    const category = (metadata.category as string) ?? "uncategorized";
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    const summary = (metadata.summary as string) ?? "";

    const matchesMeta =
      title.toLowerCase().includes(queryLower) ||
      summary.toLowerCase().includes(queryLower) ||
      tags.some((t) => t.toLowerCase().includes(queryLower)) ||
      category.toLowerCase().includes(queryLower);

    const matchesContent = body.toLowerCase().includes(queryLower);

    if (matchesMeta || matchesContent) {
      matches.push({ slug, title, category, tags, summary, content: body });
    }
  }

  return matches;
}

// ─── MCP Server (Durable Object) ────────────────────────────────────────────

export class EsoliaStandardsMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "esolia-standards",
    version: "1.0.0",
  });

  async init() {
    // ── Tool: list_standards ───────────────────────────────────────────────
    this.server.tool(
      "list_standards",
      "List all available eSolia coding and workflow standards. Returns title, category, tags, and a short summary for each standard. Use this to discover what standards are available before fetching a specific one.",
      {},
      async () => {
        const standards = await listStandards(this.env.STANDARDS_R2);

        if (standards.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No standards found in R2. Run the seed script to upload standards: npx tsx scripts/seed-standards.ts",
              },
            ],
          };
        }

        const grouped: Record<string, StandardMetadata[]> = {};
        for (const s of standards) {
          if (!grouped[s.category]) grouped[s.category] = [];
          grouped[s.category].push(s);
        }

        let output = `# eSolia Coding Standards\n\n`;
        output += `**${standards.length} standards available**\n\n`;

        for (const [category, items] of Object.entries(grouped)) {
          output += `## ${category}\n\n`;
          for (const item of items) {
            output += `- **${item.title}** (\`${item.slug}\`)\n`;
            output += `  ${item.summary}\n`;
            if (item.tags.length > 0) {
              output += `  Tags: ${item.tags.join(", ")}\n`;
            }
            output += `\n`;
          }
        }

        return {
          content: [{ type: "text" as const, text: output }],
        };
      }
    );

    // ── Tool: get_standard ────────────────────────────────────────────────
    this.server.tool(
      "get_standard",
      "Fetch the full content of a specific coding standard by its slug. Use list_standards first to find available slugs. Returns the complete markdown document.",
      {
        slug: z
          .string()
          .describe(
            "The slug identifier of the standard (e.g., 'sveltekit-guide', 'typescript-practices', 'security-checklist')"
          ),
      },
      async ({ slug }) => {
        const doc = await getStandard(this.env.STANDARDS_R2, slug);

        if (!doc) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Standard "${slug}" not found. Use list_standards to see available standards.`,
              },
            ],
          };
        }

        let output = `# ${doc.title}\n\n`;
        output += `**Category:** ${doc.category} | **Tags:** ${doc.tags.join(", ")}\n\n`;
        output += `---\n\n`;
        output += doc.content;

        return {
          content: [{ type: "text" as const, text: output }],
        };
      }
    );

    // ── Tool: search_standards ────────────────────────────────────────────
    this.server.tool(
      "search_standards",
      "Search standards by keyword across titles, summaries, tags, and full content. Returns matching standards with their full content. Use when you need to find relevant guidance for a specific coding pattern or practice.",
      {
        query: z
          .string()
          .describe(
            "Search term to match against standard titles, tags, summaries, and content"
          ),
      },
      async ({ query }) => {
        const results = await searchStandards(this.env.STANDARDS_R2, query);

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No standards found matching "${query}". Try broader search terms or use list_standards to see all available.`,
              },
            ],
          };
        }

        let output = `# Search results for "${query}"\n\n`;
        output += `**${results.length} standard(s) found**\n\n`;

        for (const doc of results) {
          output += `---\n\n`;
          output += `## ${doc.title} (\`${doc.slug}\`)\n\n`;
          output += `**Category:** ${doc.category} | **Tags:** ${doc.tags.join(", ")}\n\n`;
          output += doc.content;
          output += `\n\n`;
        }

        return {
          content: [{ type: "text" as const, text: output }],
        };
      }
    );
  }
}

// ─── Default export (Cloudflare Worker fetch handler) ────────────────────────

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // InfoSec: Bearer token auth for non-public deployments
    if (env.SHARED_SECRET) {
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      // Allow OPTIONS through for CORS preflight
      if (
        request.method !== "OPTIONS" &&
        url.pathname.startsWith("/mcp") &&
        token !== env.SHARED_SECRET
      ) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // CORS headers for cross-origin MCP clients
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Health check / info endpoint
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          name: "esolia-standards-mcp",
          version: "1.0.0",
          status: "ok",
          endpoints: {
            mcp: "/mcp",
            sse: "/sse",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // MCP handling via Durable Object
    return (
      EsoliaStandardsMCP as unknown as {
        serve: (path: string) => {
          fetch: (
            req: Request,
            env: Env,
            ctx: ExecutionContext
          ) => Promise<Response>;
        };
      }
    )
      .serve(url.pathname)
      .fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
