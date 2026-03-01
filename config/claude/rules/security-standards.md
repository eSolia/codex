# Security Standards Rule

All eSolia code must follow OWASP Top 10 and ISO 27001 security standards.

## OWASP Top 10 Checklist

| ID | Category | Requirement |
|----|----------|-------------|
| A01 | Access Control | Validate authorization, least privilege |
| A02 | Crypto Failures | Strong encryption, secure key management |
| A03 | Injection | Parameterized queries, input sanitization |
| A04 | Insecure Design | Security-first architecture |
| A05 | Misconfiguration | Secure defaults, proper error handling |
| A06 | Vulnerable Components | Dependency auditing |
| A07 | Auth Failures | Strong authentication mechanisms |
| A08 | Data Integrity | Validate processing operations |
| A09 | Logging Failures | Log security events, no sensitive data in logs |
| A10 | SSRF | Validate external requests |

## InfoSec Comments

Add `InfoSec:` comments for changes to:
- Input validation / sanitization
- Authentication / authorization
- Cryptographic operations
- Error handling
- Dependency updates
- Rate limiting / DoS protection
- Security headers / CORS
- Logging modifications

## Commit Format

Security-relevant commits must include:
```
type(scope): description

InfoSec: [security impact/consideration]
```
