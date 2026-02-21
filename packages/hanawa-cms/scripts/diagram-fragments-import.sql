INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, tags, version, status, created_at, updated_at)
VALUES (
  'pool-depletion-diagram',
  'Pool Depletion Over Time',
  'pool-depletion',
  'diagrams',
  'diagram',
  '<div data-type="mermaidBlock" data-source="xychart-beta
    title &quot;200-Hour Pool — Example Usage Over 12 Months&quot;
    x-axis [&quot;Apr&quot;, &quot;May&quot;, &quot;Jun&quot;, &quot;Jul&quot;, &quot;Aug&quot;, &quot;Sep&quot;, &quot;Oct&quot;, &quot;Nov&quot;, &quot;Dec&quot;, &quot;Jan&quot;, &quot;Feb&quot;, &quot;Mar&quot;]
    y-axis &quot;Hours&quot; 0 --&gt; 210
    bar [5, 12, 3, 20, 8, 15, 25, 10, 18, 22, 30, 32]
    line [195, 183, 180, 160, 152, 137, 112, 102, 84, 62, 32, 0]
" data-svg-path="diagrams/pool-depletion-diagram.svg" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="diagrams/pool-depletion-diagram.svg" alt="Mermaid diagram" />
</div>
<div class="mermaid-caption-display">Example of a 200-hour pool consumed over 12 months. Bars show monthly usage (varying from 3 to 32 hours) while the line tracks the declining balance. Usage is uneven — some months are light, others heavy — reflecting real-world demand patterns. The pool is fully consumed by year end. Monthly reporting keeps you informed of remaining hours and projected depletion.
</div>
</div>',
  '<div data-type="mermaidBlock" data-source="xychart-beta
    title &quot;200-Hour Pool — Example Usage Over 12 Months&quot;
    x-axis [&quot;Apr&quot;, &quot;May&quot;, &quot;Jun&quot;, &quot;Jul&quot;, &quot;Aug&quot;, &quot;Sep&quot;, &quot;Oct&quot;, &quot;Nov&quot;, &quot;Dec&quot;, &quot;Jan&quot;, &quot;Feb&quot;, &quot;Mar&quot;]
    y-axis &quot;Hours&quot; 0 --&gt; 210
    bar [5, 12, 3, 20, 8, 15, 25, 10, 18, 22, 30, 32]
    line [195, 183, 180, 160, 152, 137, 112, 102, 84, 62, 32, 0]
" data-svg-path="diagrams/pool-depletion-diagram.svg" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="diagrams/pool-depletion-diagram.svg" alt="Mermaid diagram" />
</div>
<div class="mermaid-caption-display">200時間プールの12ヶ月間の消費例。棒グラフは月ごとの使用量（3〜32時間）を示し、折れ線グラフは残高の推移を追跡しています。使用量は均一ではなく、軽い月もあれば多い月もあり、実際の需要パターンを反映しています。プールは年度末までに完全に消費されます。月次レポートにより、残時間と枯渇予測を常に把握できます。
</div>
</div>',
  '["pool","support","hours","diagram"]',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);