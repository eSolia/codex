# Maileroo Email Integration

Implementation guide for transactional email using Maileroo API.

## Overview

Maileroo is the primary email service for eSolia Periodic, handling all transactional emails including authentication, alerts, and notifications. This guide covers the implementation patterns used.

## Configuration

### Environment Variables

```bash
MAILEROO_API_KEY=your_sending_key
MAILEROO_FROM_EMAIL=noreply@your-domain.com
MAILEROO_FROM_NAME="Your App Name"
EMAIL_SERVICE=maileroo  # Optional, auto-detected if MAILEROO_API_KEY is set
```

### Type Configuration

```typescript
// In types.ts
interface Config {
  emailService?: 'postmark' | 'resend' | 'sendgrid' | 'maileroo';
  mailerooApiKey?: string;
  mailerooFromEmail?: string;
  mailerooFromName?: string;
  // ... other config
}
```

## Core Implementation

### File Structure

```
src/integrations/
├── maileroo.ts       # Maileroo API wrapper and email templates
├── postmark.ts       # Legacy: Postmark integration
└── resend.ts         # Legacy: Resend integration
```

### Base Email Function

```typescript
// src/integrations/maileroo.ts

/**
 * Maileroo email object
 */
export interface MailerooEmailObject {
  address: string;
  display_name?: string;
}

/**
 * Maileroo email request
 */
export interface MailerooEmail {
  from: MailerooEmailObject;
  to: MailerooEmailObject | MailerooEmailObject[];
  subject: string;
  html?: string;
  plain?: string;
  cc?: MailerooEmailObject[];
  bcc?: MailerooEmailObject[];
  reply_to?: MailerooEmailObject;
  tags?: string[];
  headers?: Record<string, string>;
  tracking?: {
    clicks?: boolean;
    opens?: boolean;
  };
  reference_id?: string;
}

/**
 * Send email via Maileroo
 */
export async function sendMailerooEmail(
  apiKey: string,
  email: MailerooEmail
): Promise<MailerooResponse> {
  const response = await fetch('https://smtp.maileroo.com/api/v2/emails', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(email),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Maileroo API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return await response.json();
}
```

## Email Template Pattern

### Standard Header (with Logo)

All emails use a consistent header with the company logo. Use PNG format for email compatibility (SVG doesn't work in Outlook).

```html
<div
  style="background: #2D2F63; color: white; padding: 20px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;"
>
  <div>
    <h1 style="margin: 0; font-size: 24px;">Email Title</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">eSolia Periodic</p>
  </div>
  <img
    src="https://your-domain.com/static/images/logo_white.png"
    alt="Logo"
    style="width: 50px; height: 50px;"
  />
</div>
```

### Standard Footer

```html
<div
  style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #666;"
>
  <p style="margin: 0;">This automated email was sent by <strong>Your App Name</strong></p>
</div>
```

### Email Font Stack

Web fonts aren't reliable in email. Use system fonts:

```css
/* English */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;

/* Japanese */
font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Yu Gothic', sans-serif;
```

## Email Types Implemented

### 1. Magic Link Authentication

```typescript
export async function sendMagicLink(
  apiKey: string,
  to: string,
  from: string,
  fromName: string,
  loginUrl: string,
  expiresInMinutes: number = 15
): Promise<MailerooResponse> {
  const subject = 'Your Login Link for eSolia Periodic';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>...</head>
    <body style="...">
      <!-- Header with logo -->
      <div style="background: #2D2F63; ...">
        <div>
          <h1>Login to eSolia Periodic</h1>
          <p>DNS & Email Monitoring</p>
        </div>
        <img src="..." />
      </div>

      <!-- Content -->
      <div style="background: white; padding: 30px; ...">
        <p>Click the button below to securely log in:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background: #2D2F63; color: white; padding: 14px 32px; ...">
            Log In
          </a>
        </div>

        <!-- Expiration warning -->
        <div style="background: #fff3cd; ...">
          <p><strong>⏱️ This link expires in ${expiresInMinutes} minutes</strong></p>
        </div>

        <!-- Direct link fallback -->
        <div style="background: #f8f9fa; ...">
          <p>Direct Link (copy if button doesn't work):</p>
          <p style="font-family: monospace;">${loginUrl}</p>
        </div>
      </div>

      <!-- Footer -->
    </body>
    </html>
  `;

  return await sendMailerooEmail(apiKey, {
    from: { address: from, display_name: fromName },
    to: { address: to },
    subject,
    html: htmlBody,
    tags: ['magic-link', 'authentication'],
  });
}
```

### 2. Email Change Flow (3 emails)

Email changes send multiple emails for security:

1. **Verification Email** → New email address (confirm ownership)
2. **Notification Email** → Old email address (security awareness)
3. **Confirmation Email** → Old email address (change completed)

```typescript
// 1. Verification to NEW email
export async function sendEmailChangeVerification(
  apiKey: string,
  to: string, // NEW email
  from: string,
  fromName: string,
  verificationUrl: string,
  oldEmail: string,
  lang: 'en' | 'ja' = 'en'
): Promise<MailerooResponse> {
  // InfoSec: Verification email to new address confirms ownership
  // ...
}

