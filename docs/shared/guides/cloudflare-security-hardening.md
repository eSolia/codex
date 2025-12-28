# Cloudflare Security Hardening Guide

> **Central Reference**: This is the canonical Cloudflare security guide for all eSolia applications (Nexus, Pulse, Periodic, Courier). Keep this single copy updated rather than maintaining per-app copies.

A comprehensive reference for securing Cloudflare infrastructure across all services and applications.

**Document version:** 1.1
**Last updated:** December 2025
**Scope:** Account security, DNS, SSL/TLS, WAF, Workers, Pages, R2, D1, origin protection

**eSolia Cloudflare resources:**

| App      | Type    | Resources                                |
| -------- | ------- | ---------------------------------------- |
| Nexus    | Workers | D1 (central), R2 (per-org), KV, Queues   |
| Pulse    | Pages   | D1 (per-org), R2 (per-org)               |
| Periodic | Pages   | D1 (per-org), R2 (per-org)               |
| Courier  | Pages   | KV (sessions only), uses Nexus for D1/R2 |

---

## Overview

This guide provides actionable security recommendations for each component of the Cloudflare ecosystem. Think of Cloudflare security like a medieval castle: multiple defensive layers work together, and a weakness in any single layer compromises the whole structure.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE SECURITY LAYERS                 │
├─────────────────────────────────────────────────────────────────┤
│  Account Security    │  Your keys to the castle               │
│  DNS Security        │  The castle's address and directions   │
│  Edge Security       │  The outer walls (WAF, DDoS, Bot)      │
│  Transport Security  │  The encrypted tunnels (SSL/TLS)       │
│  Origin Security     │  The inner keep (your servers)         │
│  Application Security│  The treasury (Workers, R2, D1, Pages) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Account Security

Account security is your first line of defense. A compromised account means attackers control everything downstream.

### 1.1 Authentication Hardening

| Setting                   | Recommended Value                | Why                                            |
| ------------------------- | -------------------------------- | ---------------------------------------------- |
| Two-Factor Authentication | Enabled (hardware key preferred) | Prevents credential-based attacks              |
| SSO Integration           | Enable with SAML/OIDC provider   | Centralizes authentication, enables MFA at IdP |
| Session Duration          | Shortest practical (4-8 hours)   | Limits exposure window for stolen sessions     |
| Active Sessions           | Review weekly                    | Detect unauthorized access                     |

**Action items:**

1. **Enable 2FA for all account members**
   - Navigate to **My Profile** → **Authentication**
   - Add a hardware security key (YubiKey, Titan) as primary
   - Add TOTP app as backup

2. **Configure SSO for teams**
   - Go to **Manage Account** → **Authentication** → **Login methods**
   - Enable your identity provider (Okta, Azure AD, Google Workspace)
   - Disable email-password login after SSO verification

3. **Set up SCIM provisioning** (Enterprise)
   - Automates user lifecycle management
   - Ensures departed employees lose access immediately

### 1.2 API Token Management

API tokens are programmatic credentials. Treat them like passwords—with even more care.

**Token creation principles:**

```
┌──────────────────────────────────────────────────────────────┐
│                    API TOKEN BEST PRACTICES                  │
├──────────────────────────────────────────────────────────────┤
│  ✓ Minimum necessary permissions only                       │
│  ✓ Scope to specific zones/accounts                         │
│  ✓ Set expiration dates (90 days maximum)                   │
│  ✓ Restrict by IP address when possible                     │
│  ✓ Use account-owned tokens for service accounts            │
│  ✗ Never use Global API Key in applications                 │
│  ✗ Never commit tokens to version control                   │
│  ✗ Never share tokens across environments                   │
└──────────────────────────────────────────────────────────────┘
```

**Creating a secure token:**

