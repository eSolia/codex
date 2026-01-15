# eSolia M365 Security Essentials
## Foundation-Level Protection for Modern Small Businesses

---

**Service Package:** M365 Security Essentials  
**Target Audience:** SMBs (10-100 employees) with Microsoft 365 Business Premium  
**Implementation Time:** 2-3 weeks  
**Monthly Monitoring:** Included via eSolia Periodic

---

## The Challenge

Your business runs on Microsoft 365 and cloud services. But out-of-the-box settings leave critical gaps that attackers actively exploit—misconfigured email authentication, exposed admin accounts, and endpoints connecting from anywhere without verification.

Think of it like moving into a new office building: the doors lock, but you haven't installed the security cameras, programmed the access cards, or set up the alarm system.

**This package installs your digital security system.**

---

## What You Get

### 1. Microsoft 365 Business Premium Hardening

We configure the security features already included in your license—features that protect nothing until properly set up.

| Security Control | What It Does | Business Impact |
|-----------------|--------------|-----------------|
| **Multi-Factor Authentication (MFA)** | Requires phone verification for all sign-ins | Blocks 99.9% of account compromise attacks |
| **Security Defaults Optimization** | Enforces baseline protections across all users | Eliminates common configuration gaps |
| **Admin Account Protection** | Dedicated, MFA-enforced admin accounts | Prevents privilege escalation attacks |
| **Legacy Protocol Blocking** | Disables outdated authentication methods | Closes backdoors that bypass MFA |
| **Conditional Access (Basic)** | Location and risk-based access policies | Blocks suspicious sign-in attempts automatically |
| **Defender for Office 365** | Anti-phishing, Safe Links, Safe Attachments | Catches threats that basic filtering misses |
| **Data Loss Prevention (Basic)** | Prevents accidental sharing of sensitive data | Reduces compliance exposure |
| **Audit Logging Configuration** | 90-day activity retention (default) | Provides investigation trail |

**Note on Advanced Features:**  
M365 Business Premium includes Intune for device management. Full device compliance policies, app protection, and endpoint configuration require Intune enrollment—a separate phase that takes 4-6 weeks for proper rollout. This package establishes your security foundation; Intune deployment is available as a follow-on engagement.

*Features requiring Intune (not included in this package):*
- Device compliance enforcement in Conditional Access
- Mobile Application Management (MAM) policies  
- Windows Autopilot device provisioning
- BitLocker enforcement and recovery key management
- Endpoint configuration profiles

---

### 2. Cloudflare Pro + DNS Migration

Your domain is your digital identity. We migrate DNS management to Cloudflare, adding enterprise-grade protection to your existing website and email infrastructure.

| Capability | What It Does | Business Impact |
|-----------|--------------|-----------------|
| **DNS Zone Protection** | DDoS mitigation, DNSSEC signing | Prevents domain hijacking and DNS attacks |
| **Website Security** | WAF rules, bot management, SSL/TLS | Protects public-facing web properties |
| **Performance Optimization** | Global CDN, caching, image optimization | Faster site for visitors worldwide |
| **Always Online™** | Cached version during origin failures | Maintains availability during outages |
| **Analytics & Insights** | Traffic patterns, threat intelligence | Visibility into who's accessing your domain |

**Migration Process:**
1. Audit current DNS records and TTLs
2. Replicate zone in Cloudflare
3. Coordinate nameserver cutover (minimal downtime)
4. Verify all services resolve correctly
5. Enable security features progressively

---

### 3. Email Security Configuration (SPF, DKIM, DMARC)

Email spoofing is trivially easy without proper authentication. We implement the full email security stack—configured for maximum protection, not just "passing" compliance checks.

| Protocol | What It Does | Our Configuration |
|----------|--------------|-------------------|
| **SPF (Sender Policy Framework)** | Lists authorized sending servers | Strict `-all` policy (fail unauthorized) |
| **DKIM (DomainKeys Identified Mail)** | Cryptographically signs outbound email | 2048-bit keys, proper selector rotation |
| **DMARC (Domain-based Message Authentication)** | Policy for handling failures | `p=reject` (ultimate goal), phased rollout |

**DMARC Rollout Phases:**
1. **Week 1-2:** `p=none` with monitoring (collect data, identify legitimate senders)
2. **Week 3-4:** `p=quarantine` (suspicious mail to spam)
3. **Week 5+:** `p=reject` (block all unauthorized mail)

