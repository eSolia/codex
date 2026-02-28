---
title: "Security Checklist"
slug: security-checklist
category: guides
tags: [security, owasp, checklist, audit]
summary: "Pre-deployment security checklist covering OWASP Top 10 and more"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# Security Checklist for eSolia Applications

> **Central Reference**: This is the canonical security checklist for all eSolia applications. Use during development and code review.

Comprehensive security verification based on:

- **OWASP Top 10 (2021)** - Most critical web application security risks
- **OWASP ASVS v4.0** - Application Security Verification Standard
- **Mozilla Web Security Guidelines** - Browser security best practices

## Quick Reference: Pre-Commit Checklist

Before committing code, verify:

- [ ] No secrets in code (API keys, passwords, tokens)
- [ ] All user input validated and sanitized
- [ ] SQL/NoSQL queries use parameterized statements
- [ ] `{@html}` uses sanitization (`$lib/sanitize.ts`)
- [ ] Authentication checks on protected routes
- [ ] Authorization checks on data access (tenant isolation)
- [ ] Security headers configured
- [ ] InfoSec comments on security-relevant code

---

## OWASP Top 10 (2021) Verification

### A01:2021 - Broken Access Control

**Risk**: Users acting outside intended permissions.

#### Checklist

- [ ] **Authentication required** for all protected routes
- [ ] **Authorization checked** for every data access (not just route access)
- [ ] **Tenant isolation** enforced in all queries
- [ ] **CORS configured** restrictively (not `*`)
- [ ] **Directory listing** disabled
- [ ] **JWT/session** validated on every request
- [ ] **Rate limiting** on sensitive endpoints

#### SvelteKit Implementation

```typescript
// hooks.server.ts - Centralized auth check
export const handle: Handle = async ({ event, resolve }) => {
  const session = await getSession(event.cookies);

  // InfoSec: Require auth for /app/* routes
  if (event.url.pathname.startsWith('/app') && !session) {
    throw redirect(303, '/login');
  }

  event.locals.user = session?.user;
  event.locals.orgId = session?.orgId;

  return resolve(event);
};
```

```typescript
// +page.server.ts - Authorization in data access
export async function load({ params, locals, platform }) {
  const db = platform.env.DB;

  // InfoSec: Always filter by tenant - prevents IDOR
  const { results } = await db
    .prepare('SELECT * FROM records WHERE id = ? AND org_id = ?')
    .bind(params.id, locals.orgId)
    .all();

  if (results.length === 0) {
    throw error(404, 'Not found');
  }

  return { record: results[0] };
}
```

### A02:2021 - Cryptographic Failures

**Risk**: Exposure of sensitive data due to weak cryptography.

#### Checklist

- [ ] **HTTPS only** (redirect HTTP → HTTPS)
- [ ] **TLS 1.2+** minimum version
- [ ] **Strong algorithms** (AES-256, SHA-256, not MD5/SHA1)
- [ ] **Secrets in environment** (not in code or config files)
- [ ] **Passwords hashed** with bcrypt/argon2 (not plain SHA)
- [ ] **Sensitive data encrypted** at rest
- [ ] **PII minimized** in logs

#### Implementation

```typescript
// ❌ BAD: Weak hashing
const hash = crypto.createHash('md5').update(password).digest('hex');

// ✅ GOOD: Strong hashing (for tokens/secrets, not passwords)
const hash = crypto.createHash('sha256').update(secret).digest('hex');

// ✅ GOOD: Password hashing (use proper library)
import { hash, verify } from '@node-rs/argon2';
const passwordHash = await hash(password);
```

```typescript
// Environment variables
import { SECRET_KEY } from '$env/static/private'; // ✅ Server only
import { PUBLIC_APP_NAME } from '$env/static/public'; // ✅ Client safe

// ❌ NEVER do this
const API_KEY = 'sk-1234567890'; // Hardcoded secret
```

### A03:2021 - Injection

