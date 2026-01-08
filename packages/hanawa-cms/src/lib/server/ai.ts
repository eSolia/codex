/**
 * AI Writing Assistant Service
 * InfoSec: Claude-powered content assistance with usage tracking
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AuditService } from './audit';

type AIAction =
  | 'continue'
  | 'expand'
  | 'improve'
  | 'simplify'
  | 'fix_grammar'
  | 'translate'
  | 'suggest_tags'
  | 'custom';

interface AIRequest {
  action: AIAction;
  documentContent?: string;
  selection?: string;
  documentId?: string;
  documentType?: string;
  customPrompt?: string;
  targetLocale?: 'en' | 'ja';
  sourceLocale?: 'en' | 'ja';
}

interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

interface TerminologyEntry {
  id: string;
  termEn: string;
  termJa: string;
  category?: string;
  notes?: string;
  verified: boolean;
}

interface UsageRecord {
  id: string;
  userEmail: string;
  documentId?: string;
  documentType?: string;
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: number;
  completedAt?: number;
  durationMs?: number;
  success: boolean;
  errorMessage?: string;
}

/**
 * Create AI Service
 * InfoSec: All AI interactions are logged for audit and billing
 */
export function createAIService(
  db: D1Database,
  ai: Ai,
  audit?: AuditService,
  anthropicApiKey?: string
) {
  // Use type assertion for model since types may not include all available models
  const MODEL = '@cf/meta/llama-3.1-70b-instruct' as Parameters<typeof ai.run>[0];

  // InfoSec: Anthropic client created lazily for high-quality translation
  function getAnthropicClient(): Anthropic | null {
    if (!anthropicApiKey) return null;
    return new Anthropic({ apiKey: anthropicApiKey });
  }

  /**
   * Build system prompt based on request type
   */
  function buildSystemPrompt(request: AIRequest): string {
    let prompt =
      'You are a professional writing assistant for business content. ' +
      "Preserve the author's voice and maintain consistent formatting. " +
      'Be concise and avoid unnecessary filler words.';

    if (request.documentType === 'compliance-control') {
      prompt +=
        ' Use precise compliance terminology appropriate for SOC 2 and ISO 27001 documentation.';
    }

    if (request.documentType === 'proposal') {
      prompt += ' Maintain professional business tone suitable for client-facing proposals.';
    }

    if (request.action === 'translate') {
      const direction =
        request.sourceLocale === 'en' ? 'English to Japanese' : 'Japanese to English';
      prompt =
        `You are a professional translator specializing in ${direction} translation. ` +
        'Maintain the original formatting (HTML tags, paragraphs) and structure. ' +
        'Use natural, fluent language appropriate for business communication. ' +
        'CRITICAL: Output ONLY the translated text. No preamble, no "Here is the translation", ' +
        'no explanation, no commentary. Just the translation itself.';
    }

    return prompt;
  }

  /**
   * Build user prompt based on action type
   */
  function buildUserPrompt(request: AIRequest): string {
    const text = request.selection || request.documentContent || '';

    switch (request.action) {
      case 'continue':
        return (
          `Continue writing from where this text ends. Write 2-3 paragraphs that naturally follow:\n\n` +
          `"${text.slice(-500)}"`
        );

      case 'expand':
        return (
          `Expand the following text with more detail and examples. ` +
          `Keep the same structure but add depth:\n\n"${text}"`
        );

      case 'improve':
        return (
          `Improve the following text for clarity and professionalism. ` +
          `Fix any issues while preserving the meaning. ` +
          `Output only the improved text, no explanation:\n\n${text}`
        );

      case 'simplify':
        return (
          `Simplify the following text to make it easier to understand. ` +
          `Use shorter sentences and simpler words:\n\n"${text}"`
        );

      case 'fix_grammar':
        return (
          `Fix only grammar, spelling, and punctuation errors in the following text. ` +
          `Do not change the meaning or style:\n\n"${text}"`
        );

      case 'translate':
        return `Translate the following to ${request.targetLocale === 'ja' ? 'Japanese' : 'English'}. Output only the translation, nothing else:\n\n${text}`;

      case 'suggest_tags':
        return (
          `Suggest 3-7 relevant tags for the following content. ` +
          `Return only a JSON array of strings, nothing else:\n\n"${text.slice(0, 2000)}"`
        );

      case 'custom':
        return `${request.customPrompt}\n\nText:\n"${text}"`;

      default:
        return request.customPrompt || text;
    }
  }

  /**
   * Record usage for billing and analytics
   */
  async function recordUsage(
    userEmail: string,
    request: AIRequest,
    response: { inputTokens: number; outputTokens: number },
    startTime: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = Date.now();

    await db
      .prepare(
        `INSERT INTO ai_usage (
        id, user_email, document_id, document_type, action, model,
        input_tokens, output_tokens, created_at, completed_at,
        duration_ms, success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        userEmail,
        request.documentId || null,
        request.documentType || null,
        request.action,
        MODEL,
        response.inputTokens,
        response.outputTokens,
        startTime,
        now,
        now - startTime,
        success ? 1 : 0,
        errorMessage || null
      )
      .run();
  }

  return {
    /**
     * Generate AI response for writing assistance
     * InfoSec: All requests logged with user context
     */
    async generate(request: AIRequest, userEmail: string): Promise<AIResponse> {
      const startTime = Date.now();

      try {
        const systemPrompt = buildSystemPrompt(request);
        const userPrompt = buildUserPrompt(request);

        const response = await ai.run(MODEL, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2048,
        });

        const content =
          typeof response === 'object' && 'response' in response
            ? (response.response as string)
            : '';

        // Estimate tokens (rough approximation)
        const inputTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
        const outputTokens = Math.ceil(content.length / 4);

        await recordUsage(userEmail, request, { inputTokens, outputTokens }, startTime, true);

        return { content, inputTokens, outputTokens };
      } catch (error) {
        await recordUsage(
          userEmail,
          request,
          { inputTokens: 0, outputTokens: 0 },
          startTime,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );

        throw error;
      }
    },

    /**
     * Translate text between EN and JA using Claude
     * InfoSec: Uses Anthropic API for high-quality translations
     */
    async translate(
      text: string,
      sourceLocale: 'en' | 'ja',
      targetLocale: 'en' | 'ja',
      userEmail: string
    ): Promise<string> {
      if (!text.trim()) return '';

      const startTime = Date.now();
      const targetLanguage = targetLocale === 'ja' ? 'Japanese' : 'English';
      const sourceLanguage = sourceLocale === 'ja' ? 'Japanese' : 'English';

      // Use Anthropic if available, fallback to Workers AI
      const anthropic = getAnthropicClient();
      if (anthropic) {
        try {
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [
              {
                role: 'user',
                content: `Translate the following ${sourceLanguage} text to ${targetLanguage}.
Return ONLY the translation, no explanations or quotes. Preserve HTML formatting.

Text to translate:
${text}`,
              },
            ],
          });

          const content = response.content[0];
          const translatedText = content.type === 'text' ? content.text.trim() : '';

          // Record usage
          await recordUsage(
            userEmail,
            { action: 'translate', selection: text, sourceLocale, targetLocale },
            {
              inputTokens: response.usage?.input_tokens || 0,
              outputTokens: response.usage?.output_tokens || 0,
            },
            startTime,
            true
          );

          return translatedText;
        } catch (error) {
          await recordUsage(
            userEmail,
            { action: 'translate', selection: text, sourceLocale, targetLocale },
            { inputTokens: 0, outputTokens: 0 },
            startTime,
            false,
            error instanceof Error ? error.message : 'Anthropic API error'
          );
          throw error;
        }
      }

      // Fallback to Workers AI if Anthropic not configured
      const response = await this.generate(
        {
          action: 'translate',
          selection: text,
          sourceLocale,
          targetLocale,
        },
        userEmail
      );

      return response.content.trim();
    },

    /**
     * Suggest tags for content
     */
    async suggestTags(content: string, userEmail: string): Promise<string[]> {
      const response = await this.generate(
        {
          action: 'suggest_tags',
          selection: content,
        },
        userEmail
      );

      try {
        return JSON.parse(response.content);
      } catch {
        // If parsing fails, try to extract tags from response
        const matches = response.content.match(/"([^"]+)"/g);
        return matches ? matches.map((m) => m.replace(/"/g, '')) : [];
      }
    },

    /**
     * Get terminology for consistent translations
     */
    async getTerminology(
      options: { category?: string; verified?: boolean } = {}
    ): Promise<TerminologyEntry[]> {
      let query = 'SELECT * FROM terminology WHERE 1=1';
      const bindings: (string | number)[] = [];

      if (options.category) {
        query += ' AND category = ?';
        bindings.push(options.category);
      }

      if (options.verified !== undefined) {
        query += ' AND verified = ?';
        bindings.push(options.verified ? 1 : 0);
      }

      query += ' ORDER BY term_en ASC';

      const { results } = await db
        .prepare(query)
        .bind(...bindings)
        .all();

      return results.map((r) => ({
        id: r.id as string,
        termEn: r.term_en as string,
        termJa: r.term_ja as string,
        category: r.category as string | undefined,
        notes: r.notes as string | undefined,
        verified: Boolean(r.verified),
      }));
    },

    /**
     * Add terminology entry
     */
    async addTerminology(
      termEn: string,
      termJa: string,
      options: { category?: string; notes?: string } = {},
      userEmail: string
    ): Promise<TerminologyEntry> {
      const id = crypto.randomUUID();
      const now = Date.now();

      await db
        .prepare(
          `INSERT INTO terminology (
          id, term_en, term_ja, category, notes, verified, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
        )
        .bind(id, termEn, termJa, options.category || null, options.notes || null, now, now)
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'create',
            actionCategory: 'content',
            resourceType: 'terminology',
            resourceId: id,
            metadata: { termEn, termJa },
          },
          { actorId: userEmail, actorEmail: userEmail }
        );
      }

      return {
        id,
        termEn,
        termJa,
        category: options.category,
        notes: options.notes,
        verified: false,
      };
    },

    /**
     * Verify terminology entry
     */
    async verifyTerminology(id: string, userEmail: string): Promise<void> {
      const now = Date.now();

      await db
        .prepare(
          `UPDATE terminology SET
          verified = 1, verified_by = ?, verified_at = ?, updated_at = ?
        WHERE id = ?`
        )
        .bind(userEmail, now, now, id)
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'update',
            actionCategory: 'content',
            resourceType: 'terminology',
            resourceId: id,
            metadata: { verified: true },
          },
          { actorId: userEmail, actorEmail: userEmail }
        );
      }
    },

    /**
     * Get usage statistics
     */
    async getUsageStats(
      options: {
        userEmail?: string;
        startDate?: number;
        endDate?: number;
      } = {}
    ): Promise<{
      totalRequests: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      byAction: Record<string, number>;
      successRate: number;
    }> {
      let query = `
        SELECT
          COUNT(*) as total_requests,
          SUM(input_tokens) as total_input,
          SUM(output_tokens) as total_output,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
          action
        FROM ai_usage
        WHERE 1=1
      `;
      const bindings: (string | number)[] = [];

      if (options.userEmail) {
        query += ' AND user_email = ?';
        bindings.push(options.userEmail);
      }

      if (options.startDate) {
        query += ' AND created_at >= ?';
        bindings.push(options.startDate);
      }

      if (options.endDate) {
        query += ' AND created_at <= ?';
        bindings.push(options.endDate);
      }

      query += ' GROUP BY action';

      const { results } = await db
        .prepare(query)
        .bind(...bindings)
        .all();

      let totalRequests = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let successCount = 0;
      const byAction: Record<string, number> = {};

      for (const row of results) {
        const count = row.total_requests as number;
        totalRequests += count;
        totalInputTokens += (row.total_input as number) || 0;
        totalOutputTokens += (row.total_output as number) || 0;
        successCount += (row.success_count as number) || 0;
        byAction[row.action as string] = count;
      }

      return {
        totalRequests,
        totalInputTokens,
        totalOutputTokens,
        byAction,
        successRate: totalRequests > 0 ? successCount / totalRequests : 1,
      };
    },
  };
}

export type AIService = ReturnType<typeof createAIService>;