1. Go to **My Profile** → **API Tokens** (user tokens) or **Manage Account** → **Account API Tokens** (service accounts)
2. Select **Create Token**
3. Use a template or create custom permissions
4. Under **Client IP Address Filtering**, add allowed IP ranges
5. Set **TTL** to expire within 90 days
6. Store the token secret in a secrets manager—it's shown only once

**Token audit checklist (monthly):**

- [ ] Review all active tokens
- [ ] Revoke unused tokens
- [ ] Verify token permissions match current needs
- [ ] Check for tokens approaching expiration
- [ ] Ensure no tokens have overly broad permissions

### 1.3 Audit Logs

Enable and monitor audit logs to detect suspicious activity.

**Configuration:**

1. Navigate to **Manage Account** → **Audit Log**
2. Enable log retention for maximum available period
3. Export logs to external SIEM for long-term storage

**High-priority events to alert on:**

| Event Type                | Risk Level | Response                   |
| ------------------------- | ---------- | -------------------------- |
| New API token created     | High       | Verify creator and purpose |
| Account member added      | High       | Confirm authorization      |
| SSO configuration changed | Critical   | Immediate investigation    |
| Zone settings modified    | Medium     | Review changes             |
| WAF rules disabled        | Critical   | Immediate investigation    |

### 1.4 Member Role Management

Apply least-privilege principle to all account members.

**Role hierarchy:**

```
Super Administrator    → Full control (limit to 2-3 people)
    ↓
Administrator         → Most settings, no billing/member changes
    ↓
Domain-specific roles → Zone-scoped permissions only
    ↓
Read-only roles      → Analytics, logs viewing only
```

**Best practices:**

- Assign minimum required role for each function
- Use custom roles for specialized access patterns
- Review member list quarterly
- Remove inactive members after 30 days

---

## 2. DNS Security

DNS is the foundation of your web presence. Compromised DNS means attackers can redirect all traffic.

### 2.1 DNSSEC

DNSSEC cryptographically signs DNS records, preventing DNS spoofing attacks.

**Enable DNSSEC:**

1. Navigate to **DNS** → **Settings**
2. Click **Enable DNSSEC**
3. Copy the DS record details
4. Add DS record at your domain registrar
5. Wait 24-48 hours for propagation
6. Verify with: `dig +dnssec yourdomain.com`

**Verification checklist:**

- [ ] DNSSEC enabled in Cloudflare dashboard
- [ ] DS record added at registrar
- [ ] DNSSEC validation passing (check dnsviz.net)
- [ ] Monitoring configured for DNSSEC failures

### 2.2 CAA Records

Certificate Authority Authorization (CAA) records specify which CAs can issue certificates for your domain.

**Recommended CAA configuration:**

```dns
; Allow only Cloudflare and Let's Encrypt to issue certificates
yourdomain.com. CAA 0 issue "comodoca.com"
yourdomain.com. CAA 0 issue "digicert.com"
yourdomain.com. CAA 0 issue "letsencrypt.org"
yourdomain.com. CAA 0 issue "pki.goog"

; Allow wildcard only from specific CA
yourdomain.com. CAA 0 issuewild "digicert.com"

; Send violation reports
yourdomain.com. CAA 0 iodef "mailto:security@yourdomain.com"
```

**To add CAA records:**

1. Go to **DNS** → **Records**
2. Add CAA record type
3. Configure for each authorized certificate authority
4. Add `iodef` record for violation notifications

### 2.3 DNS Record Security

**Protect sensitive records:**

| Record Type          | Security Consideration        | Recommendation                                   |
| -------------------- | ----------------------------- | ------------------------------------------------ |
| MX                   | Exposes mail infrastructure   | Use email security providers, not direct servers |
| TXT (SPF/DKIM/DMARC) | Email authentication          | Implement all three; monitor DMARC reports       |
| CNAME                | Can expose internal hostnames | Avoid revealing internal naming conventions      |
| A/AAAA to origin     | Reveals origin IP             | Always proxy through Cloudflare (orange cloud)   |