**Risk**: Untrusted data sent to interpreter as command/query.

#### Checklist

- [ ] **Parameterized queries** for all database operations
- [ ] **Input validation** on all user input
- [ ] **Output encoding** for HTML context
- [ ] **Command injection** prevented (no user input in shell commands)
- [ ] **LDAP/XPath/etc** injection prevented

#### D1 (Cloudflare) Implementation

```typescript
// ❌ BAD: SQL injection vulnerability
const query = `SELECT * FROM users WHERE email = '${email}'`;
await db.prepare(query).all();

// ✅ GOOD: Parameterized query
await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).all();

// ✅ GOOD: Multiple parameters
await db.prepare('SELECT * FROM records WHERE org_id = ? AND status = ?').bind(orgId, status).all();
```

### A04:2021 - Insecure Design

**Risk**: Missing or ineffective security controls in design.

#### Checklist

- [ ] **Threat modeling** performed for new features
- [ ] **Security requirements** defined before implementation
- [ ] **Rate limiting** on authentication endpoints
- [ ] **Account lockout** after failed attempts
- [ ] **Secure defaults** (deny by default)
- [ ] **Separation of concerns** (client vs server)

#### Rate Limiting Pattern

```typescript
// hooks.server.ts - Basic rate limiting
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  const recent = requests.filter((t) => t > now - windowMs);

  if (recent.length >= limit) {
    return false; // Rate limited
  }

  recent.push(now);
  rateLimitMap.set(ip, recent);
  return true;
}

// In handle function
if (event.url.pathname === '/api/auth/login') {
  const ip = event.getClientAddress();
  if (!checkRateLimit(ip, 5, 60000)) {
    // 5 attempts per minute
    throw error(429, 'Too many requests');
  }
}
```

### A05:2021 - Security Misconfiguration

**Risk**: Insecure default configurations, incomplete setup.

#### Checklist

- [ ] **Security headers** configured (CSP, X-Frame-Options, etc.)
- [ ] **Error messages** don't leak stack traces in production
- [ ] **Debug mode** disabled in production
- [ ] **Default credentials** changed
- [ ] **Unnecessary features** disabled
- [ ] **Cloud permissions** follow least privilege

#### Security Headers (SvelteKit)

```typescript
// hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // InfoSec: Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP - adjust for your app's needs
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com"
  );

  return response;
};
```

#### Cloudflare Pages `_headers` file

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### A06:2021 - Vulnerable and Outdated Components

**Risk**: Using components with known vulnerabilities.

#### Checklist

- [ ] **Dependencies audited** regularly (`npm audit`)
- [ ] **Automated updates** via Dependabot/Renovate
- [ ] **Lock files** committed (package-lock.json)
- [ ] **Unused dependencies** removed
- [ ] **EOL components** replaced

#### Audit Commands

```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Check for outdated packages
npm outdated

# Update all to latest (careful - may break things)
npm update
```

### A07:2021 - Identification and Authentication Failures

**Risk**: Weak authentication mechanisms.

#### Checklist

- [ ] **Strong passwords** enforced (12+ chars, complexity)
- [ ] **MFA available** for sensitive accounts
- [ ] **Session management** secure (httpOnly, secure, sameSite)
- [ ] **Session timeout** appropriate
- [ ] **Logout** invalidates session server-side
- [ ] **Password reset** secure (time-limited tokens)

#### Session Cookie Configuration

```typescript
// InfoSec: Secure session cookie settings
cookies.set('session', sessionId, {
  path: '/',
  httpOnly: true, // Prevents XSS access
  secure: !dev, // HTTPS only in production
  sameSite: 'lax', // CSRF protection
  maxAge: 60 * 60 * 24 * 7 // 7 days
});
```

#### Logout Implementation

```typescript
// +page.server.ts
export const actions = {
  logout: async ({ cookies, platform }) => {
    const sessionId = cookies.get('session');

    // InfoSec: Invalidate server-side session
    if (sessionId) {
      await platform.env.SESSIONS.delete(sessionId);
    }

    // Clear cookie
    cookies.delete('session', { path: '/' });

    throw redirect(303, '/');
  }
};
```

