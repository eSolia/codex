---
id: m365-security-essentials-pricing
language: en
title: M365 Security Essentials - Timeline & Pricing
category: services
type: pricing-table
version: 2025-01-v4
status: production
tags:
  - "m365"
  - "security"
  - "cloudflare"
  - "pricing"
  - "timeline"
  - "smb"
sensitivity: normal
author: eSolia Technical Team
created: 2025-01-15
modified: 2025-01-15
version_history:
  - version: "2025-01"
    changes: "Initial version"
  - version: "2025-01-v2"
    changes: "Replace ASCII timeline with Mermaid diagram"
  - version: "2025-01-v3"
    changes: "Fix Mermaid timeline syntax (events require colon prefix)"
  - version: "2025-01-v4"
    changes: "Add eSolia branding colors (navy, orange, emerald)"
usage_notes: Timeline and pricing for M365 Security Essentials package.
Update this fragment when pricing changes - keeps main service description stable.
Pair with m365-security-essentials fragment for complete proposal.
---

## Implementation Timeline

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'cScale0': '#2D2F63', 'cScale1': '#FFBC68', 'cScale2': '#10b981', 'cScaleLabel0': '#ffffff', 'cScaleLabel1': '#2D2F63', 'cScaleLabel2': '#ffffff'}}}%%
timeline
    title M365 Security Essentials Implementation
    section Week 1
        Foundation : M365 admin account hardening
                   : MFA enrollment (all users)
                   : Defender for Office 365 configuration
                   : DNS zone audit and Cloudflare preparation
    section Week 2
        Email & DNS : Cloudflare DNS migration
                    : SPF/DKIM configuration
                    : DMARC p=none deployment
                    : Periodic monitoring setup
    section Week 3
        Zero Trust & Validation : Cloudflare Zero Trust policies
                                : WARP client deployment
                                : Full security validation
                                : User documentation and training
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