**DNS proxy status rules:**

```
✓ Proxy (orange cloud):  Web traffic, APIs, anything HTTP/HTTPS
✗ DNS only (gray cloud): Mail servers (MX), non-HTTP services
```

### 2.4 Zone Holds

Prevent accidental or malicious zone deletion.

**Enable zone holds:**

1. Go to **Domain Registration** or contact support
2. Enable zone hold on production domains
3. Require manual verification for zone changes

---

## 3. SSL/TLS Security

Transport security protects data in transit. Misconfiguration here creates false sense of security.

### 3.1 Encryption Mode

**Choose the right encryption mode:**

```
┌────────────────────────────────────────────────────────────────┐
│  ENCRYPTION MODE COMPARISON                                   │
├─────────────────┬──────────────┬───────────────────────────────┤
│  Mode           │  Security    │  Use Case                     │
├─────────────────┼──────────────┼───────────────────────────────┤
│  Off            │  None        │  Never use                    │
│  Flexible       │  Low         │  Legacy only (avoid)          │
│  Full           │  Medium      │  Self-signed certs at origin  │
│  Full (Strict)  │  High        │  Production - recommended     │
│  Strict         │  Highest     │  Enterprise only              │
└─────────────────┴──────────────┴───────────────────────────────┘
```

**Recommended: Full (Strict)**

Requirements:

- Valid SSL certificate at origin (not expired)
- Certificate from trusted CA or Cloudflare Origin CA
- Certificate matches hostname (CN or SAN)

**Configure encryption mode:**

1. Go to **SSL/TLS** → **Overview**
2. Select **Full (Strict)**
3. Verify origin certificate meets requirements

### 3.2 Edge Certificates

**Universal SSL settings:**

| Setting                               | Recommended Value   | Purpose                             |
| ------------------------------------- | ------------------- | ----------------------------------- |
| Always Use HTTPS                      | On                  | Redirects HTTP to HTTPS             |
| Automatic HTTPS Rewrites              | On                  | Fixes mixed content                 |
| HTTP Strict Transport Security (HSTS) | Enable with caution | Browsers remember HTTPS requirement |
| Minimum TLS Version                   | TLS 1.2             | Blocks weak protocols               |
| TLS 1.3                               | On                  | Enables latest secure protocol      |
| Opportunistic Encryption              | On                  | Encrypts HTTP/2 traffic             |

**HSTS configuration (careful—hard to undo):**

```
Max-Age: 31536000 (1 year, start with 86400)
Include subdomains: Yes (only if all subdomains support HTTPS)
Preload: Only after thorough testing
```

### 3.3 Origin Certificates

**Use Cloudflare Origin CA certificates:**

Benefits:

- Free 15-year certificates
- Trusted only by Cloudflare (reduces attack surface)
- Automatic key management

**Generate origin certificate:**

1. Go to **SSL/TLS** → **Origin Server**
2. Click **Create Certificate**
3. Select hostnames to cover
4. Choose key type (ECDSA recommended for performance)
5. Set validity (15 years maximum)
6. Install on origin server

### 3.4 Authenticated Origin Pulls

Ensures only Cloudflare can connect to your origin.

```
┌─────────────────────────────────────────────────────────────┐
│  WITHOUT AUTHENTICATED ORIGIN PULLS                         │
│                                                             │
│  Internet → Cloudflare → Origin ← Attacker (direct)        │
│                                    ✗ Origin accepts        │
├─────────────────────────────────────────────────────────────┤
│  WITH AUTHENTICATED ORIGIN PULLS                            │
│                                                             │
│  Internet → Cloudflare (+ client cert) → Origin            │
│                          Attacker → Origin                  │
│                                    ✗ No cert = rejected    │
└─────────────────────────────────────────────────────────────┘
```

**Enable Authenticated Origin Pulls:**