### A08:2021 - Software and Data Integrity Failures

**Risk**: Code and data without integrity verification.

#### Checklist

- [ ] **CSRF protection** on state-changing requests
- [ ] **Subresource integrity** for CDN scripts
- [ ] **Signed commits** in CI/CD
- [ ] **Dependency lock files** verified
- [ ] **Update mechanisms** authenticated

#### CSRF Protection for API Routes

```typescript
// hooks.server.ts
// InfoSec: SvelteKit form actions have built-in CSRF, but +server.ts routes don't
function validateCsrf(request: Request, url: URL): void {
  const isApiRoute = url.pathname.startsWith('/api/');
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  if (!isApiRoute || !isStateChanging) return;

  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    throw error(403, 'CSRF check failed');
  }
}
```

### A09:2021 - Security Logging and Monitoring Failures

**Risk**: Insufficient logging to detect attacks.

#### Checklist

- [ ] **Authentication events** logged (success/failure)
- [ ] **Authorization failures** logged
- [ ] **Input validation failures** logged
- [ ] **Sensitive data** NOT in logs (passwords, tokens, PII)
- [ ] **Log retention** appropriate
- [ ] **Alerting** on suspicious patterns

#### Audit Logging Pattern

```typescript
interface AuditEvent {
  action: string;
  userId?: string;
  orgId?: string;
  ip: string;
  timestamp: string;
  success: boolean;
  details?: Record<string, unknown>;
}

async function auditLog(event: AuditEvent, env: Env): Promise<void> {
  // InfoSec: Log security-relevant events
  // Never log: passwords, tokens, full credit cards, SSNs
  console.log(
    JSON.stringify({
      type: 'AUDIT',
      ...event,
      // Redact sensitive fields
      details: event.details ? redactSensitive(event.details) : undefined
    })
  );

  // Optionally store in D1 for queryable audit trail
  await env.DB.prepare(
    'INSERT INTO audit_log (action, user_id, org_id, ip, timestamp, success) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(event.action, event.userId, event.orgId, event.ip, event.timestamp, event.success ? 1 : 0)
    .run();
}
```

### A10:2021 - Server-Side Request Forgery (SSRF)

**Risk**: Server fetches attacker-controlled URL.

#### Checklist

- [ ] **URL validation** against allowlist
- [ ] **No user input** in fetch URLs (or strictly validated)
- [ ] **Internal IPs blocked** (127.0.0.1, 10.x, 192.168.x, etc.)
- [ ] **Metadata endpoints blocked** (169.254.169.254)

#### URL Validation

```typescript
// InfoSec: Validate URLs against allowlist
const ALLOWED_DOMAINS = ['api.example.com', 'cdn.example.com'];

function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Block private/internal IPs
    const ip = parsed.hostname;
    if (
      ip.startsWith('127.') ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip === 'localhost' ||
      ip === '169.254.169.254'
    ) {
      return false;
    }

    // Check against allowlist
    return ALLOWED_DOMAINS.includes(parsed.hostname);
  } catch {
    return false;
  }
}
```

---

## OWASP ASVS Additional Checks

Beyond the Top 10, ASVS provides deeper verification:

### V2: Authentication

- [ ] Password minimum 12 characters
- [ ] Password breach checking (Have I Been Pwned API)
- [ ] Account lockout after 10 failed attempts
- [ ] Secure password recovery (no security questions)

### V3: Session Management

- [ ] Session ID regenerated after login
- [ ] Concurrent session limits (optional)
- [ ] Idle timeout (30 minutes recommended)
- [ ] Absolute timeout (24 hours recommended)

### V4: Access Control

- [ ] Deny by default
- [ ] Consistent access control across all paths
- [ ] Feature flags server-verified (not client-only)