*Why "p=reject" matters:* Anything less lets spoofed emails through. Many implementations stop at `p=none`—which does nothing except generate reports.

---

### 4. Ongoing Monitoring via eSolia Periodic

Security isn't a one-time setup. We continuously monitor your configuration through our **Periodic** monitoring platform at [periodic.esolia.co.jp](https://periodic.esolia.co.jp).

| Monitoring Area | Check Frequency | Alert Threshold |
|----------------|-----------------|-----------------|
| **DNS Zone Integrity** | Every 15 minutes | Any record change (A, MX, TXT, CNAME) |
| **SSL/TLS Certificates** | Every 15 minutes | Expiry <30 days, chain issues |
| **Website Availability** | Every 15 minutes | Downtime detected |
| **Domain Reputation** | Daily | Blacklist appearance |
| **DMARC Report Analysis** | Regular (typically daily) | Unauthorized senders detected |

**Monthly Reports Include:**
- DMARC report summary (volume, pass/fail rates, unauthorized senders)
- DNS change log
- Uptime statistics
- Recommendations for improvement

---

### 5. Cloudflare Zero Trust (Endpoint Protection)

Traditional VPNs trust everything inside the network. Zero Trust verifies every connection, every time—without requiring full device enrollment.

| Capability | What It Does | Business Impact |
|-----------|--------------|-----------------|
| **WARP Client** | Encrypted tunnel for all device traffic | Protects data in transit everywhere |
| **Gateway DNS Filtering** | Block malicious domains at DNS layer | Prevents malware callbacks, phishing sites |
| **Secure Web Gateway** | HTTP/S inspection and policy enforcement | Blocks downloads from risky categories |
| **Access Policies** | Identity-aware application access | SaaS apps protected without VPN complexity |
| **Device Posture (Basic)** | OS version, disk encryption checks | Baseline security verification |

**Deployment Without Intune:**
This package deploys WARP clients manually or via simple installer distribution. For automatic deployment, compliance enforcement, and advanced posture checks, Intune integration is recommended as a follow-on phase.

*What's included:*
- WARP client deployment to company devices
- Gateway DNS and HTTP policies
- Basic device posture rules
- Access policies for critical applications

*What requires Intune (future phase):*
- Automatic client deployment via MDM
- Strict device compliance enforcement
- Certificate-based device trust
- Conditional access integration

---

## Implementation Timeline

```
Week 1: Foundation
├── M365 admin account hardening
├── MFA enrollment (all users)
├── Defender for Office 365 configuration
└── DNS zone audit and Cloudflare preparation

Week 2: Email & DNS
├── Cloudflare DNS migration (coordinated cutover)
├── SPF/DKIM configuration
├── DMARC p=none deployment
└── Periodic monitoring setup

Week 3: Zero Trust & Validation
├── Cloudflare Zero Trust policies
├── WARP client deployment
├── Full security validation
└── User documentation and training
```

---

## Pricing

| Component | One-Time Setup | Annual Recurring |
|-----------|---------------|------------------|
| M365 Business Premium (10 users) | — | ¥400,000* |
| M365 Business Premium Hardening | ¥150,000 | — |
| Cloudflare Pro + DNS Migration | ¥100,000 | ¥100,000 |
| Email Security (SPF/DKIM/DMARC) | ¥80,000 | — |
| Cloudflare Zero Trust (Basic) | ¥120,000 | ¥0** |
| Periodic Monitoring (first domain) | — | ¥20,000 |
| **Total** | **¥450,000** | **¥520,000** |

*\* M365 Business Premium subscription*  
*\*\* Cloudflare Zero Trust free tier for up to 50 users*

---

## What Comes Next

This package establishes your security foundation. Common follow-on engagements include:

| Phase | Focus | Timeline |
|-------|-------|----------|
| **Intune Deployment** | Full device management, compliance policies | 4-6 weeks |
| **E5 Security Upgrade** | Advanced threat protection, insider risk | 6-8 weeks |
| **ISO 27001 Preparation** | ISMS documentation, certification readiness | 3-6 months |
| **Incident Response Planning** | Playbooks, tabletop exercises | 2-3 weeks |

---

*Document Version: 1.0 | January 2026*  
*eSolia Inc. | Tokyo, Japan*
