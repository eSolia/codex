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
    ArrowLeft
  } from 'phosphor-svelte';

  let { data } = $props();

  interface Location {
    file: string;
    line: number;
    snippet?: string;
  }

  interface CheckResult {
    id: string;
    category: string;
    name: string;
    status: 'pass' | 'fail' | 'warning' | 'info';
    description: string;
    locations?: Location[];
    remediation?: string;
    asvsRef: string;
  }

  interface Report {
    timestamp: string;
    version: string;
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
    };
    checks: CheckResult[];
  }

  const report = data.report as Report;
  const score = Math.round((report.summary.passed / report.summary.total) * 100);
  const lastUpdated = new Date(report.timestamp);

  let expandedChecks = $state(new Set<string>());

  function toggleCheck(id: string) {
    if (expandedChecks.has(id)) {
      expandedChecks.delete(id);
      expandedChecks = new Set(expandedChecks);
    } else {
      expandedChecks.add(id);
      expandedChecks = new Set(expandedChecks);
    }
  }

  const checksByCategory = report.checks.reduce(
    (acc, check) => {
      if (!acc[check.category]) {
        acc[check.category] = [];
      }
      acc[check.category].push(check);
      return acc;
    },
    {} as Record<string, CheckResult[]>
  );

  const categoryOrder = [
    'V2 Authentication',
    'V3 Session Management',
    'V4 Access Control',
    'V5 Validation',
    'V7 Error Handling',
    'V8 Data Protection',
    'V9 Communication',
    'V10 Malicious Code'
  ];

  const formattedDate = lastUpdated.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
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
    <!-- Summary Cards -->
    <div class="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
      <!-- Score Card -->
      <div class="rounded-xl bg-white p-6 text-center shadow-lg dark:bg-zinc-800">
        <div
          class="mb-2 text-5xl font-bold"
          class:text-green-600={score >= 80}
          class:text-yellow-600={score >= 50 && score < 80}
          class:text-red-600={score < 50}
        >
          {score}%
        </div>
        <div class="text-sm text-zinc-500 dark:text-zinc-400">Compliance Score</div>
      </div>

      <!-- Stats Card -->
      <div class="rounded-xl bg-white p-5 shadow-lg dark:bg-zinc-800">
        <div class="mb-2 flex items-center gap-2">
          <CheckCircle size={18} class="text-green-500" weight="fill" />
          <span class="font-mono font-semibold text-green-600 dark:text-green-400"
            >{report.summary.passed}</span
          >
          <span class="text-sm text-zinc-500 dark:text-zinc-400">Passed</span>
        </div>
        <div class="mb-2 flex items-center gap-2">
          <XCircle size={18} class="text-red-500" weight="fill" />
          <span class="font-mono font-semibold text-red-600 dark:text-red-400"
            >{report.summary.failed}</span
          >
          <span class="text-sm text-zinc-500 dark:text-zinc-400">Failed</span>
        </div>
        <div class="flex items-center gap-2">
          <Warning size={18} class="text-yellow-500" weight="fill" />
          <span class="font-mono font-semibold text-yellow-600 dark:text-yellow-400"
            >{report.summary.warnings}</span
          >
          <span class="text-sm text-zinc-500 dark:text-zinc-400">Warnings</span>
        </div>
      </div>

      <!-- Meta Card -->
      <div class="rounded-xl bg-white p-5 text-sm shadow-lg dark:bg-zinc-800">
        <div class="mb-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Calendar size={16} class="text-zinc-400" />
          <span>{formattedDate}</span>
        </div>
        <div class="mb-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <Tag size={16} class="text-zinc-400" />
          <span>v{report.version}</span>
        </div>
        <div class="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          <ListChecks size={16} class="text-zinc-400" />
          <span>{report.summary.total} checks</span>
        </div>
      </div>

      <!-- Platform Card -->
      <div class="rounded-xl bg-rose-50 p-5 shadow-lg dark:bg-rose-900/20">
        <p class="mb-2 text-sm font-semibold text-rose-800 dark:text-rose-200">Cloudflare Platform</p>
        <p class="text-xs text-rose-600 dark:text-rose-300">
          D1 Database, R2 Storage, Workers AI, Vectorize - all with enterprise-grade security.
        </p>
      </div>
    </div>

    <!-- Results Section -->
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
                  {:else}
                    <Info size={20} class="flex-shrink-0 text-blue-500" weight="fill" />
                  {/if}

                  <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">{check.id}</span>
                  <span class="flex-1 font-medium text-zinc-900 dark:text-white">{check.name}</span>

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

    <!-- Footer -->
    <div
      class="mt-8 border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
    >
      <p>This assessment is generated automatically by our security scanning pipeline.</p>
      <p class="mt-2">
        <a href="/security" class="text-rose-600 hover:underline dark:text-rose-400">
          Back to Security
        </a>
      </p>
    </div>
  </div>
</div>
