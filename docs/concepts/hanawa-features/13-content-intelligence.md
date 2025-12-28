# Hanawa: Content Intelligence Specification

Automated content analysis and quality suggestions.

## Overview

Content intelligence helps authors create better content by providing automated analysis, suggestions, and health monitoring.

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT INTELLIGENCE FEATURES                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  REAL-TIME ANALYSIS              BACKGROUND CHECKS              │
│  ──────────────────              ─────────────────              │
│  • Reading time estimate         • Broken link detection        │
│  • Word/character count          • Duplicate content            │
│  • Readability score             • Stale content alerts         │
│  • SEO suggestions               • Orphaned documents           │
│                                                                 │
│  HEALTH DASHBOARD                AI-POWERED                     │
│  ────────────────                ──────────                     │
│  • Content quality scores        • Auto-categorization          │
│  • Coverage gaps                 • Summary generation           │
│  • Update recommendations        • Related content              │
│  • Compliance checks             • Translation status           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```sql
-- Content analysis results
CREATE TABLE content_analysis (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  
  -- Metrics
  word_count INTEGER,
  character_count INTEGER,
  reading_time_minutes REAL,
  
  -- Readability
  flesch_reading_ease REAL,
  flesch_kincaid_grade REAL,
  
  -- SEO
  seo_score INTEGER,
  seo_issues TEXT,                 -- JSON array
  
  -- Links
  internal_links INTEGER,
  external_links INTEGER,
  broken_links TEXT,               -- JSON array
  
  -- Quality
  quality_score INTEGER,
  quality_issues TEXT,             -- JSON array
  
  -- Timestamps
  analyzed_at INTEGER NOT NULL,
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_analysis_document ON content_analysis(document_id);

-- Content health alerts
CREATE TABLE content_alerts (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,        -- 'broken_link', 'stale', 'orphan', 'quality'
  severity TEXT NOT NULL,          -- 'info', 'warning', 'error'
  message TEXT NOT NULL,
  details TEXT,                    -- JSON
  status TEXT DEFAULT 'open',      -- 'open', 'acknowledged', 'resolved'
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_document ON content_alerts(document_id, status);
CREATE INDEX idx_alerts_type ON content_alerts(alert_type, status);
```

## API Design

### Content Analysis Service