1. Go to **SSL/TLS** → **Origin Server**
2. Enable **Authenticated Origin Pulls**
3. Download the Cloudflare CA certificate
4. Configure your web server to require client certificates:

**Nginx configuration:**

```nginx
ssl_client_certificate /path/to/cloudflare-origin-pull-ca.pem;
ssl_verify_client on;
```

**Apache configuration:**

```apache
SSLVerifyClient require
SSLVerifyDepth 1
SSLCACertificateFile /path/to/cloudflare-origin-pull-ca.pem
```

---

## 4. Web Application Firewall (WAF)

The WAF is your primary defense against application-layer attacks.

### 4.1 Managed Rulesets

**Enable all applicable managed rulesets:**

| Ruleset                             | Purpose                      | Recommendation                      |
| ----------------------------------- | ---------------------------- | ----------------------------------- |
| Cloudflare Managed Ruleset          | OWASP top 10, CVEs           | Enable, monitor for false positives |
| Cloudflare OWASP Core Ruleset       | Generic attack patterns      | Enable with paranoia level 1-2      |
| Exposed Credentials Check           | Leaked password detection    | Enable for login endpoints          |
| Cloudflare Leaked Credentials Check | Additional credential checks | Enable                              |

**Configuration steps:**

1. Go to **Security** → **WAF** → **Managed rules**
2. Enable each ruleset
3. Start in **Log** mode for 1-2 weeks
4. Review logged events for false positives
5. Create exceptions for legitimate traffic
6. Switch to **Block** mode

### 4.2 Custom Rules

**Essential custom rules:**

```
Rule 1: Block known bad user agents
────────────────────────────────────
Expression: http.user_agent contains "sqlmap" or
            http.user_agent contains "nikto" or
            http.user_agent contains "nmap"
Action: Block

Rule 2: Rate limit login endpoints
────────────────────────────────────
Expression: http.request.uri.path contains "/login" or
            http.request.uri.path contains "/api/auth"
Action: Rate limit (10 requests per minute per IP)

Rule 3: Block non-browser traffic to sensitive paths
────────────────────────────────────
Expression: http.request.uri.path contains "/admin" and
            not cf.client.bot and
            cf.bot_management.score lt 30
Action: Challenge (Managed)

Rule 4: Geographic restrictions (if applicable)
────────────────────────────────────
Expression: not ip.geoip.country in {"US" "JP" "GB"} and
            http.request.uri.path contains "/api"
Action: Block
```

### 4.3 Zone Lockdown

Restrict access to sensitive paths by IP address.

**Use cases:**

- Admin panels accessible only from office IPs
- API endpoints for known partners
- Staging environments

**Configure Zone Lockdown:**

1. Go to **Security** → **WAF** → **Tools**
2. Select **Zone Lockdown**
3. Create rule with URL patterns and allowed IPs
4. Enable rule

### 4.4 Rate Limiting

Protect against brute force and DDoS at the application layer.

**Recommended rate limits:**

| Endpoint Type         | Requests | Period   | Action               |
| --------------------- | -------- | -------- | -------------------- |
| Login/Auth            | 5        | 1 minute | Challenge then Block |
| API (authenticated)   | 100      | 1 minute | Rate limit response  |
| API (unauthenticated) | 20       | 1 minute | Block                |
| Contact forms         | 2        | 1 minute | Block                |
| Search                | 30       | 1 minute | Challenge            |

---

## 5. DDoS Protection

Cloudflare provides automatic DDoS protection, but tuning improves effectiveness.

### 5.1 HTTP DDoS Attack Protection

**Adjust sensitivity settings:**

1. Go to **Security** → **DDoS** → **HTTP DDoS attack protection**
2. Review ruleset sensitivity
3. For high-traffic sites, consider **High** sensitivity
4. For APIs, enable **API Shield** rules

**Override settings when needed:**