### V5: Input Validation

- [ ] Positive validation (allowlist, not blocklist)
- [ ] Structured data validation (JSON schema, Zod)
- [ ] File upload validation (type, size, content)

```typescript
// Zod schema validation example
import { z } from 'zod';

const CreateShareSchema = z.object({
  recipientEmail: z.string().email(),
  expiresIn: z.number().min(1).max(30), // Days
  pin: z.string().length(6).regex(/^\d+$/)
});

export const actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const data = Object.fromEntries(formData);

    // InfoSec: Validate input structure
    const result = CreateShareSchema.safeParse(data);
    if (!result.success) {
      return fail(400, { errors: result.error.flatten() });
    }

    // Use validated data
    const { recipientEmail, expiresIn, pin } = result.data;
  }
};
```

### V8: Data Protection

- [ ] Sensitive data identified and classified
- [ ] PII encrypted at rest
- [ ] Data retention policies implemented
- [ ] Secure deletion (not just soft delete for PII)

### V13: API Security

- [ ] API rate limiting
- [ ] API authentication on all endpoints
- [ ] API versioning
- [ ] Input size limits

---

## Platform-Specific Security

### Cloudflare Workers/Pages

- [ ] Secrets via `wrangler secret` (not wrangler.toml)
- [ ] D1 queries parameterized
- [ ] R2 paths include tenant isolation
- [ ] KV keys don't contain secrets
- [ ] HSTS configured in Cloudflare dashboard (see below)

#### Cloudflare HSTS Configuration

**Location**: Cloudflare Dashboard → SSL/TLS → Edge Certificates → HSTS

HSTS (HTTP Strict Transport Security) can be configured at both the **application level** (via headers in code) and the **Cloudflare edge level** (via dashboard). Configure both for defense-in-depth.

**Recommended Settings** (for sites committed to HTTPS):

| Setting                 | Value                | Reason                                                         |
| ----------------------- | -------------------- | -------------------------------------------------------------- |
| **Enable HSTS**         | ✅ ON                | Enables the header at edge level                               |
| **Max Age Header**      | 12 months (31536000) | Standard secure duration                                       |
| **Apply to subdomains** | ✅ ON                | All eSolia apps are on subdomains                              |
| **Preload**             | ✅ ON                | Strongest protection - browsers use HTTPS before first request |
| **No-Sniff Header**     | ✅ ON                | Prevents MIME-type sniffing (X-Content-Type-Options: nosniff)  |

**Cautions**:

- Once enabled with a long max-age, browsers remember to always use HTTPS
- If you ever need HTTP access, users will be locked out for the duration
- Preload is semi-permanent - once on browser preload lists, removal is difficult
- Only enable if you are **committed to HTTPS permanently**

**HSTS Preload List** (Optional):
After enabling Preload in Cloudflare, submit your domain at https://hstspreload.org/ to be added to browser preload lists. This means Chrome, Firefox, Safari, and Edge will **always** use HTTPS for your domain - even on the very first visit.

**Defense in Depth**:
Having HSTS at both levels is good practice:

- **Cloudflare edge**: Applies to all requests hitting the edge
- **App-level headers**: Backup if edge config changes or for direct origin access

```typescript
// App-level HSTS (hooks.server.ts or middleware)
response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
```

### Tauri (Desktop)

- [ ] IPC commands validated
- [ ] Filesystem access minimized
- [ ] `tauri.allowlist` restrictive
- [ ] Auto-updater uses signed updates
- [ ] CSP configured in tauri.conf.json

---

## Code Review Security Checklist

Use this during pull request review:

### Authentication & Authorization

- [ ] Auth required for protected routes
- [ ] Authorization checked for data access
- [ ] Tenant isolation in all queries

### Input/Output

- [ ] Input validated (Zod/schema)
- [ ] SQL uses parameterized queries
- [ ] HTML output sanitized
- [ ] URLs validated before fetch

### Secrets & Data