```typescript
// lib/server/content-intelligence.ts

export function createContentIntelligence(
  db: D1Database,
  ai: Ai,
  browserRendering?: BrowserRendering
) {
  return {
    /**
     * Analyze document content
     */
    async analyze(documentId: string): Promise<ContentAnalysis> {
      const doc = await db.prepare(`
        SELECT content, title FROM documents WHERE id = ?
      `).bind(documentId).first();
      
      if (!doc) throw new Error('Document not found');
      
      const content = doc.content as string;
      const plainText = this.stripHtml(content);
      
      // Basic metrics
      const wordCount = plainText.split(/\s+/).filter(Boolean).length;
      const characterCount = plainText.length;
      const readingTime = wordCount / 200; // ~200 WPM average
      
      // Readability
      const readability = this.calculateReadability(plainText);
      
      // SEO analysis
      const seo = await this.analyzeSEO(doc.title as string, content);
      
      // Link analysis
      const links = await this.analyzeLinks(content, documentId);
      
      // Quality score
      const quality = this.calculateQuality({
        wordCount,
        readability,
        seo,
        links,
      });
      
      const analysisId = crypto.randomUUID();
      
      // Store results
      await db.prepare(`
        INSERT INTO content_analysis (
          id, document_id, word_count, character_count, reading_time_minutes,
          flesch_reading_ease, flesch_kincaid_grade,
          seo_score, seo_issues,
          internal_links, external_links, broken_links,
          quality_score, quality_issues, analyzed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(document_id) DO UPDATE SET
          word_count = excluded.word_count,
          character_count = excluded.character_count,
          reading_time_minutes = excluded.reading_time_minutes,
          flesch_reading_ease = excluded.flesch_reading_ease,
          flesch_kincaid_grade = excluded.flesch_kincaid_grade,
          seo_score = excluded.seo_score,
          seo_issues = excluded.seo_issues,
          internal_links = excluded.internal_links,
          external_links = excluded.external_links,
          broken_links = excluded.broken_links,
          quality_score = excluded.quality_score,
          quality_issues = excluded.quality_issues,
          analyzed_at = excluded.analyzed_at
      `).bind(
        analysisId, documentId,
        wordCount, characterCount, readingTime,
        readability.fleschReadingEase, readability.fleschKincaidGrade,
        seo.score, JSON.stringify(seo.issues),
        links.internal, links.external, JSON.stringify(links.broken),
        quality.score, JSON.stringify(quality.issues),
        Date.now()
      ).run();
      
      return this.getAnalysis(documentId) as Promise<ContentAnalysis>;
    },
    
    /**
     * Calculate readability scores
     */
    calculateReadability(text: string): {
      fleschReadingEase: number;
      fleschKincaidGrade: number;
    } {
      const sentences = text.split(/[.!?]+/).filter(Boolean).length;
      const words = text.split(/\s+/).filter(Boolean).length;
      const syllables = this.countSyllables(text);
      
      if (words === 0 || sentences === 0) {
        return { fleschReadingEase: 0, fleschKincaidGrade: 0 };
      }
      
      // Flesch Reading Ease: 206.835 - 1.015(words/sentences) - 84.6(syllables/words)
      const fleschReadingEase = Math.max(0, Math.min(100,
        206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
      ));
      
      // Flesch-Kincaid Grade: 0.39(words/sentences) + 11.8(syllables/words) - 15.59
      const fleschKincaidGrade = Math.max(0,
        0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
      );
      
      return {
        fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
        fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
      };
    },
    
    /**
     * Analyze SEO
     */
    async analyzeSEO(title: string, content: string): Promise<{
      score: number;
      issues: SEOIssue[];
    }> {
      const issues: SEOIssue[] = [];
      let score = 100;
      
      // Title checks
      if (!title || title.length < 10) {
        issues.push({ type: 'title_short', message: 'Title is too short', severity: 'warning' });
        score -= 10;
      }
      if (title && title.length > 60) {
        issues.push({ type: 'title_long', message: 'Title exceeds 60 characters', severity: 'info' });
        score -= 5;
      }
      
      // Heading structure
      const h1Count = (content.match(/<h1/gi) || []).length;
      if (h1Count === 0) {
        issues.push({ type: 'missing_h1', message: 'No H1 heading found', severity: 'warning' });
        score -= 10;
      }
      if (h1Count > 1) {
        issues.push({ type: 'multiple_h1', message: 'Multiple H1 headings found', severity: 'info' });
        score -= 5;
      }
      
      // Images without alt text
      const images = content.match(/<img[^>]*>/gi) || [];
      const imagesWithoutAlt = images.filter(img => !img.includes('alt='));
      if (imagesWithoutAlt.length > 0) {
        issues.push({
          type: 'missing_alt',
          message: `${imagesWithoutAlt.length} image(s) missing alt text`,
          severity: 'warning',
        });
        score -= imagesWithoutAlt.length * 5;
      }
      
      // Meta description (would be in document metadata)
      // Internal links
      const internalLinks = (content.match(/href=["'][^"']*["']/gi) || [])
        .filter(href => !href.includes('http'));
      if (internalLinks.length < 2) {
        issues.push({
          type: 'few_internal_links',
          message: 'Consider adding more internal links',
          severity: 'info',
        });
        score -= 5;
      }
      
      return { score: Math.max(0, score), issues };
    },
    
    /**
     * Analyze links and check for broken ones
     */
    async analyzeLinks(content: string, documentId: string): Promise<{
      internal: number;
      external: number;
      broken: BrokenLink[];
    }> {
      const linkRegex = /href=["']([^"']+)["']/gi;
      const matches = [...content.matchAll(linkRegex)];
      
      let internal = 0;
      let external = 0;
      const broken: BrokenLink[] = [];
      
      for (const match of matches) {
        const url = match[1];
        
        if (url.startsWith('http')) {
          external++;
          
          // Check external link (with rate limiting)
          try {
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
              broken.push({ url, status: response.status, type: 'external' });
            }
          } catch {
            broken.push({ url, status: 0, type: 'external', error: 'Network error' });
          }
        } else if (url.startsWith('/') || url.startsWith('#')) {
          internal++;
          
          // Check internal link
          if (url.startsWith('/')) {
            // Would check if document exists
          }
        }
      }
      
      return { internal, external, broken };
    },
    
    /**
     * Calculate overall quality score
     */
    calculateQuality(metrics: {
      wordCount: number;
      readability: { fleschReadingEase: number };
      seo: { score: number; issues: SEOIssue[] };
      links: { broken: BrokenLink[] };
    }): { score: number; issues: QualityIssue[] } {
      const issues: QualityIssue[] = [];
      let score = 100;
      
      // Word count
      if (metrics.wordCount < 300) {
        issues.push({ type: 'thin_content', message: 'Content may be too short', severity: 'info' });
        score -= 10;
      }
      
      // Readability
      if (metrics.readability.fleschReadingEase < 30) {
        issues.push({ type: 'hard_to_read', message: 'Content may be difficult to read', severity: 'warning' });
        score -= 15;
      }
      
      // Broken links
      if (metrics.links.broken.length > 0) {
        issues.push({
          type: 'broken_links',
          message: `${metrics.links.broken.length} broken link(s) found`,
          severity: 'error',
        });
        score -= metrics.links.broken.length * 10;
      }
      
      // Incorporate SEO score
      score = Math.round((score + metrics.seo.score) / 2);
      
      return { score: Math.max(0, Math.min(100, score)), issues };
    },
    
    /**
     * Check for stale content
     */
    async checkStaleContent(daysThreshold = 90): Promise<StaleContentReport[]> {
      const cutoff = Date.now() - (daysThreshold * 24 * 60 * 60 * 1000);
      
      const { results } = await db.prepare(`
        SELECT id, title, collection, updated_at
        FROM documents
        WHERE status = 'published' AND updated_at < ?
        ORDER BY updated_at ASC
        LIMIT 100
      `).bind(cutoff).all();
      
      const reports: StaleContentReport[] = [];
      
      for (const doc of results) {
        const daysSinceUpdate = Math.floor((Date.now() - (doc.updated_at as number)) / (24 * 60 * 60 * 1000));
        
        reports.push({
          documentId: doc.id as string,
          title: doc.title as string,
          collection: doc.collection as string,
          daysSinceUpdate,
          recommendation: daysSinceUpdate > 180 ? 'review_urgently' : 'review_soon',
        });
        
        // Create alert if not exists
        await db.prepare(`
          INSERT INTO content_alerts (id, document_id, alert_type, severity, message, details, created_at)
          SELECT ?, ?, 'stale', ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM content_alerts
            WHERE document_id = ? AND alert_type = 'stale' AND status = 'open'
          )
        `).bind(
          crypto.randomUUID(),
          doc.id,
          daysSinceUpdate > 180 ? 'warning' : 'info',
          `Content not updated in ${daysSinceUpdate} days`,
          JSON.stringify({ daysSinceUpdate }),
          Date.now(),
          doc.id
        ).run();
      }
      
      return reports;
    },
    
    /**
     * Find orphaned content (no incoming links)
     */
    async findOrphanedContent(): Promise<{
      documentId: string;
      title: string;
      collection: string;
    }[]> {
      // This would require tracking internal links
      const { results } = await db.prepare(`
        SELECT d.id, d.title, d.collection
        FROM documents d
        WHERE d.status = 'published'
          AND NOT EXISTS (
            SELECT 1 FROM document_links l WHERE l.target_id = d.id
          )
        ORDER BY d.created_at DESC
      `).all();
      
      return results.map(r => ({
        documentId: r.id as string,
        title: r.title as string,
        collection: r.collection as string,
      }));
    },
    
    /**
     * Get content health dashboard data
     */
    async getHealthDashboard(): Promise<ContentHealthDashboard> {
      // Overall scores
      const { results: avgScores } = await db.prepare(`
        SELECT 
          AVG(quality_score) as avg_quality,
          AVG(seo_score) as avg_seo,
          AVG(flesch_reading_ease) as avg_readability
        FROM content_analysis
      `).first();
      
      // Open alerts by type
      const { results: alertCounts } = await db.prepare(`
        SELECT alert_type, severity, COUNT(*) as count
        FROM content_alerts
        WHERE status = 'open'
        GROUP BY alert_type, severity
      `).all();
      
      // Documents needing attention
      const { results: needsAttention } = await db.prepare(`
        SELECT d.id, d.title, ca.quality_score, ca.seo_score
        FROM documents d
        JOIN content_analysis ca ON d.id = ca.document_id
        WHERE ca.quality_score < 60 OR ca.seo_score < 60
        ORDER BY LEAST(ca.quality_score, ca.seo_score) ASC
        LIMIT 10
      `).all();
      
      return {
        averageScores: {
          quality: avgScores?.avg_quality as number || 0,
          seo: avgScores?.avg_seo as number || 0,
          readability: avgScores?.avg_readability as number || 0,
        },
        alerts: alertCounts.map(r => ({
          type: r.alert_type as string,
          severity: r.severity as string,
          count: r.count as number,
        })),
        needsAttention: needsAttention.map(r => ({
          id: r.id as string,
          title: r.title as string,
          qualityScore: r.quality_score as number,
          seoScore: r.seo_score as number,
        })),
      };
    },
    
    // Helpers
    
    stripHtml(html: string): string {
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    },
    
    countSyllables(text: string): number {
      const words = text.toLowerCase().split(/\s+/);
      let count = 0;
      
      for (const word of words) {
        // Simple syllable counting
        const matches = word.match(/[aeiouy]+/g);
        count += matches ? matches.length : 1;
      }
      
      return count;
    },
    
    async getAnalysis(documentId: string): Promise<ContentAnalysis | null> {
      const row = await db.prepare(`
        SELECT * FROM content_analysis WHERE document_id = ?
      `).bind(documentId).first();
      
      return row ? this.rowToAnalysis(row) : null;
    },
    
    rowToAnalysis(row: Record<string, unknown>): ContentAnalysis {
      return {
        documentId: row.document_id as string,
        wordCount: row.word_count as number,
        characterCount: row.character_count as number,
        readingTimeMinutes: row.reading_time_minutes as number,
        readability: {
          fleschReadingEase: row.flesch_reading_ease as number,
          fleschKincaidGrade: row.flesch_kincaid_grade as number,
        },
        seo: {
          score: row.seo_score as number,
          issues: JSON.parse(row.seo_issues as string || '[]'),
        },
        links: {
          internal: row.internal_links as number,
          external: row.external_links as number,
          broken: JSON.parse(row.broken_links as string || '[]'),
        },
        quality: {
          score: row.quality_score as number,
          issues: JSON.parse(row.quality_issues as string || '[]'),
        },
        analyzedAt: row.analyzed_at as number,
      };
    },
  };
}
```