// 2. Notification to OLD email
export async function sendEmailChangeNotification(
  apiKey: string,
  to: string, // OLD email
  from: string,
  fromName: string,
  newEmail: string,
  lang: 'en' | 'ja' = 'en'
): Promise<MailerooResponse> {
  // InfoSec: Notifies current email of change request for awareness
  // ...
}

// 3. Confirmation to OLD email (after verification complete)
export async function sendEmailChangeConfirmation(
  apiKey: string,
  to: string, // OLD email
  from: string,
  fromName: string,
  newEmail: string,
  lang: 'en' | 'ja' = 'en'
): Promise<MailerooResponse> {
  // InfoSec: Confirms to old email that change was completed
  // ...
}
```

### 3. DNS Alerts

```typescript
export async function sendDNSAlert(
  apiKey: string,
  to: string,
  from: string,
  fromName: string,
  domain: string,
  recordType: string,
  alertType: 'unauthorized' | 'propagating' | 'error',
  details: string
): Promise<MailerooResponse> {
  const subject = `[DNS Alert] ${alertType.toUpperCase()}: ${domain} (${recordType})`;

  // Color-coded alert box based on type
  // Details in monospace pre-formatted block
  // ...
}
```

### 4. Authorization Request (Dual Authorization)

```typescript
export async function sendAuthorizationRequest(
  apiKey: string,
  to: string,
  from: string,
  fromName: string,
  domain: string,
  recordType: string,
  oldValue: string,
  newValue: string,
  confirmationUrl: string
): Promise<MailerooResponse> {
  // Shows old vs new values with visual diff
  // Big green "Authorize This Change" button
  // Warning: "If you did not expect this change, do not click"
  // ...
}
```

### 5. Domain Test Results (Lead Capture)

```typescript
export async function sendDomainTestResults(
  apiKey: string,
  to: string,
  from: string,
  fromName: string,
  testLog: DomainTestLog
): Promise<MailerooResponse> {
  const lang = testLog.language;

  // Simplified results: just status icons
  // ✅ SPF  ❌ DMARC  ⚠️ DKIM

  // "Need Help?" section promotes the service
  // ...
}
```

## Bilingual Support

All email functions support English and Japanese:

```typescript
export async function sendSomeEmail(
  // ... other params
  lang: "en" | "ja" = "en",
): Promise<MailerooResponse> {
  const isJa = lang === "ja";

  const subject = isJa
    ? "[eSolia] 日本語の件名"
    : "[eSolia] English Subject";

  const htmlBody = isJa
    ? generateJapaneseEmail(...)
    : generateEnglishEmail(...);

  const plainBody = isJa
    ? generateJapanesePlainText(...)
    : generateEnglishPlainText(...);

  return await sendMailerooEmail(apiKey, {
    from: { address: from, display_name: fromName },
    to: { address: to },
    subject,
    html: htmlBody,
    plain: plainBody,  // Always include plain text
    tags: ["email-type", "bilingual"],
  });
}
```

### Language Selection Logic

The system uses different language sources depending on email context:

| Email Type            | Trigger              | Language Source                                 |
| --------------------- | -------------------- | ----------------------------------------------- |
| Magic Link            | User clicks login    | Page language (`?lang=ja`)                      |
| Email Change          | User changes email   | Page language (via `detectLanguage(request)`)   |
| Domain Test Results   | User submits test    | Stored in `testLog.language` at submission time |
| DNS Alerts            | Background cron job  | Client's `notifications.language` setting       |
| Authorization Request | Background detection | Client's `notifications.language` setting       |

**Implementation Pattern:**

```typescript
// Page-triggered emails: Extract from current URL
const url = new URL(request.url);
const pageLang = (url.searchParams.get('lang') as 'en' | 'ja') || 'en';
await sendMagicLinkEmail(config, email, loginUrl, 60, pageLang);