```
Scenario: Legitimate traffic spikes (product launch, news mention)
Solution: Temporarily reduce sensitivity or add IP allowlist

Scenario: Persistent low-volume attacks
Solution: Increase sensitivity, add custom rules for patterns
```

### 5.2 L3/L4 DDoS Protection

Network-layer protection is automatic but configurable.

**Review and adjust:**

1. Go to **Security** → **DDoS** → **Network-layer DDoS attack protection**
2. Enable all applicable rulesets
3. Review mitigation actions (typically keep defaults)

### 5.3 Bot Management

**For Business and Enterprise plans:**

| Bot Type                        | Recommended Action      |
| ------------------------------- | ----------------------- |
| Verified Bots (Googlebot, etc.) | Allow                   |
| Likely Automated                | Challenge or Rate Limit |
| Likely Human                    | Allow                   |
| Unknown                         | Challenge               |

**Configure bot management:**

1. Go to **Security** → **Bots**
2. Enable **Bot Fight Mode** (all plans) or **Super Bot Fight Mode** (Pro+)
3. Configure challenge settings for automated traffic
4. Allow verified bots for SEO

---

## 6. Origin Protection

Even with Cloudflare in front, your origin must be secure.

### 6.1 Hide Origin IP

**Your origin IP should be completely hidden:**

Verification checklist:

- [ ] No DNS records pointing directly to origin IP
- [ ] Historical DNS records don't reveal origin (check SecurityTrails)
- [ ] SSL certificate doesn't reveal origin hostname
- [ ] No information disclosure in headers or error pages
- [ ] SPF records don't reveal origin IP

**If origin IP is exposed:**

1. Migrate to new IP address
2. Update Cloudflare with new origin
3. Configure new server before DNS propagation
4. Enable all security measures on new IP
5. Monitor old IP for direct access attempts

### 6.2 Cloudflare Tunnel (Recommended)

Cloudflare Tunnel eliminates the need to expose any ports to the internet.

```
┌────────────────────────────────────────────────────────────────┐
│  TRADITIONAL SETUP                                             │
│                                                                │
│  Internet ──→ Cloudflare ──→ Origin (ports 80/443 open)       │
│          └──→ Attacker ──→ Origin (direct attack possible)    │
├────────────────────────────────────────────────────────────────┤
│  CLOUDFLARE TUNNEL                                             │
│                                                                │
│  Internet ──→ Cloudflare ←── cloudflared ←── Origin           │
│          └──→ Attacker ──✗ Origin (no open ports)             │
└────────────────────────────────────────────────────────────────┘
```

**Deploy Cloudflare Tunnel:**

1. Install `cloudflared` on your origin server
2. Authenticate: `cloudflared login`
3. Create tunnel: `cloudflared tunnel create <name>`
4. Configure tunnel routes in `config.yml`
5. Run tunnel: `cloudflared tunnel run <name>`
6. Lock down origin firewall (block all inbound except SSH from trusted IPs)

**Tunnel configuration example:**

```yaml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: app.example.com
    service: http://localhost:8080
  - hostname: api.example.com
    service: http://localhost:3000
  - service: http_status:404
```

### 6.3 Origin Firewall Rules

**If not using Tunnel, restrict origin access:**

```bash
# Allow only Cloudflare IPs (IPv4)
# Get current list: https://www.cloudflare.com/ips-v4

# iptables example
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  iptables -A INPUT -p tcp -s $ip --dport 443 -j ACCEPT
done
iptables -A INPUT -p tcp --dport 443 -j DROP

# Or use cloud provider security groups with Cloudflare IP ranges
```

---

## 7. Workers Security

Workers run code at the edge. Secure them like any production application.

### 7.1 Secrets Management

**Never hardcode sensitive values:**

```javascript
// ❌ BAD - Secrets in code
const API_KEY = 'sk-1234567890abcdef';

// ✅ GOOD - Secrets from environment
export default {
  async fetch(request, env) {
    const apiKey = env.API_KEY; // Injected by Cloudflare
  },
};
```

