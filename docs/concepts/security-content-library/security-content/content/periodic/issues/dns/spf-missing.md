---
id: spf-missing
category: issue
subcategory: dns/email-authentication
severity: high
record_type: TXT
keywords:
  - spf
  - sender policy framework
  - email authentication
  - email spoofing
  - phishing
  - dns txt record
related_issues:
  - spf-too-permissive
  - spf-lookup-limit-exceeded
  - dmarc-missing
related_concepts:
  - what-is-spf
  - how-email-authentication-works
products:
  - periodic
  - quiz
last_updated: 2025-01-15
---

# SPF Record Missing

## Summary

Your domain has no SPF (Sender Policy Framework) record. Without SPF, anyone can send email that appears to come from your domain, making your organization vulnerable to email spoofing and phishing attacks.

## Why This Matters

Think of SPF as a guest list for your email. Without it, there's no way for receiving mail servers to verify that an email claiming to be from your domain actually came from an authorized source.

**Real-world impact:**

- Attackers can send convincing phishing emails "from" your CEO to employees
- Your domain can be used in business email compromise (BEC) attacks
- Partner organizations may reject or quarantine your legitimate emails
- Your domain's reputation score degrades over time

**By the numbers:**

- 91% of cyberattacks start with a phishing email
- BEC attacks cost organizations $2.7 billion in 2022 (FBI IC3)
- Domains without SPF are 5x more likely to be used in spoofing attacks

## What We Found

We queried your domain's DNS records and found no SPF record:

```bash
$ dig TXT yourdomain.com +short | grep spf
# (no results)
```

This means any mail server in the world can send email claiming to be from `@yourdomain.com` with no way for recipients to detect the forgery.

## How to Fix This

### Quick Fix (Basic Protection)

Add a TXT record to your domain's DNS with a basic SPF policy:

```
v=spf1 -all
```

This says "no servers are authorized to send email for this domain"—use this only if you genuinely don't send email from this domain.

### Recommended Configuration

If you use email services, include them in your SPF record:

**Google Workspace:**
```
v=spf1 include:_spf.google.com ~all
```

**Microsoft 365:**
```
v=spf1 include:spf.protection.outlook.com ~all
```

**Multiple services:**
```
v=spf1 include:_spf.google.com include:mailchimp.com ip4:203.0.113.5 ~all
```

### Understanding the Syntax

| Part | Meaning |
|------|---------|
| `v=spf1` | SPF version (always v=spf1) |
| `include:` | Trust another domain's authorized senders |
| `ip4:` | Trust a specific IP address or range |
| `~all` | Soft-fail unauthorized senders (mark as suspicious) |
| `-all` | Hard-fail unauthorized senders (reject) |

## Verification

After adding your SPF record, verify it's working:

1. **Wait for DNS propagation** (typically 5-30 minutes)

2. **Check the record exists:**
   ```bash
   dig TXT yourdomain.com +short | grep spf
   ```

3. **Use an SPF validator:**
   - [MXToolbox SPF Checker](https://mxtoolbox.com/spf.aspx)
   - [Google Admin Toolbox](https://toolbox.googleapps.com/apps/checkmx/)

4. **Send a test email** to a Gmail account and check the headers for `spf=pass`

## Learn More

- [What is SPF?](/concepts/what-is-spf) — Detailed explanation of how SPF works
- [How Email Authentication Works](/concepts/how-email-authentication-works) — SPF, DKIM, and DMARC together
- [SPF Lookup Limit Exceeded](/issues/spf-lookup-limit-exceeded) — Common problem when adding too many includes