---

## UI Components

### Content Stats Panel

```svelte
<!-- lib/components/intelligence/ContentStats.svelte -->
<script lang="ts">
  import { Clock, FileText, Eye, TrendingUp } from 'lucide-svelte';
  
  interface Props {
    analysis: ContentAnalysis;
  }
  
  let { analysis }: Props = $props();
  
  function getReadabilityLabel(score: number): string {
    if (score >= 70) return 'Easy';
    if (score >= 50) return 'Moderate';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  }
</script>

<div class="content-stats">
  <div class="stat">
    <FileText class="w-4 h-4" />
    <div class="stat-content">
      <span class="value">{analysis.wordCount.toLocaleString()}</span>
      <span class="label">Words</span>
    </div>
  </div>
  
  <div class="stat">
    <Clock class="w-4 h-4" />
    <div class="stat-content">
      <span class="value">{Math.ceil(analysis.readingTimeMinutes)} min</span>
      <span class="label">Read time</span>
    </div>
  </div>
  
  <div class="stat">
    <Eye class="w-4 h-4" />
    <div class="stat-content">
      <span class="value">{getReadabilityLabel(analysis.readability.fleschReadingEase)}</span>
      <span class="label">Readability</span>
    </div>
  </div>
  
  <div class="stat">
    <TrendingUp class="w-4 h-4" />
    <div class="stat-content">
      <span class="value">{analysis.seo.score}%</span>
      <span class="label">SEO Score</span>
    </div>
  </div>
</div>

<style>
  .content-stats {
    display: flex;
    gap: 1.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-muted);
    border-radius: 0.5rem;
  }
  
  .stat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .stat-content {
    display: flex;
    flex-direction: column;
  }
  
  .value {
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  .label {
    font-size: 0.625rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }
</style>
```

