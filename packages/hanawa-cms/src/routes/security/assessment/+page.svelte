<script lang="ts">
  import {
    ShieldCheck,
    CheckCircle,
    XCircle,
    Warning,
    Info,
    Code,
    CaretDown,
    CaretUp,
    FileCode,
    Lightbulb,
    Calendar,
    Tag,
    ListChecks,
    ArrowLeft,
    Circle,
    Question,
    ChartBar,
    Shield,
    Prohibit,
    WarningCircle,
    Lock,
    SignIn,
  } from 'phosphor-svelte';

  let { data } = $props();
  let isAuthenticated = $derived(data.authenticated);

  interface Location {
    file: string;
    line: number;
    snippet?: string;
  }

  interface Scope {
    standard: string;
    standardUrl: string;
    scope: string;
    scopeDescription: string;
    limitations: string[];
    recommendations: string[];
    level: string;
    levelDescription: string;
    totalAsvsControls: {
      L1: number;
      L2: number;
      L3: number;
    };
  }

  interface CheckResult {
    id: string;
    category: string;
    name: string;
    status: 'pass' | 'fail' | 'warning' | 'info' | 'not-applicable';
    description: string;
    locations?: Location[];
    remediation?: string;
    asvsRef: string;
    automatable?: boolean;
    level?: 'L1' | 'L2' | 'L3';
    top10?: string[];
  }

  interface Report {
    timestamp: string;
    version: string;
    scope?: Scope;
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
      notApplicable?: number;
      coverage?: {
        L1: { checked: number; total: number; percentage: number };
        L2?: { checked: number; total: number; percentage: number };
      };
    };
    checks: CheckResult[];
  }

  // Report data comes from server load function (null for unauthenticated)
  const report = data.report as Report | null;
  const summary = data.summary;
  const score = summary.score;
  const applicableChecks = summary.total - (summary.notApplicable || 0);
  const lastUpdated = new Date(summary.timestamp);

  let expandedChecks = $state(new Set<string>());
  let scopeExpanded = $state(false);

  function toggleCheck(id: string) {
    if (expandedChecks.has(id)) {
      expandedChecks.delete(id);
      expandedChecks = new Set(expandedChecks);
    } else {
      expandedChecks.add(id);
      expandedChecks = new Set(expandedChecks);
    }
  }

  // Group checks by category (only when authenticated)
  const checksByCategory = report
    ? report.checks.reduce(
        (acc, check) => {
          if (!acc[check.category]) {
            acc[check.category] = [];
          }
          acc[check.category].push(check);
          return acc;
        },
        {} as Record<string, CheckResult[]>
      )
    : {};

  const categoryOrder = [
    'V1 Architecture',
    'V2 Authentication',
    'V3 Session Management',
    'V4 Access Control',
    'V5 Validation',
    'V6 Cryptography',
    'V7 Error Handling',
    'V8 Data Protection',
    'V9 Communication',
    'V10 Malicious Code',
    'V12 Files',
    'V13 API',
    'V14 Configuration',
  ];

  const formattedDate = lastUpdated.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
</script>

<svelte:head>
  <title>ASVS Security Assessment - Hanawa CMS</title>
  <meta name="description" content="Automated security verification against OWASP ASVS 5.0" />
</svelte:head>

