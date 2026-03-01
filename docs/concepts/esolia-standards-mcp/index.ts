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
  STANDARDS_KV: KVNamespace;
  SHARED_SECRET?: string;
}

// ─── Helper: fetch all standard metadata from KV ─────────────────────────────

async function listStandards(kv: KVNamespace): Promise<StandardMetadata[]> {
  const keys = await kv.list({ prefix: "standard:" });
  const results: StandardMetadata[] = [];

  for (const key of keys.keys) {
    const meta = key.metadata as StandardMetadata | undefined;
    if (meta) {
      results.push(meta);
    }
  }

  return results;
}

async function getStandard(
  kv: KVNamespace,
  slug: string
): Promise<StandardDocument | null> {
  const value = await kv.get(`standard:${slug}`, "text");
  if (!value) return null;

  const keys = await kv.list({ prefix: `standard:${slug}` });
  const meta = keys.keys[0]?.metadata as StandardMetadata | undefined;

  return {
    slug,
    title: meta?.title ?? slug,
    category: meta?.category ?? "uncategorized",
    tags: meta?.tags ?? [],
    summary: meta?.summary ?? "",
    content: value,
  };
}

async function searchStandards(
  kv: KVNamespace,
  query: string
): Promise<StandardDocument[]> {
  const all = await listStandards(kv);
  const queryLower = query.toLowerCase();
  const matches: StandardDocument[] = [];

  for (const meta of all) {
    const matchesMeta =
      meta.title.toLowerCase().includes(queryLower) ||
      meta.summary.toLowerCase().includes(queryLower) ||
      meta.tags.some((t) => t.toLowerCase().includes(queryLower)) ||
      meta.category.toLowerCase().includes(queryLower);

    if (matchesMeta) {
      const doc = await getStandard(kv, meta.slug);
      if (doc) matches.push(doc);
      continue;
    }

    // Also search content for deeper matches
    const doc = await getStandard(kv, meta.slug);
    if (doc && doc.content.toLowerCase().includes(queryLower)) {
      matches.push(doc);
    }
  }

  return matches;
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

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
        const standards = await listStandards(this.env.STANDARDS_KV);

        if (standards.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No standards found. The KV store may need to be seeded. Run the seed script to populate standards.",
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
      { slug: z.string().describe("The slug identifier of the standard (e.g., 'backpressure', 'article-editing', 'error-handling')") },
      async ({ slug }) => {
        const doc = await getStandard(this.env.STANDARDS_KV, slug);

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
      { query: z.string().describe("Search term to match against standard titles, tags, summaries, and content") },
      async ({ query }) => {
        const results = await searchStandards(this.env.STANDARDS_KV, query);

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

// ─── Default export (Cloudflare Worker) ──────────────────────────────────────

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Optional: simple shared-secret auth for non-public deployments
    if (env.SHARED_SECRET) {
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      // Allow MCP protocol paths to check auth, but let OPTIONS through for CORS
      if (
        request.method !== "OPTIONS" &&
        url.pathname.startsWith("/mcp") &&
        token !== env.SHARED_SECRET
      ) {
        return new Response("Unauthorized", { status: 401 });
      }
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
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // MCP handling is done by the McpAgent Durable Object
    return (EsoliaStandardsMCP as any).serve(url.pathname).fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