### SEO Suggestions

```svelte
<!-- lib/components/intelligence/SEOSuggestions.svelte -->
<script lang="ts">
  import { AlertCircle, CheckCircle, Info } from 'lucide-svelte';
  
  interface Props {
    issues: SEOIssue[];
    score: number;
  }
  
  let { issues, score }: Props = $props();
  
  function getIcon(severity: string) {
    if (severity === 'error') return AlertCircle;
    if (severity === 'warning') return AlertCircle;
    return Info;
  }
</script>

<div class="seo-panel">
  <header>
    <h3>SEO Analysis</h3>
    <div class="score" class:good={score >= 80} class:medium={score >= 50 && score < 80} class:poor={score < 50}>
      {score}%
    </div>
  </header>
  
  {#if issues.length === 0}
    <div class="all-good">
      <CheckCircle class="w-5 h-5" />
      <span>No issues found</span>
    </div>
  {:else}
    <ul class="issues-list">
      {#each issues as issue}
        <li class="issue {issue.severity}">
          <svelte:component this={getIcon(issue.severity)} class="w-4 h-4" />
          <span>{issue.message}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .seo-panel {
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--color-bg-muted);
  }
  
  h3 {
    margin: 0;
    font-size: 0.875rem;
  }
  
  .score {
    font-weight: 700;
    font-size: 1rem;
  }
  
  .score.good { color: var(--color-success); }
  .score.medium { color: var(--color-warning); }
  .score.poor { color: var(--color-danger); }
  
  .all-good {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    color: var(--color-success);
  }
  
  .issues-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .issue {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-top: 1px solid var(--color-border);
    font-size: 0.875rem;
  }
  
  .issue.error { color: var(--color-danger); }
  .issue.warning { color: var(--color-warning); }
  .issue.info { color: var(--color-text-muted); }
</style>
```

