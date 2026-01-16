<script lang="ts">
  import {
    ShieldCheck,
    LockKey,
    UserCircleCheck,
    Database,
    FileText,
    Eye,
    Fingerprint,
    CloudCheck,
    ArrowSquareOut,
    CheckCircle,
    ShieldWarning,
  } from 'phosphor-svelte';

  const securityFeatures = [
    {
      icon: UserCircleCheck,
      title: 'Cloudflare Access',
      desc: 'Zero-trust authentication protects all routes. Every user verified before access.',
    },
    {
      icon: LockKey,
      title: 'Content Encryption',
      desc: 'AES-256-GCM encryption for sensitive content at rest. Per-content sensitivity levels.',
    },
    {
      icon: FileText,
      title: 'Comprehensive Audit Trail',
      desc: 'Every action logged with actor, IP, timestamp. SOC 2 and ISO 27001 aligned controls.',
    },
    {
      icon: Eye,
      title: 'Preview Token Security',
      desc: 'Cryptographic tokens with expiry, view limits, and IP restrictions for secure sharing.',
    },
    {
      icon: ShieldWarning,
      title: 'XSS Prevention',
      desc: 'Comprehensive HTML sanitization with tag/attribute whitelist. All user content sanitized.',
    },
    {
      icon: Database,
      title: 'SQL Injection Prevention',
      desc: 'Parameterized queries via Cloudflare D1. No raw SQL concatenation.',
    },
  ];

  const owaspItems = [
    {
      id: 'A01',
      name: 'Broken Access Control',
      desc: 'Cloudflare Access, sensitivity levels',
      status: 'pass',
    },
    {
      id: 'A02',
      name: 'Cryptographic Failures',
      desc: 'AES-256-GCM, secure tokens',
      status: 'pass',
    },
    { id: 'A03', name: 'Injection', desc: 'D1 parameterized, HTML sanitization', status: 'pass' },
    { id: 'A04', name: 'Insecure Design', desc: 'Defense-in-depth architecture', status: 'pass' },
    {
      id: 'A05',
      name: 'Security Misconfiguration',
      desc: 'Security headers, CSP policy',
      status: 'pass',
    },
    {
      id: 'A06',
      name: 'Vulnerable Components',
      desc: 'Dependency auditing, updates',
      status: 'pass',
    },
    { id: 'A07', name: 'Auth Failures', desc: 'Zero-trust, CSRF protection', status: 'pass' },
    { id: 'A08', name: 'Data Integrity', desc: 'Audit checksums, versioning', status: 'pass' },
    { id: 'A09', name: 'Logging Failures', desc: 'Comprehensive audit logging', status: 'pass' },
    { id: 'A10', name: 'SSRF', desc: 'Controlled external requests', status: 'pass' },
  ];
</script>

<svelte:head>
  <title>Security - Hanawa CMS</title>
  <meta
    name="description"
    content="Security practices and compliance information for eSolia Codex (Hanawa CMS)"
  />
</svelte:head>

<div class="min-h-screen bg-zinc-50 dark:bg-zinc-900">
  <!-- Hero Section -->
  <div class="bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-600 dark:to-rose-700">
    <div class="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div class="text-center">
        <div class="mb-4 flex justify-center">
          <div class="rounded-full bg-white/10 p-4 backdrop-blur-sm">
            <ShieldCheck size={56} class="text-white" weight="duotone" />
          </div>
        </div>
        <h1 class="mb-4 text-4xl font-bold text-white md:text-5xl">Security at eSolia Codex</h1>
        <p class="mx-auto max-w-2xl text-lg text-rose-100">
          Enterprise-grade security built into every layer. Zero-trust authentication, encryption at
          rest, comprehensive audit trails, and defense-in-depth architecture.
        </p>
      </div>
    </div>
  </div>

  <div class="mx-auto max-w-6xl px-4 py-12">
    <!-- Security Features Grid -->
    <section class="mb-16">
      <h2 class="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-white">
        Security Features
      </h2>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {#each securityFeatures as feature}
          <div class="rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-800">
            <div
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30"
            >
              <feature.icon size={24} class="text-rose-600 dark:text-rose-400" weight="duotone" />
            </div>
            <h3 class="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
              {feature.title}
            </h3>
            <p class="text-sm text-zinc-600 dark:text-zinc-400">{feature.desc}</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- OWASP Top 10 Grid -->
    <section class="mb-16">
      <h2 class="mb-8 text-center text-2xl font-bold text-zinc-900 dark:text-white">
        OWASP Top 10 Compliance
      </h2>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {#each owaspItems as item}
          <div
            class="rounded-lg border-l-4 border-green-500 bg-white p-4 shadow-sm dark:bg-zinc-800"
          >
            <div class="mb-1 flex items-center gap-2">
              <CheckCircle size={16} class="text-green-500" weight="fill" />
              <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400">{item.id}</span>
            </div>
            <h4 class="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">{item.name}</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
          </div>
        {/each}
      </div>
    </section>

    <!-- Infrastructure Section -->
    <section class="mb-16">
      <div class="rounded-2xl bg-gradient-to-r from-zinc-800 to-zinc-900 p-8 text-white">
        <div class="flex items-center gap-4 mb-6">
          <CloudCheck size={40} class="text-rose-400" weight="duotone" />
          <h2 class="text-2xl font-bold">Cloudflare Platform Security</h2>
        </div>
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <h3 class="mb-2 font-semibold text-rose-300">D1 Database</h3>
            <p class="text-sm text-zinc-300">
              SQLite at the edge with automatic encryption. Parameterized queries prevent injection.
            </p>
          </div>
          <div>
            <h3 class="mb-2 font-semibold text-rose-300">R2 Storage</h3>
            <p class="text-sm text-zinc-300">
              S3-compatible storage with encryption at rest. Secure presigned URLs for access.
            </p>
          </div>
          <div>
            <h3 class="mb-2 font-semibold text-rose-300">Workers AI</h3>
            <p class="text-sm text-zinc-300">
              Privacy-preserving AI. Content never leaves Cloudflare infrastructure.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Assessment CTA -->
    <section class="text-center">
      <div class="rounded-2xl bg-rose-50 p-8 dark:bg-rose-900/20">
        <Fingerprint size={48} class="mx-auto mb-4 text-rose-500" weight="duotone" />
        <h2 class="mb-3 text-2xl font-bold text-zinc-900 dark:text-white">
          ASVS Security Assessment
        </h2>
        <p class="mx-auto mb-6 max-w-xl text-zinc-600 dark:text-zinc-400">
          View our automated security assessment against OWASP Application Security Verification
          Standard (ASVS) 5.0.
        </p>
        <a
          href="/security/assessment"
          class="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-6 py-3 font-medium text-white transition-colors hover:bg-rose-600"
        >
          View Assessment
          <ArrowSquareOut size={18} />
        </a>
      </div>
    </section>
  </div>
</div>