**Configure secrets:**

1. Go to **Workers & Pages** → Select worker → **Settings** → **Variables**
2. Add secrets as **Encrypted** environment variables
3. Reference via `env.SECRET_NAME` in code

**Or use Wrangler:**

```bash
wrangler secret put API_KEY
# Enter secret value when prompted
```

### 7.2 Bindings Security

**Scope bindings to minimum necessary:**

| Binding Type     | Security Consideration                                      |
| ---------------- | ----------------------------------------------------------- |
| KV Namespace     | Create separate namespaces per worker                       |
| R2 Bucket        | Use separate buckets for different data classifications     |
| D1 Database      | Use separate databases; apply row-level security in queries |
| Service Bindings | Authenticate between workers                                |

### 7.3 Request Validation

**Always validate incoming requests:**

```javascript
export default {
  async fetch(request, env) {
    // Validate origin (if applicable)
    const origin = request.headers.get('Origin');
    if (origin && !isAllowedOrigin(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Validate content type
    if (request.method === 'POST') {
      const contentType = request.headers.get('Content-Type');
      if (!contentType?.includes('application/json')) {
        return new Response('Invalid content type', { status: 400 });
      }
    }

    // Validate and sanitize input
    const body = await request.json();
    if (!isValidInput(body)) {
      return new Response('Invalid input', { status: 400 });
    }

    // Process request...
  },
};
```

---

## 8. Pages Security

Cloudflare Pages hosts static sites and full-stack applications.

### 8.1 Preview Deployment Protection

**Protect preview URLs from public access:**

1. Go to **Workers & Pages** → Select project → **Settings** → **General**
2. Enable **Access policy** for preview deployments
3. Configure who can view previews (account members, specific emails)

**Protect both preview and production:**

1. Enable access policy as above
2. Go to **Access** → **Applications**
3. Remove wildcard (`*`) from subdomain to protect `*.pages.dev`
4. Re-enable access policy to create separate policies for each

### 8.2 Build Security

**Secure your build environment:**

| Setting                  | Recommendation                              |
| ------------------------ | ------------------------------------------- |
| Environment variables    | Use encrypted variables for secrets         |
| Build commands           | Audit for command injection vulnerabilities |
| npm/package dependencies | Use lockfiles, audit regularly              |
| Git integration          | Use deploy hooks with secret verification   |

**Environment variable configuration:**

1. Go to **Settings** → **Environment variables**
2. Add production secrets with **Encrypt** enabled
3. Add preview environment secrets separately
4. Never log secret values during build

### 8.3 Custom Domain Security

**For Pages with custom domains:**

1. Configure WAF rules on the custom domain
2. Enable rate limiting for forms/APIs
3. Set up Access policies if needed
4. Configure security headers via `_headers` file:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

---

## 9. R2 Storage Security

R2 provides object storage. Misconfigured buckets are a common breach vector.

### 9.1 Access Control

**Default to private:**

```
┌────────────────────────────────────────────────────────────────┐
│  R2 ACCESS LEVELS                                              │
├────────────────────────────────────────────────────────────────┤
│  Private (default)    → Access only via Workers/API           │
│  Public (r2.dev URL)  → Anyone can read (development only)    │
│  Custom Domain        → Can add WAF, Access controls          │
└────────────────────────────────────────────────────────────────┘
```

**Best practices:**

1. **Keep buckets private** unless public access is required
2. **Use presigned URLs** for temporary access to private objects
3. **Use Cloudflare Access** to protect public buckets with authentication
4. **Disable r2.dev URL** for production buckets

### 9.2 API Token Scoping

**Create bucket-specific tokens:**

1. Go to **R2** → **Manage R2 API Tokens**
2. Create token with minimum permissions
3. Scope to specific buckets only
4. Set TTL and IP restrictions

**Permission levels:**

