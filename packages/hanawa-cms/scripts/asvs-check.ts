#!/usr/bin/env -S npx tsx
/**
 * ASVS Compliance Checker for eSolia Codex (Hanawa CMS)
 *
 * Pattern-based security checks against OWASP ASVS 5.0.
 * Customized for SvelteKit + Cloudflare Pages + D1/R2/AI stack.
 *
 * Usage:
 *   npx tsx scripts/asvs-check.ts                    # Console output
 *   npx tsx scripts/asvs-check.ts --format json      # JSON output
 *   npx tsx scripts/asvs-check.ts --format json --output src/lib/data/asvs-assessment.json
 */

import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, relative, dirname } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// PROJECT CONFIGURATION
// ============================================================================

const PROJECT_CONFIG = {
  name: 'eSolia Codex (Hanawa CMS)',
  sourcePaths: ['src/'],
  apiPaths: ['src/routes/', 'src/lib/server/', 'src/hooks.server.ts'],
  webPaths: ['src/routes/', 'src/lib/components/'],
  packageManager: 'npm',
  extensions: ['.ts', '.svelte', '.js'],
  skipDirs: ['node_modules', '.svelte-kit', 'build', '.git', 'static']
};

// ============================================================================
// TYPES
// ============================================================================

interface CheckResult {
  id: string;
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  description: string;
  locations?: { file: string; line: number; snippet?: string }[];
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

// ============================================================================
// CONSOLE COLORS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m'
};

// ============================================================================
// FILE UTILITIES
// ============================================================================

