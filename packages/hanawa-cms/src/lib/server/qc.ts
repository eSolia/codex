/**
 * Content Quality Check Service
 *
 * Reviews fragment/document content against eSolia's writing guide using
 * Workers AI (Llama 3.1 70B). Returns actionable feedback with scores.
 *
 * InfoSec: AI interactions logged for audit and billing (OWASP A09)
 */

export interface QCIssue {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
  suggestion?: string;
  location?: string;
}

export interface QCResult {
  score: number;
  issues: QCIssue[];
  checkedAt: string;
}

const QC_SYSTEM_PROMPT_EN = `You are a writing quality reviewer for eSolia, a Tokyo-based IT consulting firm. Review content against these rules and return JSON.

## Vocabulary Red Flags (rule: "ai-vocabulary")
Flag overuse of: delve, navigate (metaphorical), leverage, robust, streamline, holistic, pivotal, tapestry, realm, landscape (metaphorical), nuanced, multifaceted, foster, facilitate, harness, keen, moreover, furthermore.
Also flag phrases: "It's worth noting", "Let's dive in", "In today's X landscape", "Here's what/Here are", "The key takeaway", "At the end of the day".
Severity: "warning" if 1-2 per paragraph, "error" if 3+.

## Structural Patterns (rule: "structural-pattern")
- Validation sandwich: compliment → answer → "Hope this helps!" (severity: warning)
- Triple hedge: qualifying from every direction simultaneously (severity: warning)
- Uniform paragraph lengths: all paragraphs roughly same size (severity: info)
- Bookend compulsion: unnecessary intro + conclusion (severity: warning)
- List addiction: bullet points where prose would be clearer (severity: info)

## Tonal Issues (rule: "tonal-issue")
- Over-politeness: excessive "I'd be happy to", "Thank you for sharing!" (severity: warning)
- Signposting overkill: "Let me explain", "Here's the thing" (severity: warning)
- Emotional uncanny valley: "I'm really passionate about" without specifics (severity: info)

## Missing Quality (rule: "quality-gap")
- No concrete details or specific examples (severity: warning)
- No contractions in informal content (severity: info)
- Metronomic sentence rhythm — no variation in length (severity: info)

Respond with ONLY a valid JSON object (no markdown fences, no explanation):
{"score": <0-100>, "issues": [{"severity": "error|warning|info", "rule": "<rule-name>", "message": "<description>", "suggestion": "<fix>", "location": "<excerpt>"}]}

Score guide: 90-100 = excellent, 70-89 = good with minor issues, 50-69 = needs revision, below 50 = significant rewrite needed.
If content is clean, return {"score": 95, "issues": []}.`;

const QC_SYSTEM_PROMPT_JA = `You are a writing quality reviewer for eSolia. Review Japanese content against these rules and return JSON.

## 語彙の危険信号 (rule: "ai-vocabulary")
多用を検出: 重要、不可欠、様々な、多岐にわたる、包括的、網羅的、体系的、効率的、効果的、最適化、促進する、推進する、醸成する、活用、連携、取り組み。
フレーズ: 「～と言えるでしょう」「～することができます」「～において」「いかがでしたか？」「重要なポイント」。
Severity: 1段落に1-2個なら"warning"、3個以上なら"error"。

## 構造パターン (rule: "structural-pattern")
- 前置きが長い: 本題まで2〜3文の導入 (severity: warning)
- 「まとめ」の強迫: 短い文書にも不要なまとめ (severity: warning)
- 均一な段落長: すべて同じ長さ (severity: info)
- 過剰な接続詞: また/さらに/加えて連打 (severity: warning)
- 対称構造への執着: 「AだけでなくBも」の連発 (severity: info)

## トーンの問題 (rule: "tonal-issue")
- 敬語の過剰: 文書全体が最上級敬語 (severity: warning)
- 主語の消失: 誰が何をするか不明 (severity: warning)
- 断言回避: 「～かもしれません」多用 (severity: info)

## 品質の不足 (rule: "quality-gap")
- 具体的な数字・事例がない (severity: warning)
- 文末表現が単調 (severity: info)

Respond with ONLY a valid JSON object (no markdown fences, no explanation):
{"score": <0-100>, "issues": [{"severity": "error|warning|info", "rule": "<rule-name>", "message": "<description>", "suggestion": "<fix>", "location": "<excerpt>"}]}

Score: 90-100=優秀, 70-89=軽微な問題, 50-69=要修正, 50未満=大幅書き直し。
問題なければ {"score": 95, "issues": []} を返す。`;