- [ ] No hardcoded secrets
- [ ] Sensitive data not logged
- [ ] Cookies have security attributes

### Headers & Config

- [ ] Security headers set
- [ ] CORS restrictive
- [ ] CSRF protection for API routes

---

## Security Testing Tools

### Automated Scanning

```bash
# Dependency vulnerabilities
npm audit

# Static analysis (if using ESLint security plugin)
npm run lint

# OWASP ZAP (dynamic scanning)
# Run against staging environment
```

### Manual Testing

1. **Authentication bypass**: Try accessing protected routes without auth
2. **IDOR**: Change IDs in URLs to access other users' data
3. **XSS**: Input `<script>alert(1)</script>` in all fields
4. **SQL injection**: Input `' OR '1'='1` in search fields
5. **CSRF**: Submit forms from external origin

---

## 15-Factor App Methodology

Beyond the 12-Factor App, additional factors for modern cloud-native applications:

### Core Factors (Security-Relevant)

#### 1. Codebase

- [ ] Single codebase tracked in version control
- [ ] No secrets committed to repository
- [ ] Branch protection enabled on main branches

#### 2. Dependencies

- [ ] Dependencies explicitly declared (package.json, requirements.txt)
- [ ] Lock files committed for reproducible builds
- [ ] Regular security audits (`npm audit`, `pip-audit`)

#### 3. Config

- [ ] Configuration stored in environment variables
- [ ] Secrets managed via secret store (Cloudflare Secrets, Vault)
- [ ] No hardcoded credentials or API keys

#### 4. Backing Services

- [ ] Databases, caches, queues accessed via URLs/bindings
- [ ] Credentials rotatable without code changes
- [ ] Connection strings not logged

#### 5. Build, Release, Run

- [ ] Strict separation between build and run stages
- [ ] Immutable releases (no code changes in production)
- [ ] Release tagged and traceable

#### 6. Processes

- [ ] Applications are stateless
- [ ] Session state stored externally (KV, D1)
- [ ] No sticky sessions (horizontal scaling safe)

#### 7. Port Binding

- [ ] Self-contained, no runtime injection
- [ ] HTTPS enforced (not just HTTP)

#### 8. Concurrency

- [ ] Scale via process model
- [ ] No shared mutable state between instances
- [ ] Worker isolation (Cloudflare Workers)

#### 9. Disposability

- [ ] Fast startup, graceful shutdown
- [ ] Robust against sudden death
- [ ] No dangling connections on restart

#### 10. Dev/Prod Parity

- [ ] Local dev matches production as closely as possible
- [ ] Same backing services (use miniflare for D1/KV)
- [ ] Same security controls in dev and prod

#### 11. Logs

- [ ] Logs treated as event streams
- [ ] No PII in logs (sanitize before logging)
- [ ] Structured logging (JSON format)

#### 12. Admin Processes

- [ ] One-off admin tasks run as scripts
- [ ] Same codebase and config as app
- [ ] Audit logged

#### 13. API First (15-Factor Extension)

- [ ] API designed before implementation
- [ ] OpenAPI/Swagger specification maintained
- [ ] Versioned APIs

#### 14. Telemetry (15-Factor Extension)

- [ ] Application metrics collected
- [ ] Health endpoints exposed
- [ ] Distributed tracing implemented

#### 15. Security (15-Factor Extension)

- [ ] Defense in depth (multiple layers)
- [ ] Zero trust networking
- [ ] Least privilege access

---

## NIST Cybersecurity Framework (CSF)

The NIST CSF provides a high-level framework for managing cybersecurity risk. Map security controls to these functions:

### Identify (ID)

Develop understanding of cybersecurity risk.

- [ ] **ID.AM-1**: Physical devices and systems inventoried
- [ ] **ID.AM-2**: Software platforms and applications inventoried
- [ ] **ID.AM-3**: Data flows documented
- [ ] **ID.AM-5**: Resources prioritized by classification/criticality
- [ ] **ID.RA-1**: Asset vulnerabilities identified
- [ ] **ID.RA-3**: Threats identified (threat modeling)
- [ ] **ID.GV-1**: Security policy established

