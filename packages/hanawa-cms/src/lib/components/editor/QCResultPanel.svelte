<script lang="ts">
  /**
   * QCResultPanel — Display content quality check results.
   * Shows score badge, issue list with severity indicators, and timestamps.
   */

  interface QCIssue {
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
    suggestion?: string;
    location?: string;
  }

  let {
    score,
    issues = [],
    checkedAt,
  }: {
    score: number | null;
    issues: QCIssue[];
    checkedAt: string | null;
  } = $props();

  function getScoreColor(s: number): string {
    if (s >= 90) return 'bg-green-100 text-green-800 border-green-200';
    if (s >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (s >= 50) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-red-100 text-red-800 border-red-200';
  }

  function getScoreLabel(s: number): string {
    if (s >= 90) return 'Excellent';
    if (s >= 70) return 'Good';
    if (s >= 50) return 'Needs Work';
    return 'Rewrite';
  }

  function getSeverityStyle(sev: string): string {
    switch (sev) {
      case 'error':
        return 'bg-red-100 text-red-700';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-CA', {
        timeZone: 'Asia/Tokyo',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return iso;
    }
  }

  const errorCount = $derived(issues.filter((i) => i.severity === 'error').length);
  const warningCount = $derived(issues.filter((i) => i.severity === 'warning').length);
  const infoCount = $derived(issues.filter((i) => i.severity === 'info').length);
</script>

{#if score !== null}
  <div class="bg-white rounded-lg shadow text-sm">
    <!-- Header with score -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <div class="flex items-center gap-3">
        <span class="font-semibold text-gray-900">QC Results</span>
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border {getScoreColor(
            score
          )}"
        >
          {score}/100 — {getScoreLabel(score)}
        </span>
      </div>
      {#if checkedAt}
        <span class="text-xs text-gray-400">{formatDate(checkedAt)}</span>
      {/if}
    </div>

    <!-- Summary counts -->
    {#if issues.length > 0}
      <div class="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs">
        {#if errorCount > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        {/if}
        {#if warningCount > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-yellow-500"></span>
            {warningCount} warning{warningCount > 1 ? 's' : ''}
          </span>
        {/if}
        {#if infoCount > 0}
          <span class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            {infoCount} info
          </span>
        {/if}
      </div>
    {/if}

    <!-- Issue list -->
    <div class="divide-y divide-gray-50">
      {#if issues.length === 0}
        <div class="px-4 py-3 text-green-700">No issues found. Content looks good.</div>
      {:else}
        {#each issues as issue}
          <div class="px-4 py-3 space-y-1">
            <div class="flex items-start gap-2">
              <span
                class="mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase {getSeverityStyle(
                  issue.severity
                )}"
              >
                {issue.severity}
              </span>
              <div class="flex-1 min-w-0">
                <p class="text-gray-800">{issue.message}</p>
                {#if issue.suggestion}
                  <p class="text-gray-500 mt-0.5">
                    <span class="font-medium">Fix:</span>
                    {issue.suggestion}
                  </p>
                {/if}
                {#if issue.location}
                  <p
                    class="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1 font-mono truncate"
                  >
                    "{issue.location}"
                  </p>
                {/if}
              </div>
              <span class="text-[10px] text-gray-300 font-mono whitespace-nowrap">{issue.rule}</span
              >
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
{/if}