| Permission          | Use Case                        |
| ------------------- | ------------------------------- |
| Object Read         | Read-only access (CDN, backups) |
| Object Read & Write | Application data storage        |
| Admin Read & Write  | Bucket management (CI/CD only)  |

### 9.3 Object Lifecycle Rules

**Automatically manage sensitive data:**

```json
{
  "rules": [
    {
      "id": "delete-temp-uploads",
      "status": "Enabled",
      "filter": { "prefix": "temp/" },
      "expiration": { "days": 1 }
    },
    {
      "id": "move-logs-to-infrequent",
      "status": "Enabled",
      "filter": { "prefix": "logs/" },
      "transitions": [{ "days": 30, "storage_class": "INFREQUENT_ACCESS" }]
    }
  ]
}
```

### 9.4 CORS Configuration

**Restrict cross-origin access:**

```json
{
  "AllowedOrigins": ["https://app.example.com"],
  "AllowedMethods": ["GET", "PUT"],
  "AllowedHeaders": ["Content-Type", "Authorization"],
  "MaxAgeSeconds": 3600
}
```

---

## 10. D1 Database Security

D1 is Cloudflare's serverless SQL database. Apply database security principles.

### 10.1 Access Isolation

**Use separate databases per environment and client:**

```
Production    → d1-prod-main
Staging       → d1-staging-main
Development   → d1-dev-main

Multi-tenant  → d1-prod-client-a, d1-prod-client-b
              (physical isolation for compliance)
```

### 10.2 Query Safety

**Always use parameterized queries:**

```javascript
// ❌ BAD - SQL injection vulnerability
const result = await env.DB.prepare(`SELECT * FROM users WHERE email = '${email}'`).all();

// ✅ GOOD - Parameterized query
const result = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`).bind(email).all();
```

### 10.3 Data Encryption

**Encrypt sensitive data before storage:**

```javascript
// Encrypt before insert
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(sensitiveData)
);

await env.DB.prepare(`INSERT INTO sensitive_data (id, data, iv) VALUES (?, ?, ?)`)
  .bind(id, encrypted, iv)
  .run();
```

---

## 11. Security Headers

Configure security headers at the edge.

### 11.1 Transform Rules

**Add security headers via Transform Rules:**

1. Go to **Rules** → **Transform Rules** → **Modify Response Header**
2. Create rules for each header:

| Header                      | Value                                      | Purpose                |
| --------------------------- | ------------------------------------------ | ---------------------- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`      | Force HTTPS            |
| `X-Content-Type-Options`    | `nosniff`                                  | Prevent MIME sniffing  |
| `X-Frame-Options`           | `DENY`                                     | Prevent clickjacking   |
| `X-XSS-Protection`          | `1; mode=block`                            | Legacy XSS protection  |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`          | Control referrer info  |
| `Permissions-Policy`        | `geolocation=(), camera=(), microphone=()` | Disable APIs           |
| `Content-Security-Policy`   | Application-specific                       | Prevent XSS, injection |

### 11.2 Workers Headers

**Add headers in Workers:**

```javascript
async function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);

  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
