---
id: periodic-monitoring
language: en
title: DNS & Email Monitoring (Periodic)
category: services
type: service-description
version: 2025-01
status: production
tags:
  - "dns"
  - "email"
  - "monitoring"
  - "spf"
  - "dkim"
  - "dmarc"
  - "periodic"
sensitivity: normal
author: rick.cogley@esolia.co.jp
created: 2025-12-27
modified: 2025-12-27
review_due: 2026-03-27
allowed_collections:
  - "proposals"
  - "help"
  - "concepts"
---

Our Periodic service continuously monitors your domains for DNS configuration
drift and email authentication issues. You'll receive alerts if SPF, DKIM,
or DMARC records change unexpectedly—catching misconfigurations before they
affect email deliverability or security.

**Monitoring Includes:**
- DNS record changes (A, MX, TXT, CNAME)
- SPF record validity and alignment
- DKIM key presence and rotation tracking
- DMARC policy compliance
- DNSSEC status
- Certificate transparency logs
