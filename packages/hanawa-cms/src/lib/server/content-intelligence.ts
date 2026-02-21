/**
 * Content Intelligence Service
 * Automated content analysis and quality scoring
 *
 * Provides: readability scores, SEO analysis, link checking, quality metrics
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface SEOIssue {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface QualityIssue {
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface BrokenLink {
  url: string;
  status: number;
  type: 'internal' | 'external';
  error?: string;
}

export interface ContentAnalysis {
  documentId: string;
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
  readability: {
    fleschReadingEase: number;
    fleschKincaidGrade: number;
    level: string;
  };
  seo: {
    score: number;
    issues: SEOIssue[];
  };
  links: {
    internal: number;
    external: number;
    broken: BrokenLink[];
  };
  quality: {
    score: number;
    issues: QualityIssue[];
  };
  analyzedAt: number;
}

export function createContentIntelligenceService(db: D1Database) {
  return {
    /**
     * Analyze document content
     */
    async analyze(documentId: string, title: string, content: string): Promise<ContentAnalysis> {
      const plainText = this.stripHtml(content);

      // Basic metrics
      const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      const characterCount = plainText.length;
      const readingTimeMinutes = wordCount / 200; // ~200 WPM average

      // Readability
      const readability = this.calculateReadability(plainText);

      // SEO analysis
      const seo = this.analyzeSEO(title, content, wordCount);

      // Link analysis (simplified - no external checking)
      const links = this.analyzeLinks(content);

      // Quality score
      const quality = this.calculateQuality({
        wordCount,
        readability,
        seo,
        links,
      });

      const analysisId = crypto.randomUUID();
      const now = Date.now();

      // Store or update results
      await db
        .prepare(
          `
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
        `
        )
        .bind(
          analysisId,
          documentId,
          wordCount,
          characterCount,
          readingTimeMinutes,
          readability.fleschReadingEase,
          readability.fleschKincaidGrade,
          seo.score,
          JSON.stringify(seo.issues),
          links.internal,
          links.external,
          JSON.stringify(links.broken),
          quality.score,
          JSON.stringify(quality.issues),
          now
        )
        .run();

      return {
        documentId,
        wordCount,
        characterCount,
        readingTimeMinutes,
        readability,
        seo,
        links,
        quality,
        analyzedAt: now,
      };
    },

    /**
     * Get stored analysis for a document
     */
    async get(documentId: string): Promise<ContentAnalysis | null> {
      const row = await db
        .prepare('SELECT * FROM content_analysis WHERE document_id = ?')
        .bind(documentId)
        .first();

      if (!row) return null;
      return this.rowToAnalysis(row);
    },

    /**
     * Calculate readability scores
     */
    calculateReadability(text: string): {
      fleschReadingEase: number;
      fleschKincaidGrade: number;
      level: string;
    } {
      const sentences = text.split(/[.!?]+/).filter(Boolean).length || 1;
      const words = text.split(/\s+/).filter(Boolean).length || 1;
      const syllables = this.countSyllables(text);

      // Flesch Reading Ease: 206.835 - 1.015(words/sentences) - 84.6(syllables/words)
      const fleschReadingEase = Math.max(
        0,
        Math.min(100, 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words))
      );

      // Flesch-Kincaid Grade: 0.39(words/sentences) + 11.8(syllables/words) - 15.59
      const fleschKincaidGrade = Math.max(
        0,
        0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
      );

      // Determine reading level
      let level: string;
      if (fleschReadingEase >= 80) level = 'Easy';
      else if (fleschReadingEase >= 60) level = 'Moderate';
      else if (fleschReadingEase >= 40) level = 'Difficult';
      else level = 'Very Difficult';

      return {
        fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
        fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
        level,
      };
    },

    /**
     * Analyze SEO factors
     */
    analyzeSEO(
      title: string,
      content: string,
      wordCount: number
    ): {
      score: number;
      issues: SEOIssue[];
    } {
      const issues: SEOIssue[] = [];
      let score = 100;

      // Title checks
      if (!title || title.length < 10) {
        issues.push({
          type: 'title_short',
          message: 'Title is too short (aim for 10-60 characters)',
          severity: 'warning',
        });
        score -= 15;
      } else if (title.length > 60) {
        issues.push({
          type: 'title_long',
          message: 'Title exceeds 60 characters (may be truncated in search)',
          severity: 'info',
        });
        score -= 5;
      }

      // Heading structure
      const h1Count = (content.match(/<h1/gi) || []).length;
      const h2Count = (content.match(/<h2/gi) || []).length;

      if (h1Count === 0) {
        issues.push({
          type: 'missing_h1',
          message: 'No H1 heading found',
          severity: 'warning',
        });
        score -= 10;
      }
      if (h1Count > 1) {
        issues.push({
          type: 'multiple_h1',
          message: 'Multiple H1 headings found (use only one)',
          severity: 'info',
        });
        score -= 5;
      }
      if (h2Count === 0 && wordCount > 300) {
        issues.push({
          type: 'missing_h2',
          message: 'No subheadings (H2) - consider breaking up content',
          severity: 'info',
        });
        score -= 5;
      }

      // Content length
      if (wordCount < 300) {
        issues.push({
          type: 'thin_content',
          message: 'Content may be too short for good SEO (aim for 300+ words)',
          severity: 'info',
        });
        score -= 10;
      }

      // Images without alt text
      const images = content.match(/<img[^>]*>/gi) || [];
      const imagesWithoutAlt = images.filter((img) => !img.includes('alt='));
      if (imagesWithoutAlt.length > 0) {
        issues.push({
          type: 'missing_alt',
          message: `${imagesWithoutAlt.length} image(s) missing alt text`,
          severity: 'warning',
        });
        score -= Math.min(20, imagesWithoutAlt.length * 5);
      }

      // Internal links
      const internalLinks = (content.match(/href=["'][^"'h][^"']*["']/gi) || []).length;
      if (internalLinks < 1 && wordCount > 300) {
        issues.push({
          type: 'no_internal_links',
          message: 'Consider adding internal links to related content',
          severity: 'info',
        });
        score -= 5;
      }

      return { score: Math.max(0, score), issues };
    },

    /**
     * Analyze links in content (without external checking)
     */
    analyzeLinks(content: string): {
      internal: number;
      external: number;
      broken: BrokenLink[];
    } {
      const linkRegex = /href=["']([^"']+)["']/gi;
      const matches = [...content.matchAll(linkRegex)];

      let internal = 0;
      let external = 0;

      for (const match of matches) {
        const url = match[1];
        if (!url) continue;

        if (url.startsWith('http://') || url.startsWith('https://')) {
          external++;
        } else if (url.startsWith('/') || url.startsWith('#') || !url.includes(':')) {
          internal++;
        }
      }

      // Note: Broken link checking would require external HTTP calls
      // which should be done as a background job, not real-time
      return { internal, external, broken: [] };
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
      if (metrics.wordCount < 100) {
        issues.push({
          type: 'very_thin',
          message: 'Content is very short',
          severity: 'warning',
        });
        score -= 20;
      } else if (metrics.wordCount < 300) {
        issues.push({
          type: 'thin_content',
          message: 'Content may be too brief',
          severity: 'info',
        });
        score -= 10;
      }

      // Readability
      if (metrics.readability.fleschReadingEase < 30) {
        issues.push({
          type: 'hard_to_read',
          message: 'Content may be difficult to read',
          severity: 'warning',
        });
        score -= 15;
      } else if (metrics.readability.fleschReadingEase < 50) {
        issues.push({
          type: 'moderately_difficult',
          message: 'Consider simplifying some sentences',
          severity: 'info',
        });
        score -= 5;
      }

      // Broken links (if any were detected)
      if (metrics.links.broken.length > 0) {
        issues.push({
          type: 'broken_links',
          message: `${metrics.links.broken.length} broken link(s) found`,
          severity: 'error',
        });
        score -= metrics.links.broken.length * 10;
      }

      // Blend with SEO score
      score = Math.round(score * 0.6 + metrics.seo.score * 0.4);

      return {
        score: Math.max(0, Math.min(100, score)),
        issues,
      };
    },

    /**
     * Perform quick analysis (metrics only, no storage)
     */
    quickAnalyze(content: string): {
      wordCount: number;
      characterCount: number;
      readingTimeMinutes: number;
      readability: { level: string; score: number };
    } {
      const plainText = this.stripHtml(content);
      const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
      const characterCount = plainText.length;
      const readingTimeMinutes = wordCount / 200;
      const readability = this.calculateReadability(plainText);

      return {
        wordCount,
        characterCount,
        readingTimeMinutes,
        readability: {
          level: readability.level,
          score: readability.fleschReadingEase,
        },
      };
    },

    // Helper functions

    stripHtml(html: string): string {
      return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    countSyllables(text: string): number {
      const words = text.toLowerCase().split(/\s+/);
      let count = 0;

      for (const word of words) {
        // Simple syllable counting based on vowel groups
        const matches = word.match(/[aeiouy]+/g);
        count += matches ? matches.length : 1;
        // Subtract for silent e at end
        if (word.endsWith('e') && word.length > 2) count--;
        // Ensure at least 1 syllable per word
        if (count < 1) count = 1;
      }

      return count;
    },

    rowToAnalysis(row: Record<string, unknown>): ContentAnalysis {
      const fleschReadingEase = row.flesch_reading_ease as number;
      let level: string;
      if (fleschReadingEase >= 80) level = 'Easy';
      else if (fleschReadingEase >= 60) level = 'Moderate';
      else if (fleschReadingEase >= 40) level = 'Difficult';
      else level = 'Very Difficult';

      return {
        documentId: row.document_id as string,
        wordCount: row.word_count as number,
        characterCount: row.character_count as number,
        readingTimeMinutes: row.reading_time_minutes as number,
        readability: {
          fleschReadingEase: row.flesch_reading_ease as number,
          fleschKincaidGrade: row.flesch_kincaid_grade as number,
          level,
        },
        seo: {
          score: row.seo_score as number,
          issues: JSON.parse((row.seo_issues as string) || '[]'),
        },
        links: {
          internal: row.internal_links as number,
          external: row.external_links as number,
          broken: JSON.parse((row.broken_links as string) || '[]'),
        },
        quality: {
          score: row.quality_score as number,
          issues: JSON.parse((row.quality_issues as string) || '[]'),
        },
        analyzedAt: row.analyzed_at as number,
      };
    },
  };
}

export type ContentIntelligenceService = ReturnType<typeof createContentIntelligenceService>;
