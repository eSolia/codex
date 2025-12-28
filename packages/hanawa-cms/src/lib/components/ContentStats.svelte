<!--
  ContentStats Component
  Displays content metrics and quality indicators

  Usage:
  <ContentStats {wordCount} {characterCount} {readingTime} {readability} {seo} />
-->
<script lang="ts">
  interface Props {
    wordCount: number;
    characterCount: number;
    readingTime: number;
    readability?: {
      level: string;
      score: number;
    };
    seo?: {
      score: number;
      issues: Array<{ type: string; message: string; severity: string }>;
    };
    compact?: boolean;
  }

  let {
    wordCount,
    characterCount,
    readingTime,
    readability,
    seo,
    compact = false,
  }: Props = $props();

  function getReadabilityColor(score: number): string {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    if (score >= 30) return 'text-orange-600';
    return 'text-red-600';
  }

  function getSEOColor(score: number): string {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  }

  function getScoreBadgeClass(score: number): string {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-medium';
    return 'score-poor';
  }
</script>

{#if compact}
  <!-- Compact view for editor footer -->
  <div class="stats-compact">
    <span class="stat" title="Word count">{wordCount.toLocaleString()} words</span>
    <span class="separator">|</span>
    <span class="stat" title="Character count">{characterCount.toLocaleString()} chars</span>
    <span class="separator">|</span>
    <span class="stat" title="Estimated reading time">~{Math.ceil(readingTime)} min</span>
    {#if readability}
      <span class="separator">|</span>
      <span
        class="stat {getReadabilityColor(readability.score)}"
        title="Readability: {readability.score}"
      >
        {readability.level}
      </span>
    {/if}
    {#if seo}
      <span class="separator">|</span>
      <span class="stat-badge {getScoreBadgeClass(seo.score)}" title="SEO Score">
        SEO {seo.score}%
      </span>
    {/if}
  </div>
{:else}
  <!-- Full panel view -->
  <div class="stats-panel">
    <h3 class="panel-title">Content Stats</h3>

    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">{wordCount.toLocaleString()}</div>
        <div class="stat-label">Words</div>
      </div>

      <div class="stat-item">
        <div class="stat-value">{characterCount.toLocaleString()}</div>
        <div class="stat-label">Characters</div>
      </div>

      <div class="stat-item">
        <div class="stat-value">{Math.ceil(readingTime)}</div>
        <div class="stat-label">Min Read</div>
      </div>

      {#if readability}
        <div class="stat-item">
          <div class="stat-value {getReadabilityColor(readability.score)}">
            {readability.level}
          </div>
          <div class="stat-label">Readability ({readability.score})</div>
        </div>
      {/if}
    </div>

    {#if seo}
      <div class="seo-section">
        <div class="seo-header">
          <span>SEO Score</span>
          <span class="seo-score {getSEOColor(seo.score)}">{seo.score}%</span>
        </div>

        {#if seo.issues.length > 0}
          <ul class="seo-issues">
            {#each seo.issues as issue}
              <li class="issue issue-{issue.severity}">
                <span class="issue-icon">
                  {#if issue.severity === 'error'}
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {:else if issue.severity === 'warning'}
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {:else}
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  {/if}
                </span>
                <span>{issue.message}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <div class="seo-perfect">
            <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd"
              />
            </svg>
            <span>No issues found</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Compact view styles */
  .stats-compact {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .stat {
    white-space: nowrap;
  }

  .separator {
    color: #d1d5db;
  }

  .stat-badge {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .score-good {
    background: #d1fae5;
    color: #065f46;
  }

  .score-medium {
    background: #fef3c7;
    color: #92400e;
  }

  .score-poor {
    background: #fee2e2;
    color: #991b1b;
  }

  /* Panel view styles */
  .stats-panel {
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
    overflow: hidden;
  }

  .panel-title {
    margin: 0;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }

  .stat-item {
    text-align: center;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
  }

  .stat-label {
    font-size: 0.625rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
  }

  .seo-section {
    border-top: 1px solid #e5e7eb;
    padding: 0.75rem 1rem;
  }

  .seo-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .seo-score {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: 700;
  }

  .seo-issues {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .issue {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.375rem 0;
    font-size: 0.8125rem;
  }

  .issue-icon {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .issue-error {
    color: #dc2626;
  }

  .issue-warning {
    color: #d97706;
  }

  .issue-info {
    color: #6b7280;
  }

  .seo-perfect {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #059669;
    font-size: 0.875rem;
  }
</style>