#### eSolia Application Context

```markdown
- Cloudflare resources documented in wrangler.toml
- Data flows documented in architecture diagrams
- Client data classified (PII, financial, public)
- Dependencies scanned for vulnerabilities
```

### Protect (PR)

Implement safeguards for critical services.

- [ ] **PR.AC-1**: Identities and credentials managed
- [ ] **PR.AC-3**: Remote access managed (SSO, MFA)
- [ ] **PR.AC-4**: Access permissions managed (RBAC)
- [ ] **PR.AC-5**: Network integrity protected (segmentation)
- [ ] **PR.DS-1**: Data-at-rest protected (encryption)
- [ ] **PR.DS-2**: Data-in-transit protected (TLS)
- [ ] **PR.DS-5**: Protections against data leaks
- [ ] **PR.IP-1**: Configuration baselines maintained
- [ ] **PR.IP-3**: Configuration change control

#### eSolia Application Context

```markdown
- M365 SSO for authentication (Nexus OAuth)
- Role-based access in each app
- All data encrypted at rest (D1, R2)
- TLS 1.2+ for all traffic
- Security headers configured
```

### Detect (DE)

Implement activities to identify cybersecurity events.

- [ ] **DE.AE-1**: Network baseline established
- [ ] **DE.AE-3**: Event data aggregated
- [ ] **DE.CM-1**: Network monitored
- [ ] **DE.CM-4**: Malicious code detected
- [ ] **DE.CM-7**: Unauthorized access detected
- [ ] **DE.DP-4**: Detection information communicated

#### eSolia Application Context

```markdown
- Audit logging for authentication events
- Rate limiting on sensitive endpoints
- Cloudflare WAF rules
- Error monitoring and alerting
```

### Respond (RS)

Take action regarding detected events.

- [ ] **RS.RP-1**: Response plan executed
- [ ] **RS.CO-2**: Events reported
- [ ] **RS.AN-1**: Notifications investigated
- [ ] **RS.MI-1**: Incidents contained
- [ ] **RS.MI-2**: Incidents mitigated

#### eSolia Application Context

```markdown
- Incident response playbook documented
- Alert channels configured (email, Slack)
- Ability to revoke sessions/tokens
- Ability to block IPs/users
```

### Recover (RC)

Restore capabilities impaired by incidents.

- [ ] **RC.RP-1**: Recovery plan executed
- [ ] **RC.IM-1**: Recovery plans incorporate lessons learned
- [ ] **RC.CO-3**: Recovery activities communicated

#### eSolia Application Context

```markdown
- Backup and restore procedures tested
- D1 database export/import documented
- R2 bucket replication (if required)
- Rollback procedures for deployments
```

### NIST CSF Quick Reference

| Function     | Purpose                     | Key Controls                                          |
| ------------ | --------------------------- | ----------------------------------------------------- |
| **Identify** | Understand assets and risks | Asset inventory, data classification, threat modeling |
| **Protect**  | Implement safeguards        | Access control, encryption, security training         |
| **Detect**   | Identify security events    | Monitoring, logging, anomaly detection                |
| **Respond**  | Act on detected events      | Incident response, containment, communication         |
| **Recover**  | Restore normal operations   | Backup/restore, lessons learned, improvements         |

---

## Incident Response

If a security issue is found:

1. **Assess severity** (Critical/High/Medium/Low)
2. **Document** the vulnerability and affected systems
3. **Patch** immediately for Critical/High
4. **Notify** stakeholders per severity
5. **Post-mortem** to prevent recurrence

---

**Document Version:** 1.2
**Last Updated:** December 2025
**Standards:** OWASP Top 10 (2021), OWASP ASVS 4.0, NIST CSF, 15-Factor App, Mozilla Web Security Guidelines