```

---

## 12. Monitoring and Alerting

Security requires continuous monitoring.

### 12.1 Analytics and Logs

**Enable and review:**

| Log Type        | Purpose                 | Retention                 |
| --------------- | ----------------------- | ------------------------- |
| Firewall Events | Attack patterns, blocks | Export to SIEM            |
| Access Logs     | Request details         | Export to SIEM            |
| Audit Logs      | Configuration changes   | Maximum available         |
| Worker Logs     | Application errors      | Real-time + Workers Trace |

### 12.2 Alerting

**Configure notifications for:**

1. Go to **Notifications** → **Create**
2. Set up alerts:

| Alert Type               | Threshold            | Channel                      |
| ------------------------ | -------------------- | ---------------------------- |
| DDoS Attack              | Any detection        | Immediate (Slack, PagerDuty) |
| WAF Blocks Spike         | >100% above baseline | Immediate                    |
| Origin Health            | Any failure          | Immediate                    |
| SSL Certificate Expiring | 30 days              | Email                        |
| Account Login            | From new location    | Email                        |
| Settings Changed         | Any                  | Email                        |

### 12.3 Security Reporting

**Regular review schedule:**

| Review Type          | Frequency | Focus Areas                |
| -------------------- | --------- | -------------------------- |
| Firewall Events      | Daily     | New attack patterns        |
| Bot Analytics        | Weekly    | Automated traffic trends   |
| WAF Rule Performance | Monthly   | False positives, gaps      |
| Access Audit         | Monthly   | Member permissions, tokens |
| Security Posture     | Quarterly | Full configuration review  |

---

## Appendix A: Security Checklist

Use this checklist for new zone setup or security audits.

### Account Level

- [ ] 2FA enabled for all members
- [ ] SSO configured (if applicable)
- [ ] API tokens scoped and expiring
- [ ] Audit logs enabled and exported
- [ ] Member roles follow least privilege
- [ ] Inactive members removed

### DNS Level

- [ ] DNSSEC enabled
- [ ] DS record added at registrar
- [ ] CAA records configured
- [ ] All web records proxied (orange cloud)
- [ ] No origin IP exposure in DNS

### SSL/TLS Level

- [ ] Encryption mode: Full (Strict)
- [ ] Always Use HTTPS: On
- [ ] Minimum TLS Version: 1.2
- [ ] TLS 1.3: On
- [ ] HSTS configured (if appropriate)
- [ ] Origin certificate installed
- [ ] Authenticated Origin Pulls enabled

### WAF Level

- [ ] Managed rulesets enabled
- [ ] Custom rules for application
- [ ] Rate limiting configured
- [ ] Bot management enabled
- [ ] Sensitive paths protected

### Origin Level

- [ ] Origin IP hidden
- [ ] Cloudflare Tunnel deployed (or)
- [ ] Firewall allows only Cloudflare IPs
- [ ] Authenticated Origin Pulls configured
- [ ] No direct origin access possible

### Application Level

- [ ] Workers secrets encrypted
- [ ] R2 buckets private by default
- [ ] D1 queries parameterized
- [ ] Pages preview protected
- [ ] Security headers configured

### Monitoring Level

- [ ] Alerts configured
- [ ] Logs exported to SIEM
- [ ] Regular review scheduled

---

## Appendix B: Quick Reference Commands

**Verify DNSSEC:**

```bash
dig +dnssec yourdomain.com
```

**Check TLS configuration:**

```bash
nmap --script ssl-enum-ciphers -p 443 yourdomain.com
```

**Test security headers:**

```bash
curl -I https://yourdomain.com | grep -E "(Strict-Transport|X-Frame|X-Content|CSP)"
```

**Verify origin is hidden:**

```bash
# Should return Cloudflare IPs only
dig yourdomain.com +short

# Check historical records
# Use SecurityTrails, ViewDNS.info
```

**Test Authenticated Origin Pulls:**

```bash
# Should fail (no client cert)
curl -v https://origin-ip-or-hostname

# Should succeed (via Cloudflare)
curl -v https://yourdomain.com
```

---

## Appendix C: Resources

**Cloudflare Documentation:**

- Security Best Practices: https://developers.cloudflare.com/fundamentals/security/
- WAF Managed Rules: https://developers.cloudflare.com/waf/managed-rules/
- SSL/TLS Configuration: https://developers.cloudflare.com/ssl/
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

**Security Testing Tools:**

- SSL Labs: https://www.ssllabs.com/ssltest/
- Security Headers: https://securityheaders.com/
- DNSViz: https://dnsviz.net/

---

_Document maintained by eSolia. Review and update quarterly or after significant Cloudflare platform changes._