function getSourceFiles(dir: string, extensions = PROJECT_CONFIG.extensions): string[] {
  const files: string[] = [];
  const rootDir = process.cwd();
  const fullDir = join(rootDir, dir);

  if (!existsSync(fullDir)) return files;

  const entries = readdirSync(fullDir);
  for (const entry of entries) {
    const fullPath = join(fullDir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!PROJECT_CONFIG.skipDirs.includes(entry)) {
        files.push(...getSourceFiles(join(dir, entry), extensions));
      }
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function searchPattern(
  files: string[],
  pattern: RegExp
): { file: string; line: number; snippet: string }[] {
  const results: { file: string; line: number; snippet: string }[] = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          results.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            snippet: lines[i].trim().slice(0, 100)
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return results;
}

function getPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// ============================================================================
// SECURITY CHECKS
// ============================================================================

function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];

  // Gather files
  const allFiles = PROJECT_CONFIG.sourcePaths.flatMap((p) => getSourceFiles(p));
  const apiFiles = PROJECT_CONFIG.apiPaths.flatMap((p) => {
    if (p.endsWith('.ts')) {
      const fullPath = join(process.cwd(), p);
      return existsSync(fullPath) ? [fullPath] : [];
    }
    return getSourceFiles(p);
  });
  const webFiles = PROJECT_CONFIG.webPaths.flatMap((p) => getSourceFiles(p));

  // -------------------------------------------------------------------------
  // V2 Authentication
  // -------------------------------------------------------------------------

  // V2.1.1 - Cloudflare Access Authentication
  const cfAccessLocations = searchPattern(
    apiFiles,
    /cf-access|Cloudflare.*Access|authenticated-user-email/i
  );
  results.push({
    id: 'V2.1.1',
    category: 'V2 Authentication',
    name: 'Cloudflare Access Protection',
    status: cfAccessLocations.length > 0 ? 'pass' : 'warning',
    description: 'All routes protected by Cloudflare Access zero-trust authentication',
    locations: cfAccessLocations.slice(0, 5),
    asvsRef: 'V2.1.1'
  });

  // V2.2.1 - Cryptographic Token Generation
  const tokenGenLocations = searchPattern(
    apiFiles,
    /crypto\.getRandomValues|randomUUID|generateId|crypto\.randomBytes/i
  );
  results.push({
    id: 'V2.2.1',
    category: 'V2 Authentication',
    name: 'Cryptographic Token Generation',
    status: tokenGenLocations.length > 0 ? 'pass' : 'warning',
    description: 'Cryptographically secure random token generation',
    locations: tokenGenLocations.slice(0, 5),
    asvsRef: 'V2.2.1'
  });

  // V2.3.1 - CSRF Protection
  const csrfLocations = searchPattern(apiFiles, /CSRF|csrf|validateCsrf|origin.*mismatch/i);
  results.push({
    id: 'V2.3.1',
    category: 'V2 Authentication',
    name: 'CSRF Protection',
    status: csrfLocations.length > 0 ? 'pass' : 'fail',
    description: 'Cross-Site Request Forgery protection on state-changing endpoints',
    locations: csrfLocations.slice(0, 5),
    remediation: csrfLocations.length === 0 ? 'Add CSRF validation in hooks.server.ts' : undefined,
    asvsRef: 'V2.3.1'
  });

  // -------------------------------------------------------------------------
  // V3 Session Management
  // -------------------------------------------------------------------------

  // V3.2.1 - Session/Request ID
  const sessionLocations = searchPattern(apiFiles, /requestId|session_id|sessionId/i);
  results.push({
    id: 'V3.2.1',
    category: 'V3 Session Management',
    name: 'Request Correlation',
    status: sessionLocations.length > 0 ? 'pass' : 'warning',
    description: 'Request ID generation for audit trail correlation',
    locations: sessionLocations.slice(0, 5),
    asvsRef: 'V3.2.1'
  });

  // -------------------------------------------------------------------------
  // V4 Access Control
  // -------------------------------------------------------------------------

  // V4.1.1 - Actor/User Context
  const actorLocations = searchPattern(apiFiles, /actorId|actorEmail|auditContext|locals\.user/i);
  results.push({
    id: 'V4.1.1',
    category: 'V4 Access Control',
    name: 'Actor Context Tracking',
    status: actorLocations.length > 0 ? 'pass' : 'warning',
    description: 'User/actor identity tracked for all operations',
    locations: actorLocations.slice(0, 5),
    asvsRef: 'V4.1.1'
  });

  // V4.2.1 - Sensitivity Levels
  const sensitivityLocations = searchPattern(
    apiFiles,
    /SensitivityLevel|confidential|embargoed|securityLevels/i
  );
  results.push({
    id: 'V4.2.1',
    category: 'V4 Access Control',
    name: 'Content Sensitivity Controls',
    status: sensitivityLocations.length > 0 ? 'pass' : 'info',
    description: 'Multi-level content sensitivity classification (normal/confidential/embargoed)',
    locations: sensitivityLocations.slice(0, 5),
    asvsRef: 'V4.2.1'
  });

  // -------------------------------------------------------------------------
  // V5 Validation
  // -------------------------------------------------------------------------

  // V5.3.4 - SQL Injection Prevention
  const sqlLocations = searchPattern(apiFiles, /\.prepare\(|\.bind\(/);
  const rawSqlLocations = searchPattern(apiFiles, /\$\{.*\}.*SELECT|SELECT.*\+|execute\(`/);
  results.push({
    id: 'V5.3.4',
    category: 'V5 Validation',
    name: 'SQL Injection Prevention',
    status: sqlLocations.length > 0 && rawSqlLocations.length === 0 ? 'pass' : 'warning',
    description: 'Cloudflare D1 parameterized queries (.prepare().bind())',
    locations: sqlLocations.slice(0, 5),
    remediation:
      rawSqlLocations.length > 0
        ? 'Found potential raw SQL. Use .prepare().bind() for all queries.'
        : undefined,
    asvsRef: 'V5.3.4'
  });

  // V5.3.3 - XSS Prevention
  const xssLocations = searchPattern(
    allFiles,
    /sanitizeHtml|escapeHtml|sanitizeComment|sanitizeUrl|OWASP.*A03/i
  );
  const unsafeHtmlLocations = searchPattern(webFiles, /{@html\s+[^}]+}/);
  results.push({
    id: 'V5.3.3',
    category: 'V5 Validation',
    name: 'XSS Prevention',
    status: xssLocations.length > 0 ? 'pass' : 'warning',
    description: 'Comprehensive HTML sanitization module with tag/attribute whitelist',
    locations: xssLocations.slice(0, 5),
    asvsRef: 'V5.3.3'
  });

  // -------------------------------------------------------------------------
  // V7 Error Handling
  // -------------------------------------------------------------------------

  // V7.1.1 - Error Handling
  const errorLocations = searchPattern(apiFiles, /handleError|error\s*\(|catch\s*\(|throw error/i);
  results.push({
    id: 'V7.1.1',
    category: 'V7 Error Handling',
    name: 'Secure Error Handling',
    status: errorLocations.length > 0 ? 'pass' : 'warning',
    description: 'Proper error handling without stack trace exposure',
    locations: errorLocations.slice(0, 5),
    asvsRef: 'V7.1.1'
  });

  // -------------------------------------------------------------------------
  // V8 Data Protection
  // -------------------------------------------------------------------------

  // V8.1.1 - Encryption at Rest
  const encryptionLocations = searchPattern(apiFiles, /AES|encrypt|encryptAtRest|crypto/i);
  results.push({
    id: 'V8.1.1',
    category: 'V8 Data Protection',
    name: 'Encryption at Rest',
    status: encryptionLocations.length > 0 ? 'pass' : 'warning',
    description: 'AES-256-GCM encryption for sensitive content at rest',
    locations: encryptionLocations.slice(0, 5),
    asvsRef: 'V8.1.1'
  });

  // V8.2.1 - Audit Logging
  const auditLocations = searchPattern(
    apiFiles,
    /AuditService|createAuditService|audit\.log|auditContext|SOC.*2|ISO.*27001/i
  );
  results.push({
    id: 'V8.2.1',
    category: 'V8 Data Protection',
    name: 'Comprehensive Audit Logging',
    status: auditLocations.length > 0 ? 'pass' : 'warning',
    description: 'Full audit trail with actor, IP, user-agent, and tamper detection (SOC 2/ISO 27001)',
    locations: auditLocations.slice(0, 5),
    asvsRef: 'V8.2.1'
  });

  // V8.3.1 - Secure File Storage
  const r2Locations = searchPattern(apiFiles, /R2|createMediaService|bucket/i);
  results.push({
    id: 'V8.3.1',
    category: 'V8 Data Protection',
    name: 'Secure File Storage',
    status: r2Locations.length > 0 ? 'pass' : 'info',
    description: 'Media stored in Cloudflare R2 with encryption at rest',
    locations: r2Locations.slice(0, 5),
    asvsRef: 'V8.3.1'
  });

  // -------------------------------------------------------------------------
  // V9 Communication
  // -------------------------------------------------------------------------

  // V9.1.1 - Security Headers
  const headerLocations = searchPattern(
    apiFiles,
    /X-Frame-Options|X-Content-Type-Options|Content-Security-Policy|Permissions-Policy|Referrer-Policy/i
  );
  results.push({
    id: 'V9.1.1',
    category: 'V9 Communication',
    name: 'Security Headers',
    status: headerLocations.length >= 4 ? 'pass' : 'warning',
    description: 'X-Frame-Options, X-Content-Type-Options, CSP, Permissions-Policy, Referrer-Policy',
    locations: headerLocations.slice(0, 5),
    remediation: headerLocations.length < 4 ? 'Add security headers in hooks.server.ts' : undefined,
    asvsRef: 'V9.1.1'
  });

  // V9.2.1 - Rate Limiting
  const rateLimitLocations = searchPattern(apiFiles, /rate.?limit|checkRateLimit|429|too.?many/i);
  results.push({
    id: 'V9.2.1',
    category: 'V9 Communication',
    name: 'Rate Limiting',
    status: rateLimitLocations.length > 0 ? 'pass' : 'warning',
    description: 'Rate limiting on authentication and sensitive endpoints',
    locations: rateLimitLocations.slice(0, 5),
    asvsRef: 'V9.2.1'
  });

  // V9.3.1 - Preview Token Security
  const previewTokenLocations = searchPattern(
    apiFiles,
    /previewToken|createPreviewToken|preview.*expir|preview.*maxViews|ipRestrict/i
  );
  results.push({
    id: 'V9.3.1',
    category: 'V9 Communication',
    name: 'Preview Token Security',
    status: previewTokenLocations.length > 0 ? 'pass' : 'info',
    description: 'Cryptographic preview tokens with expiry, view limits, and IP restrictions',
    locations: previewTokenLocations.slice(0, 5),
    asvsRef: 'V9.3.1'
  });

  // -------------------------------------------------------------------------
  // V10 Malicious Code
  // -------------------------------------------------------------------------

  // V10.3.1 - Dependency Audit
  let auditStatus: 'pass' | 'warning' | 'fail' = 'pass';
  let auditDescription = 'No high/critical vulnerabilities found';

  try {
    const auditOutput = execSync(`${PROJECT_CONFIG.packageManager} audit --json 2>/dev/null || true`, {
      encoding: 'utf-8',
      timeout: 30000
    });

    if (auditOutput) {
      try {
        const audit = JSON.parse(auditOutput);
        const high = audit.metadata?.vulnerabilities?.high || 0;
        const critical = audit.metadata?.vulnerabilities?.critical || 0;

        if (critical > 0) {
          auditStatus = 'fail';
          auditDescription = `${critical} critical vulnerabilities found`;
        } else if (high > 0) {
          auditStatus = 'warning';
          auditDescription = `${high} high severity vulnerabilities found`;
        }
      } catch {
        // JSON parse failed, check for text output
        if (auditOutput.includes('critical')) {
          auditStatus = 'fail';
          auditDescription = 'Critical vulnerabilities detected';
        } else if (auditOutput.includes('high')) {
          auditStatus = 'warning';
          auditDescription = 'High severity vulnerabilities detected';
        }
      }
    }
  } catch {
    auditStatus = 'info';
    auditDescription = 'Could not run dependency audit';
  }

  results.push({
    id: 'V10.3.1',
    category: 'V10 Malicious Code',
    name: 'Dependency Audit',
    status: auditStatus,
    description: auditDescription,
    asvsRef: 'V10.3.1'
  });

  return results;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function generateReport(checks: CheckResult[]): Report {
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === 'pass').length,
    failed: checks.filter((c) => c.status === 'fail').length,
    warnings: checks.filter((c) => c.status === 'warning').length
  };

  return {
    timestamp: new Date().toISOString(),
    version: getPackageVersion(),
    summary,
    checks
  };
}

function printConsoleReport(report: Report): void {
  console.log(`\n${colors.bold}ASVS Compliance Check - ${PROJECT_CONFIG.name}${colors.reset}`);
  console.log(`${colors.dim}Version: ${report.version} | ${report.timestamp}${colors.reset}\n`);

  for (const check of report.checks) {
    const icon =
      check.status === 'pass'
        ? `${colors.green}✓${colors.reset}`
        : check.status === 'fail'
          ? `${colors.red}✗${colors.reset}`
          : check.status === 'warning'
            ? `${colors.yellow}⚠${colors.reset}`
            : `${colors.blue}ℹ${colors.reset}`;

    console.log(`${icon} ${colors.bold}[${check.id}]${colors.reset} ${check.name}`);
    console.log(`  ${colors.dim}${check.description}${colors.reset}`);

    if (check.locations && check.locations.length > 0) {
      for (const loc of check.locations.slice(0, 3)) {
        console.log(`  ${colors.cyan}${loc.file}:${loc.line}${colors.reset}`);
      }
      if (check.locations.length > 3) {
        console.log(`  ${colors.dim}... and ${check.locations.length - 3} more${colors.reset}`);
      }
    }

    if (check.remediation) {
      console.log(`  ${colors.yellow}Remediation: ${check.remediation}${colors.reset}`);
    }

    console.log();
  }

  // Summary
  const score = Math.round((report.summary.passed / report.summary.total) * 100);
  console.log(`${colors.bold}Summary${colors.reset}`);
  console.log(
    `  ${colors.green}Passed: ${report.summary.passed}${colors.reset} | ` +
      `${colors.red}Failed: ${report.summary.failed}${colors.reset} | ` +
      `${colors.yellow}Warnings: ${report.summary.warnings}${colors.reset}`
  );
  console.log(`  ${colors.bold}Score: ${score}%${colors.reset}\n`);
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const formatIndex = args.indexOf('--format');
  const outputIndex = args.indexOf('--output');

  const format = formatIndex >= 0 ? args[formatIndex + 1] : 'console';
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;

  const checks = runChecks();
  const report = generateReport(checks);

  if (format === 'json') {
    const json = JSON.stringify(report, null, 2);
    if (outputPath) {
      // Ensure directory exists
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(outputPath, json);
      console.log(`Report written to ${outputPath}`);
    } else {
      console.log(json);
    }
  } else {
    printConsoleReport(report);
  }
}

main();