// Background jobs: Look up client preference
const client = await kvGet<Client>(kv, ['clients', checkConfig.clientId]);
const alertLang = client?.notifications?.language || 'en';
await sendDNSCheckAlert(config, checkConfig, checkState, alertLang);
```

**Key principle:**

- If the user is actively on a page, use the page's language
- If it's a background process, use the stored preference from client settings

## Service Selection Logic

The system auto-detects which email service to use:

```typescript
// In sendMagicLinkEmail or any email-sending function:

// Prefer Maileroo if configured
if (
  config.emailService === "maileroo" ||
  (config.mailerooApiKey && config.mailerooFromEmail)
) {
  if (!config.mailerooApiKey) {
    throw new Error("MAILEROO_API_KEY not configured");
  }
  await maileroo.sendMagicLink(
    config.mailerooApiKey,
    email,
    config.mailerooFromEmail || config.adminEmail,
    config.mailerooFromName || "eSolia Periodic",
    loginUrl,
    expiresInMinutes,
  );
  return;
}

// Fall back to legacy services
const apiKey = getEmailApiKey(config);
if (config.emailService === "resend") {
  await resend.sendMagicLink(...);
} else {
  await postmark.sendMagicLink(...);
}
```

## Tracking and Tags

Use tags for filtering in Maileroo dashboard:

```typescript
return await sendMailerooEmail(apiKey, {
  // ...
  tags: ['magic-link', 'authentication'], // or ["dns-alert", "unauthorized"]
  tracking: { opens: true, clicks: true }, // For lead capture emails
});
```

## Error Handling

```typescript
try {
  await maileroo.sendMagicLink(...);
  console.log(`🔑 Magic link sent via Maileroo to ${email}`);
} catch (error) {
  console.error("❌ Failed to send magic link:", error);
  throw error;  // Re-throw to let caller handle
}
```

## Logo Requirements

1. **Use PNG format** - SVG is not supported by Outlook
2. **Host at absolute URLs** - Relative paths don't work in email
3. **Store in `/static/images/`** - Served at `/static/images/`
4. **White logo on dark header** - `symbol_white_bgtransparent_web.png`

## Testing

Test emails locally:

1. Set `MAILEROO_API_KEY` in `.env`
2. Use `deno task dev` to start server
3. Test each email type:
   - Magic link: Login page → request magic link
   - DNS Alert: Admin portal → Test Notification button
   - Email change: Settings → Change email
   - Domain test: Landing page → Test a domain

## References

- [Maileroo API Docs](https://maileroo.com/docs/email-api/send-basic-email/)
- Email templates: `src/integrations/maileroo.ts`
- Service selection: `src/auth/magic-link.ts`, `src/notifications/dns-alerts.ts`
