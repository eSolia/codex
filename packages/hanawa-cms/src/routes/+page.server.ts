import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform }) => {
  // Return empty data if no platform (local dev without wrangler)
  if (!platform?.env?.DB) {
    return {
      stats: { sites: 0, content: 0, fragments: 0, assets: 0 },
      recentContent: [],
    };
  }

  const db = platform.env.DB;

  try {
    // Get counts
    const [sitesResult, contentResult, fragmentsResult, assetsResult] =
      await Promise.all([
        db.prepare("SELECT COUNT(*) as count FROM sites").first(),
        db.prepare("SELECT COUNT(*) as count FROM content").first(),
        db.prepare("SELECT COUNT(*) as count FROM fragments").first(),
        db.prepare("SELECT COUNT(*) as count FROM assets").first(),
      ]);

    // Get recent content
    const recentContentResult = await db
      .prepare(
        "SELECT id, title, slug, status, updated_at FROM content ORDER BY updated_at DESC LIMIT 5"
      )
      .all();

    return {
      stats: {
        sites: (sitesResult?.count as number) ?? 0,
        content: (contentResult?.count as number) ?? 0,
        fragments: (fragmentsResult?.count as number) ?? 0,
        assets: (assetsResult?.count as number) ?? 0,
      },
      recentContent: recentContentResult.results ?? [],
    };
  } catch (error) {
    console.error("Dashboard load error:", error);
    return {
      stats: { sites: 0, content: 0, fragments: 0, assets: 0 },
      recentContent: [],
    };
  }
};