<div class="min-h-screen bg-zinc-50 dark:bg-zinc-900">
  <!-- Hero Section -->
  <div class="bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700">
    <div class="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <a
        href="/security"
        class="mb-6 inline-flex items-center gap-2 text-white/80 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to Security
      </a>
      <div class="text-center">
        <div class="mb-4 flex justify-center">
          <div class="rounded-full bg-white/10 p-3 backdrop-blur-sm">
            <ShieldCheck size={48} class="text-white" />
          </div>
        </div>
        <h1 class="mb-3 text-3xl font-bold text-white md:text-4xl">ASVS Security Assessment</h1>
        <p class="text-lg text-rose-100">
          Automated security verification against
          <a
            href="https://owasp.org/www-project-application-security-verification-standard/"
            class="underline transition-colors hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            OWASP ASVS 5.0
          </a>
        </p>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-6xl px-4 py-8">
    <!-- Scope Notice -->
    <div
      class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 rounded-lg bg-amber-100 p-1.5 dark:bg-amber-800">
          <WarningCircle size={20} class="text-amber-600 dark:text-amber-400" weight="fill" />
        </div>
        <div class="flex-1">
          <h3 class="mb-1 font-semibold text-amber-800 dark:text-amber-200">
            Automatable Subset Only
          </h3>
          <p class="text-sm text-amber-700 dark:text-amber-300">
            This assessment checks controls that can be reliably verified through static code
            analysis.
          </p>

          <button
            onclick={() => (scopeExpanded = !scopeExpanded)}
            class="mt-2 flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
          >
            {scopeExpanded ? 'Hide scope details' : 'Show scope details'}
            {#if scopeExpanded}
              <CaretUp size={14} />
            {:else}
              <CaretDown size={14} />
            {/if}
          </button>

          {#if scopeExpanded && report?.scope}
            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h4 class="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  What This Assessment Cannot Detect
                </h4>
                <ul class="space-y-1">
                  {#each report.scope.limitations as limitation}
                    <li class="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                      <span class="mt-1 text-amber-500">•</span>
                      {limitation}
                    </li>
                  {/each}
                </ul>
              </div>
              <div>
                <h4 class="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                  Recommendations for Full Compliance
                </h4>
                <ul class="space-y-1">
                  {#each report.scope.recommendations as recommendation}
                    <li class="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                      <span class="mt-1 text-amber-500">✓</span>
                      {recommendation}
                    </li>
                  {/each}
                </ul>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Understanding This Report -->
    <div class="mb-6 rounded-xl bg-white p-6 shadow-lg dark:bg-zinc-800">
      <div class="mb-4 flex items-center gap-2">
        <Shield size={20} class="text-rose-500" />
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-white">
          Understanding This Report
        </h2>
      </div>

      <p class="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        OWASP ASVS defines three verification levels with increasing security requirements:
      </p>

      <div class="mb-5 grid gap-3 md:grid-cols-3">
        <div
          class="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
        >
          <div class="mb-1 flex items-center gap-2">
            <span class="level-badge level-L1">L1</span>
            <span class="text-sm font-medium text-green-700 dark:text-green-300"
              >Level 1 (Baseline)</span
            >
          </div>
          <p class="text-xs text-green-600 dark:text-green-400">
            50 controls - Basic security for all applications
          </p>
        </div>
        <div
          class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
        >
          <div class="mb-1 flex items-center gap-2">
            <span class="level-badge level-L2">L2</span>
            <span class="text-sm font-medium text-blue-700 dark:text-blue-300"
              >Level 2 (Standard)</span
            >
          </div>
          <p class="text-xs text-blue-600 dark:text-blue-400">
            100 additional controls - For apps handling sensitive data
          </p>
        </div>
        <div
          class="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-900/20"
        >
          <div class="mb-1 flex items-center gap-2">
            <span class="level-badge level-L3">L3</span>
            <span class="text-sm font-medium text-purple-700 dark:text-purple-300"
              >Level 3 (Advanced)</span
            >
          </div>
          <p class="text-xs text-purple-600 dark:text-purple-400">
            136 additional controls - For critical/high-risk applications
          </p>
        </div>
      </div>

      <!-- ASVS Coverage Visualization -->
      {#if summary.coverage}
        {@const l1Coverage = summary.coverage.L1}
        {@const l2Coverage = summary.coverage.L2 || { checked: 0, total: 150, percentage: 0 }}
        {@const totalControls = report?.scope?.totalAsvsControls?.L3 || 286}
        {@const remainingL1 = 50 - l1Coverage.checked}
        {@const remainingL2L3 = totalControls - 50}
        {@const l1BarWidth = (l1Coverage.checked / totalControls) * 100}
        {@const l2BarWidth = (l2Coverage.checked / totalControls) * 100}
        {@const remainingL1BarWidth = (remainingL1 / totalControls) * 100}
        <div class="mt-4">
          <div class="mb-2 flex items-center gap-2">
            <ChartBar size={16} class="text-zinc-500" />
            <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >Coverage Visualization</span
            >
          </div>
          <div class="flex h-6 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-700">
            <div
              class="flex items-center justify-center bg-green-500 text-xs font-semibold text-white"
              style="width: {l1BarWidth}%"
            >
              {l1Coverage.checked > 3 ? l1Coverage.checked : ''}
            </div>
            <div
              class="flex items-center justify-center bg-blue-500 text-xs font-semibold text-white"
              style="width: {l2BarWidth}%"
            >
              {l2Coverage.checked > 3 ? l2Coverage.checked : ''}
            </div>
            <div
              class="flex items-center justify-center bg-green-200 text-xs font-semibold text-green-700 dark:bg-green-800 dark:text-green-300"
              style="width: {remainingL1BarWidth}%"
            >
              {remainingL1 > 10 ? remainingL1 : ''}
            </div>
            <div
              class="flex flex-1 items-center justify-center bg-zinc-200 text-xs font-semibold text-zinc-500 dark:bg-zinc-600 dark:text-zinc-400"
            >
              {remainingL2L3}
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-sm bg-green-500"></span>
              L1 Checks ({l1Coverage.checked})
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-sm bg-blue-500"></span>
              L2 Checks ({l2Coverage.checked})
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-sm bg-green-200 dark:bg-green-800"></span>
              Remaining L1 ({remainingL1})
            </span>
            <span class="flex items-center gap-1">
              <span class="h-2.5 w-2.5 rounded-sm bg-zinc-200 dark:bg-zinc-600"></span>
              Remaining L2/L3 ({remainingL2L3})
            </span>
          </div>
        </div>

        <!-- What We Check & What This Means -->
        <div
          class="mt-5 grid gap-4 border-t border-zinc-100 pt-5 md:grid-cols-2 dark:border-zinc-700"
        >
          <div>
            <h4 class="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              What We Actually Check
            </h4>
            <p class="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              This automated assessment covers {l1Coverage.checked} of {l1Coverage.total} L1 controls
              ({l1Coverage.percentage}%) and {l2Coverage.checked} of {l2Coverage.total} L2 controls ({l2Coverage.percentage}%).
              These are controls that can be reliably verified through static code analysis.
            </p>
          </div>
          <div>
            <h4 class="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              What The Pass Rate Means
            </h4>
            <p class="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              The {score}% pass rate shown above means {summary.passed} of our {applicableChecks} automated
              checks passed. This is NOT {score}% ASVS compliant. Full compliance requires manual
              review and penetration testing.
            </p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Summary Cards -->
    <div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-6">
      <!-- Pass Rate Card -->
      <div class="rounded-xl bg-white p-5 text-center shadow-lg dark:bg-zinc-800">
        <div
          class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Pass Rate
        </div>
        <div
          class="mb-1 text-3xl font-bold"
          class:text-green-600={score >= 80}
          class:text-yellow-600={score >= 50 && score < 80}
          class:text-red-600={score < 50}
        >
          {score}%
        </div>
        <div class="text-xs text-zinc-400 dark:text-zinc-500">of our checks</div>
      </div>

      <!-- L1 Coverage Card -->
      {#if summary.coverage}
        <div class="rounded-xl bg-white p-5 text-center shadow-lg dark:bg-zinc-800">
          <div
            class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            L1 Coverage
          </div>
          <div class="mb-1 text-3xl font-bold text-green-600">
            {summary.coverage.L1.percentage}%
          </div>
          <div class="text-xs text-zinc-400 dark:text-zinc-500">
            {summary.coverage.L1.checked}/{summary.coverage.L1.total}
          </div>
        </div>
      {/if}

      <!-- L2 Coverage Card -->
      {#if summary.coverage?.L2}
        <div class="rounded-xl bg-white p-5 text-center shadow-lg dark:bg-zinc-800">
          <div
            class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            L2 Coverage
          </div>
          <div class="mb-1 text-3xl font-bold text-blue-600">{summary.coverage.L2.percentage}%</div>
          <div class="text-xs text-zinc-400 dark:text-zinc-500">
            {summary.coverage.L2.checked}/{summary.coverage.L2.total}
          </div>
        </div>
      {/if}

      <!-- Passed Card -->
      <div class="rounded-xl bg-white p-5 text-center shadow-lg dark:bg-zinc-800">
        <div
          class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Passed
        </div>
        <div class="mb-1 text-3xl font-bold text-green-600">{summary.passed}</div>
        <div class="text-xs text-zinc-400 dark:text-zinc-500">checks</div>
      </div>

      <!-- Failed Card -->
      <div class="rounded-xl bg-white p-5 text-center shadow-lg dark:bg-zinc-800">
        <div
          class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Failed
        </div>
        <div class="mb-1 text-3xl font-bold text-red-600">{summary.failed}</div>
        <div class="text-xs text-zinc-400 dark:text-zinc-500">checks</div>
      </div>

      <!-- Meta Card -->
      <div class="rounded-xl bg-white p-4 text-left text-sm shadow-lg dark:bg-zinc-800">
        <div class="mb-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Calendar size={14} class="text-zinc-400" />
          <span class="text-xs">{formattedDate}</span>
        </div>
        <div class="mb-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Tag size={14} class="text-zinc-400" />
          <span class="text-xs">v{summary.version}</span>
        </div>
        <div class="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <ListChecks size={14} class="text-zinc-400" />
          <span class="text-xs">{summary.total} checks</span>
        </div>
      </div>
    </div>

    <!-- Results Section (Authenticated Only) -->
    {#if isAuthenticated && report}
      <h2
        class="mb-4 mt-8 border-b-2 border-zinc-200 pb-2 text-xl font-semibold text-zinc-900 dark:border-zinc-700 dark:text-white"
      >
        Verification Results
      </h2>

      {#each categoryOrder as category}
        {#if checksByCategory[category]}
          <div class="mb-6">
            <h3
              class="mb-3 text-sm font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400"
            >
              {category}
            </h3>
            <div class="space-y-2">
              {#each checksByCategory[category] as check}
                <div
                  class="overflow-hidden rounded-lg border-l-4 bg-white shadow-sm dark:bg-zinc-800"
                  class:border-green-500={check.status === 'pass'}
                  class:border-red-500={check.status === 'fail'}
                  class:border-yellow-500={check.status === 'warning'}
                  class:border-blue-500={check.status === 'info'}
                  class:border-zinc-300={check.status === 'not-applicable'}
                >
                  <button
                    class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    onclick={() => toggleCheck(check.id)}
                    aria-expanded={expandedChecks.has(check.id)}
                  >
                    {#if check.status === 'pass'}
                      <CheckCircle size={20} class="flex-shrink-0 text-green-500" weight="fill" />
                    {:else if check.status === 'fail'}
                      <XCircle size={20} class="flex-shrink-0 text-red-500" weight="fill" />
                    {:else if check.status === 'warning'}
                      <Warning size={20} class="flex-shrink-0 text-yellow-500" weight="fill" />
                    {:else if check.status === 'not-applicable'}
                      <Prohibit size={20} class="flex-shrink-0 text-zinc-400" />
                    {:else}
                      <Info size={20} class="flex-shrink-0 text-blue-500" weight="fill" />
                    {/if}

                    <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400"
                      >{check.id}</span
                    >

                    <!-- Level Badge -->
                    {#if check.level}
                      <span class="level-badge level-{check.level}">{check.level}</span>
                    {/if}

                    <span class="flex-1 font-medium text-zinc-900 dark:text-white"
                      >{check.name}</span
                    >

                    <!-- OWASP Top 10 Badges -->
                    {#if check.top10 && check.top10.length > 0}
                      {#each check.top10 as t10}
                        <span class="owasp-badge" title="OWASP Top 10 2021">{t10}</span>
                      {/each}
                    {/if}

                    {#if check.locations && check.locations.length > 0}
                      <span
                        class="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                      >
                        <Code size={12} />
                        {check.locations.length}
                      </span>
                    {/if}

                    {#if expandedChecks.has(check.id)}
                      <CaretUp size={16} class="text-zinc-400" />
                    {:else}
                      <CaretDown size={16} class="text-zinc-400" />
                    {/if}
                  </button>

                  <p class="-mt-1 ml-8 px-4 pb-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {check.description}
                  </p>

                  {#if expandedChecks.has(check.id)}
                    {#if check.locations && check.locations.length > 0}
                      <div class="mx-4 mb-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-700/50">
                        <div
                          class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400"
                        >
                          <FileCode size={14} />
                          Evidence ({check.locations.length} locations)
                        </div>
                        <ul class="space-y-1">
                          {#each check.locations.slice(0, 10) as loc}
                            <li class="text-xs">
                              <span class="font-mono text-rose-600 dark:text-rose-400"
                                >{loc.file}:{loc.line}</span
                              >
                              {#if loc.snippet}
                                <code
                                  class="mt-0.5 block truncate rounded bg-white px-2 py-1 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                                >
                                  {loc.snippet}
                                </code>
                              {/if}
                            </li>
                          {/each}
                          {#if check.locations.length > 10}
                            <li class="pt-1 text-xs italic text-zinc-500 dark:text-zinc-400">
                              ... and {check.locations.length - 10} more locations
                            </li>
                          {/if}
                        </ul>
                      </div>
                    {/if}

                    {#if check.remediation}
                      <div
                        class="mx-4 mb-3 rounded-lg border-l-2 border-yellow-500 bg-yellow-50 p-3 dark:bg-yellow-900/20"
                      >
                        <div
                          class="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-400"
                        >
                          <Lightbulb size={14} />
                          Remediation
                        </div>
                        <pre
                          class="whitespace-pre-wrap font-mono text-xs text-zinc-700 dark:text-zinc-300">{check.remediation}</pre>
                      </div>
                    {/if}
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    {:else}
      <!-- Public Login Prompt -->
      <div class="mt-8 rounded-xl bg-white p-8 text-center shadow-lg dark:bg-zinc-800">
        <div class="mb-4 flex justify-center">
          <div class="rounded-full bg-rose-100 p-3 dark:bg-rose-900/30">
            <Lock size={32} class="text-rose-600 dark:text-rose-400" />
          </div>
        </div>
        <h3 class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
          Detailed Report Available
        </h3>
        <p class="mx-auto mb-4 max-w-md text-zinc-600 dark:text-zinc-400">
          The full ASVS assessment report with individual check results, code locations, and
          remediation guidance is available to authenticated clients.
        </p>
        <p class="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to view the complete security assessment.
        </p>
        <a
          href="/auth/login?return=/security/assessment"
          class="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-6 py-3 font-medium text-white transition-colors hover:bg-rose-600"
        >
          <SignIn size={20} />
          Sign In
        </a>
      </div>
    {/if}

    <!-- Footer -->
    <div
      class="mt-8 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    >
      <p>This assessment is generated automatically by our security scanning pipeline.</p>
      <p class="mt-1">
        Full ASVS compliance requires manual security review and penetration testing.
      </p>
      <p class="mt-2">
        <a href="/security" class="text-rose-600 hover:underline dark:text-rose-400">
          Back to Security
        </a>
      </p>
    </div>
  </div>
</div>

<style>
  .level-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .level-L1 {
    background-color: rgb(220 252 231);
    color: rgb(21 128 61);
  }

  .level-L2 {
    background-color: rgb(219 234 254);
    color: rgb(29 78 216);
  }

  .level-L3 {
    background-color: rgb(243 232 255);
    color: rgb(126 34 206);
  }

  :global(.dark) .level-L1 {
    background-color: rgb(21 128 61 / 0.3);
    color: rgb(134 239 172);
  }

  :global(.dark) .level-L2 {
    background-color: rgb(29 78 216 / 0.3);
    color: rgb(147 197 253);
  }

  :global(.dark) .level-L3 {
    background-color: rgb(126 34 206 / 0.3);
    color: rgb(216 180 254);
  }

  .owasp-badge {
    display: inline-flex;
    align-items: center;
    font-size: 0.6rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background-color: rgb(254 242 242);
    color: rgb(185 28 28);
    letter-spacing: 0.025em;
    font-family: ui-monospace, monospace;
  }

  :global(.dark) .owasp-badge {
    background-color: rgb(185 28 28 / 0.2);
    color: rgb(252 165 165);
  }
</style>
