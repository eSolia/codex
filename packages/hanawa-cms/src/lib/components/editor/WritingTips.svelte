<script lang="ts">
  /**
   * WritingTips — Collapsible reference panel with condensed eSolia writing guide rules.
   * Shows vocabulary red flags, structural patterns, and a quick checklist.
   * Data is hard-coded (extracted from the AI-Proof Editing guides) for speed.
   */

  let { lang = 'en' }: { lang?: 'en' | 'ja' } = $props();
</script>

<details class="bg-white rounded-lg shadow text-sm">
  <summary
    class="flex items-center justify-between px-4 py-3 cursor-pointer select-none font-semibold text-gray-900 border-b border-gray-100 hover:bg-gray-50 transition-colors"
  >
    <span class="flex items-center gap-2">
      <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      Writing Tips
    </span>
  </summary>

  <div class="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
    {#if lang === 'en'}
      <!-- English Writing Tips -->
      <section>
        <h4 class="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">
          Vocabulary Red Flags
        </h4>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-1 pr-2 font-medium text-gray-600">Avoid</th>
                <th class="text-left py-1 font-medium text-gray-600">Why</th>
              </tr>
            </thead>
            <tbody class="text-gray-700">
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">delve, leverage, navigate</td>
                <td class="py-1">AI filler verbs</td>
              </tr>
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">robust, streamline, holistic</td>
                <td class="py-1">Vague intensifiers</td>
              </tr>
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">tapestry, realm, landscape</td>
                <td class="py-1">Dramatic framing</td>
              </tr>
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">foster, facilitate, harness</td>
                <td class="py-1">Obscures who does what</td>
              </tr>
              <tr>
                <td class="py-1 pr-2 font-mono text-red-600">moreover, furthermore</td>
                <td class="py-1">Stiff connectors</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 class="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
          Phrases to Cut
        </h4>
        <ul class="space-y-1 text-xs text-gray-700">
          <li>
            <span class="text-red-600 line-through">It's worth noting that...</span> — just state it
          </li>
          <li>
            <span class="text-red-600 line-through">Let's dive in / unpack this</span> — start with content
          </li>
          <li>
            <span class="text-red-600 line-through">In today's X landscape</span> — name the actual situation
          </li>
          <li>
            <span class="text-red-600 line-through">Here's what... / Here are...</span> — delete preamble
          </li>
          <li>
            <span class="text-red-600 line-through">The key takeaway here is</span> — reader already knows
          </li>
          <li>
            <span class="text-red-600 line-through">At the end of the day</span> — cut or be specific
          </li>
        </ul>
      </section>

      <section>
        <h4 class="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
          Structural Patterns to Watch
        </h4>
        <ul class="space-y-1 text-xs text-gray-700">
          <li>
            <strong>Validation sandwich:</strong> "Great question!" → answer → "Hope this helps!" — cut
            the bread
          </li>
          <li>
            <strong>Triple hedge:</strong> "While X, also Y, though Z" — pick a lane, qualify once
          </li>
          <li><strong>Uniform paragraphs:</strong> all 3-4 sentences — vary deliberately</li>
          <li>
            <strong>Bookend compulsion:</strong> unnecessary intro + conclusion — just stop when done
          </li>
          <li><strong>List addiction:</strong> ask if prose would be clearer</li>
        </ul>
      </section>

      <section>
        <h4 class="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">
          Quick Checklist
        </h4>
        <ul class="space-y-0.5 text-xs text-gray-700">
          <li>&#x2610; Max 2 "overused" words per paragraph</li>
          <li>&#x2610; Concrete details per major point</li>
          <li>&#x2610; Contractions used naturally</li>
          <li>&#x2610; Paragraph lengths vary</li>
          <li>&#x2610; Sentence lengths vary</li>
          <li>&#x2610; No unnecessary intro/conclusion</li>
          <li>&#x2610; Read aloud — sounds like an eSolia human?</li>
        </ul>
      </section>
    {:else}
      <!-- Japanese Writing Tips -->
      <section>
        <h4 class="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">要注意ワード</h4>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left py-1 pr-2 font-medium text-gray-600">ワード</th>
                <th class="text-left py-1 font-medium text-gray-600">理由</th>
              </tr>
            </thead>
            <tbody class="text-gray-700">
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">重要、不可欠</td>
                <td class="py-1">万能強調語 — 具体化する</td>
              </tr>
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">様々な、多岐にわたる</td>
                <td class="py-1">「たくさん」の言い換え</td>
              </tr>
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">包括的、網羅的、体系的</td>
                <td class="py-1">内容が伴わなければ飾り</td>
              </tr>
              <tr class="border-b border-gray-50">
                <td class="py-1 pr-2 font-mono text-red-600">効率的、効果的、最適化</td>
                <td class="py-1">使いすぎると無味</td>
              </tr>
              <tr>
                <td class="py-1 pr-2 font-mono text-red-600">活用、連携、取り組み</td>
                <td class="py-1">公的文書のコピペ感</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h4 class="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
          削除すべきフレーズ
        </h4>
        <ul class="space-y-1 text-xs text-gray-700">
          <li>
            <span class="text-red-600 line-through">～と言えるでしょう</span> →「～です」で言い切る
          </li>
          <li>
            <span class="text-red-600 line-through">～することができます</span> →「～できます」
          </li>
          <li><span class="text-red-600 line-through">～において/における</span> →「～で/～の」</li>
          <li>
            <span class="text-red-600 line-through">～について詳しく見ていきましょう</span> → 本文に入る
          </li>
          <li><span class="text-red-600 line-through">いかがでしたか？</span> → 削除一択</li>
          <li><span class="text-red-600 line-through">重要なポイント</span> → 具体的な見出しに</li>
        </ul>
      </section>

      <section>
        <h4 class="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">構造パターン</h4>
        <ul class="space-y-1 text-xs text-gray-700">
          <li><strong>前置きの長さ:</strong> 本題に入るまで2〜3文 → 即座に本題へ</li>
          <li><strong>「まとめ」の強迫:</strong> 300字でもまとめを付ける → 最後の要点で終わる</li>
          <li><strong>均一な段落長:</strong> すべて3〜4文 → 意図的にバラつかせる</li>
          <li><strong>過剰な接続詞:</strong> また/さらに/加えて連打 → 半分以上削除</li>
          <li><strong>断言回避:</strong> ～かもしれません多用 → 自信ある主張は言い切る</li>
        </ul>
      </section>

      <section>
        <h4 class="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">
          チェックリスト
        </h4>
        <ul class="space-y-0.5 text-xs text-gray-700">
          <li>&#x2610; 要注意ワードが1段落に3つ以上ないか</li>
          <li>&#x2610; 前置きが2文以上続いていないか</li>
          <li>&#x2610; 主語が明確か</li>
          <li>&#x2610; 具体的な数字・事実があるか</li>
          <li>&#x2610; 段落の長さにバラつきがあるか</li>
          <li>&#x2610; 過剰な接続詞を削除したか</li>
          <li>&#x2610; 音読してイソリアの人間らしいか</li>
        </ul>
      </section>
    {/if}
  </div>
</details>