/**
 * Run a quality check on content using Workers AI.
 *
 * InfoSec: All AI interactions logged with user context for audit
 */
export async function runQCCheck(
  ai: Ai,
  db: D1Database,
  content: string,
  language: 'en' | 'ja',
  userEmail: string,
  fragmentId?: string
): Promise<QCResult> {
  const MODEL = '@cf/meta/llama-3.1-70b-instruct' as Parameters<typeof ai.run>[0];
  const startTime = Date.now();
  const systemPrompt = language === 'ja' ? QC_SYSTEM_PROMPT_JA : QC_SYSTEM_PROMPT_EN;

  // Truncate very long content to stay within model limits
  const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n\n[truncated]' : content;

  try {
    const response = await ai.run(MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Review this content:\n\n${truncated}` },
      ],
      max_tokens: 2048,
    });

    const rawOutput =
      typeof response === 'object' && 'response' in response ? (response.response as string) : '';

    // Parse the JSON response
    const result = parseQCResponse(rawOutput);

    // Record usage
    const inputTokens = Math.ceil((systemPrompt.length + truncated.length) / 4);
    const outputTokens = Math.ceil(rawOutput.length / 4);
    await recordQCUsage(db, userEmail, fragmentId, inputTokens, outputTokens, startTime, true);

    return result;
  } catch (error) {
    await recordQCUsage(
      db,
      userEmail,
      fragmentId,
      0,
      0,
      startTime,
      false,
      error instanceof Error ? error.message : 'QC check failed'
    );

    // Return a fallback result rather than throwing
    return {
      score: 0,
      issues: [
        {
          severity: 'error',
          rule: 'system',
          message: 'QC check failed — please try again.',
          suggestion: error instanceof Error ? error.message : undefined,
        },
      ],
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Parse the AI response into a structured QCResult.
 * Handles malformed JSON gracefully.
 */
function parseQCResponse(raw: string): QCResult {
  const checkedAt = new Date().toISOString();

  // Try to extract JSON from the response (model may wrap in markdown fences)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      score: 50,
      issues: [
        {
          severity: 'warning',
          rule: 'system',
          message: 'Could not parse QC response. Content may need manual review.',
        },
      ],
      checkedAt,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { score?: number; issues?: unknown[] };
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 50;

    const issues: QCIssue[] = [];
    if (Array.isArray(parsed.issues)) {
      for (const item of parsed.issues) {
        if (typeof item === 'object' && item !== null) {
          const i = item as Record<string, unknown>;
          issues.push({
            severity: (['error', 'warning', 'info'].includes(i.severity as string)
              ? i.severity
              : 'info') as QCIssue['severity'],
            rule: typeof i.rule === 'string' ? i.rule : 'unknown',
            message: typeof i.message === 'string' ? i.message : 'No details',
            suggestion: typeof i.suggestion === 'string' ? i.suggestion : undefined,
            location: typeof i.location === 'string' ? i.location : undefined,
          });
        }
      }
    }

    return { score, issues, checkedAt };
  } catch {
    return {
      score: 50,
      issues: [
        {
          severity: 'warning',
          rule: 'system',
          message: 'QC response was malformed. Content may need manual review.',
        },
      ],
      checkedAt,
    };
  }
}

/**
 * Store QC results in the fragment_index table.
 */
export async function storeQCResults(
  db: D1Database,
  fragmentId: string,
  result: QCResult
): Promise<void> {
  await db
    .prepare(
      `UPDATE fragment_index
       SET last_qc_at = ?, qc_score = ?, qc_issues = ?
       WHERE id = ?`
    )
    .bind(result.checkedAt, result.score, JSON.stringify(result.issues), fragmentId)
    .run();
}

/**
 * Record QC usage in the ai_usage table (same table as other AI features).
 * InfoSec: Usage tracking for billing and audit (OWASP A09)
 */
async function recordQCUsage(
  db: D1Database,
  userEmail: string,
  fragmentId: string | undefined,
  inputTokens: number,
  outputTokens: number,
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
      fragmentId || null,
      'fragment',
      'qc_check',
      '@cf/meta/llama-3.1-70b-instruct',
      inputTokens,
      outputTokens,
      startTime,
      now,
      now - startTime,
      success ? 1 : 0,
      errorMessage || null
    )
    .run();
}