### Health Dashboard

```svelte
<!-- lib/components/intelligence/HealthDashboard.svelte -->
<script lang="ts">
  import { Activity, AlertTriangle, FileText, Link2 } from 'lucide-svelte';
  
  interface Props {
    dashboard: ContentHealthDashboard;
  }
  
  let { dashboard }: Props = $props();
</script>

<div class="health-dashboard">
  <div class="score-cards">
    <div class="score-card">
      <div class="score-value" style="--hue: {dashboard.averageScores.quality * 1.2}">
        {Math.round(dashboard.averageScores.quality)}
      </div>
      <div class="score-label">Avg Quality</div>
    </div>
    
    <div class="score-card">
      <div class="score-value" style="--hue: {dashboard.averageScores.seo * 1.2}">
        {Math.round(dashboard.averageScores.seo)}
      </div>
      <div class="score-label">Avg SEO</div>
    </div>
    
    <div class="score-card">
      <div class="score-value" style="--hue: {dashboard.averageScores.readability * 1.2}">
        {Math.round(dashboard.averageScores.readability)}
      </div>
      <div class="score-label">Avg Readability</div>
    </div>
  </div>
  
  <section class="alerts-section">
    <h3>Open Alerts</h3>
    <div class="alert-summary">
      {#each dashboard.alerts as alert}
        <div class="alert-item {alert.severity}">
          <AlertTriangle class="w-4 h-4" />
          <span class="count">{alert.count}</span>
          <span class="type">{alert.type.replace('_', ' ')}</span>
        </div>
      {/each}
    </div>
  </section>
  
  <section class="attention-section">
    <h3>Needs Attention</h3>
    <ul class="attention-list">
      {#each dashboard.needsAttention as doc}
        <li>
          <a href="/admin/documents/{doc.id}">
            <span class="title">{doc.title}</span>
            <div class="mini-scores">
              <span class="mini-score" class:poor={doc.qualityScore < 60}>
                Q: {doc.qualityScore}
              </span>
              <span class="mini-score" class:poor={doc.seoScore < 60}>
                SEO: {doc.seoScore}
              </span>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </section>
</div>
```

---

## Cron Jobs

### Scheduled Analysis

```typescript
// src/scheduled.ts

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const intelligence = createContentIntelligence(env.DB, env.AI);
    
    switch (controller.cron) {
      case '0 2 * * *': // Daily at 2 AM
        // Check for stale content
        await intelligence.checkStaleContent(90);
        break;
        
      case '0 3 * * 0': // Weekly on Sunday at 3 AM
        // Full link check
        const { results } = await env.DB.prepare(`
          SELECT id FROM documents WHERE status = 'published'
        `).all();
        
        for (const doc of results) {
          await intelligence.analyze(doc.id as string);
        }
        break;
    }
  },
};
```

### Wrangler Configuration

```toml
[triggers]
crons = [
  "0 2 * * *",   # Daily stale check
  "0 3 * * 0",   # Weekly full analysis
]
```

---

## Testing

```typescript
describe('ContentIntelligence', () => {
  it('calculates readability scores', () => {
    const text = 'The quick brown fox jumps over the lazy dog. This is a simple sentence.';
    const scores = intelligence.calculateReadability(text);
    
    expect(scores.fleschReadingEase).toBeGreaterThan(60);
    expect(scores.fleschKincaidGrade).toBeLessThan(8);
  });
  
  it('identifies SEO issues', async () => {
    const seo = await intelligence.analyzeSEO('X', '<p>Short content</p>');
    
    expect(seo.issues.some(i => i.type === 'title_short')).toBe(true);
    expect(seo.issues.some(i => i.type === 'missing_h1')).toBe(true);
  });
  
  it('detects broken links', async () => {
    const content = '<a href="https://example.com/404">Link</a>';
    const links = await intelligence.analyzeLinks(content, 'doc1');
    
    expect(links.broken.length).toBe(1);
    expect(links.broken[0].status).toBe(404);
  });
});
```

---

## Related Documents

- [09-codex-integration.md](./09-codex-integration.md) — Semantic analysis
- [08-ai-assistant.md](./08-ai-assistant.md) — AI-powered suggestions
- [11-webhooks-integrations.md](./11-webhooks-integrations.md) — Alert notifications

---

*Document version: 1.0*
