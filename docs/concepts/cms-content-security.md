# CMS Content Security Guide

Protecting sensitive content from unauthorized access and leakage in a SvelteKit + Cloudflare CMS.

## Threat Model

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT LEAK VECTORS                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pre-Authentication                                             │
│  ├── URL guessing (/blog/secret-acquisition)                   │
│  ├── Preview token brute force                                 │
│  ├── Search engine indexing preview URLs                       │
│  └── Cached responses at edge                                  │
│                                                                 │
│  Post-Authentication                                            │
│  ├── Authorized user shares preview link inappropriately       │
│  ├── Browser history / bookmarks on shared computer            │
│  ├── Screenshot / copy-paste (human factor)                    │
│  └── API responses logged or cached client-side                │
│                                                                 │
│  Infrastructure                                                 │
│  ├── D1 database access (direct query)                         │
│  ├── R2 media files accessible before publish                  │
│  ├── Backup/export containing drafts                           │
│  └── Logs containing preview content                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Defense in Depth

### Layer 1: Content Classification

Classify content at creation time:

```typescript
type SensitivityLevel = 'normal' | 'confidential' | 'embargoed';

interface Document {
  // ... existing fields
  sensitivity: SensitivityLevel;
  embargo_until?: number;           // Unix timestamp
  approved_for_preview: boolean;
  approved_by?: string;
  approved_at?: number;
}
```

```sql
ALTER TABLE documents ADD COLUMN sensitivity TEXT DEFAULT 'normal';
ALTER TABLE documents ADD COLUMN embargo_until INTEGER;
ALTER TABLE documents ADD COLUMN approved_for_preview INTEGER DEFAULT 0;
ALTER TABLE documents ADD COLUMN approved_by TEXT;
ALTER TABLE documents ADD COLUMN approved_at INTEGER;
```

### Layer 2: Gated Preview Generation

```
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW APPROVAL WORKFLOW                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Normal Content                                                 │
│  Author → Save Draft → Generate Preview ✓                      │
│                                                                 │
│  Confidential Content                                           │
│  Author → Save Draft → Request Preview → Approver → Generate ✓ │
│                                                                 │
│  Embargoed Content                                              │
│  Author → Save Draft → ✗ No preview until embargo lifts        │
│                        (or explicit override)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```typescript
async createPreviewLink(
  collection: string, 
  slug: string, 
  requestedBy: string,
  options: { expiresIn?: number; maxViews?: number; ipRestrict?: string[] } = {}
) {
  const doc = await this.getDocument(collection, slug);
  
  // Gate by sensitivity
  if (doc.sensitivity === 'embargoed') {
    if (doc.embargo_until && Date.now() / 1000 < doc.embargo_until) {
      throw new Error('Content under embargo. Preview not available.');
    }
  }
  
  if (doc.sensitivity === 'confidential' && !doc.approved_for_preview) {
    throw new Error('Confidential content requires approval before preview sharing.');
  }
  
  const token = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + (options.expiresIn || 24 * 60 * 60);
  
  await db.prepare(`
    UPDATE documents SET
      preview_token = ?,
      preview_expires = ?,
      preview_max_views = ?,
      preview_view_count = 0,
      preview_ip_allowlist = ?,
      preview_created_by = ?,
      preview_created_at = ?
    WHERE collection = ? AND slug = ?
  `).bind(
    token,
    expires,
    options.maxViews || null,
    options.ipRestrict ? JSON.stringify(options.ipRestrict) : null,
    requestedBy,
    Math.floor(Date.now() / 1000),
    collection,
    slug
  ).run();
  
  // Audit log
  await this.auditLog('preview_created', { collection, slug, requestedBy, expires });
  
  return { token, expires };
}
```

### Layer 3: Preview Token Hardening

```typescript
async validatePreviewToken(token: string, clientIP: string) {
  const doc = await db.prepare(`
    SELECT 
      content, preview_expires, preview_max_views, 
      preview_view_count, preview_ip_allowlist, sensitivity
    FROM documents 
    WHERE preview_token = ?
  `).bind(token).first();
  
  if (!doc) {
    return { valid: false, reason: 'invalid_token' };
  }
  
  if (doc.preview_expires < Date.now() / 1000) {
    return { valid: false, reason: 'expired' };
  }
  
  if (doc.preview_max_views && doc.preview_view_count >= doc.preview_max_views) {
    return { valid: false, reason: 'max_views_exceeded' };
  }
  
  if (doc.preview_ip_allowlist) {
    const allowed = JSON.parse(doc.preview_ip_allowlist);
    if (!allowed.includes(clientIP)) {
      await this.auditLog('preview_ip_rejected', { token, clientIP, allowed });
      return { valid: false, reason: 'ip_not_allowed' };
    }
  }
  
  return { 
    valid: true, 
    content: JSON.parse(doc.content),
    expires: doc.preview_expires,
    sensitivity: doc.sensitivity
  };
}
```

### Layer 4: Encryption at Rest

For highly sensitive content, encrypt before storing:

```typescript
// lib/server/encryption.ts
export async function encryptContent(
  content: string, 
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(content);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

export async function decryptContent(
  encrypted: string, 
  iv: string, 
  key: CryptoKey
): Promise<string> {
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    encryptedBytes
  );
  
  return new TextDecoder().decode(decrypted);
}
```

### Layer 5: Response Headers & Cache Prevention

```typescript
// routes/preview/[token]/+page.server.ts
export async function load({ params, platform, setHeaders }) {
  // ... validation logic
  
  setHeaders({
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
  });
  
  return { content, isPreview: true };
}
```

### Layer 6: Comprehensive Audit Logging

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT
);

CREATE INDEX idx_timestamp ON audit_log(timestamp);
CREATE INDEX idx_actor ON audit_log(actor);
CREATE INDEX idx_resource ON audit_log(resource_type, resource_id);
```

**Actions to log:**

| Action | When | Details |
|--------|------|---------|
| `document_created` | New draft | Author, sensitivity |
| `document_updated` | Any edit | Editor, fields changed |
| `sensitivity_changed` | Escalation | Old → New, who changed |
| `preview_requested` | Request to share | Requester |
| `preview_approved` | Approval granted | Approver |
| `preview_created` | Token generated | Creator, expiry, restrictions |
| `preview_viewed` | Token used | IP, user agent |
| `preview_rejected` | Invalid access | Reason, IP |
| `document_published` | Goes live | Publisher |

## Security Levels Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT SECURITY MATRIX                                        │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│               │ Normal        │ Confidential  │ Embargoed       │
├───────────────┼───────────────┼───────────────┼─────────────────┤
│ Storage       │ Plaintext     │ Encrypted     │ Encrypted       │
│ Editor access │ Any editor    │ Assigned only │ Assigned only   │
│ Preview auth  │ CF Access     │ CF Access     │ CF Access       │
│ Share preview │ Immediate     │ After approval│ After embargo   │
│ Token expiry  │ 7 days        │ 24 hours      │ 4 hours         │
│ Max views     │ Unlimited     │ 10            │ 3               │
│ IP restrict   │ Optional      │ Recommended   │ Required        │
│ Audit level   │ Standard      │ Detailed      │ Full + alerts   │
│ Media access  │ Signed URL    │ Proxy only    │ Proxy only      │
└───────────────┴───────────────┴───────────────┴─────────────────┘
```

---

## Screenshot Deterrence

### The Hard Truth

```
┌─────────────────────────────────────────────────────────────────┐
│  FUNDAMENTAL LIMITATION                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  If photons hit a human retina, the information has escaped.   │
│                                                                 │
│  Phone camera → defeats all technical measures                 │
│  External capture card → defeats all technical measures        │
│  VM screenshot from host → defeats all technical measures      │
│                                                                 │
│  The goal isn't prevention—it's friction + traceability.       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Available Techniques

| Approach | Prevents Screenshot? | Deters Attempt? | Enables Forensics? | Effort |
|----------|---------------------|-----------------|-------------------|--------|
| Keyboard detection | ❌ | ✅ Somewhat | ✅ Logs attempt | Low |
| Blur on unfocus | ❌ | ✅ Somewhat | ❌ | Low |
| Canvas rendering | ❌ | ❌ | ❌ | Medium |
| Visible watermark | ❌ | ✅ Yes | ✅ Identifies leaker | Low |
| Forensic marking | ❌ | ❌ | ✅ Survives compression | Medium |
| Awareness indicators | ❌ | ✅ Strong | ✅ Psychological | Low |
| Native app DRM | ✅ Mostly | ✅ Yes | ✅ Full control | High |

### Implementation: Screenshot Shield Component

```svelte
<!-- ScreenshotShield.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  let { children, viewerEmail, sensitivity = 'normal' } = $props();
  
  let shieldActive = $state(false);
  let warningMessage = $state('');
  
  onMount(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const isScreenshotAttempt = 
        (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(e.key)) ||
        e.key === 'PrintScreen';
      
      if (isScreenshotAttempt && sensitivity !== 'normal') {
        activateShield('Screenshot attempt detected');
      }
    };
    
    const handleVisibility = () => {
      if (document.hidden && sensitivity === 'embargoed') {
        activateShield('Content hidden—tab not in focus');
      } else {
        deactivateShield();
      }
    };
    
    const handleBlur = () => {
      if (sensitivity === 'embargoed') {
        activateShield('Window lost focus');
        setTimeout(deactivateShield, 2000);
      }
    };
    
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  });
  
  function activateShield(message: string) {
    shieldActive = true;
    warningMessage = message;
    logSecurityEvent('shield_activated', { message, viewerEmail });
  }
  
  function deactivateShield() {
    shieldActive = false;
    warningMessage = '';
  }
  
  async function logSecurityEvent(event: string, details: object) {
    await fetch('/api/audit', {
      method: 'POST',
      body: JSON.stringify({ event, details, timestamp: Date.now() })
    });
  }
</script>

<div class="shield-container">
  <!-- Always-visible watermark -->
  <div class="watermark" aria-hidden="true">
    {viewerEmail} • CONFIDENTIAL
  </div>
  
  <!-- Content -->
  <div class="content">
    {@render children()}
  </div>
  
  <!-- Overlay on suspected capture -->
  {#if shieldActive}
    <div class="capture-shield">
      <div class="shield-content">
        <svg class="shield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p class="shield-message">{warningMessage}</p>
        <p class="shield-warning">This viewing session is logged</p>
        <p class="shield-identity">{viewerEmail}</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .shield-container {
    position: relative;
  }
  
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-size: 2.5rem;
    color: rgba(0, 0, 0, 0.04);
    white-space: nowrap;
    pointer-events: none;
    z-index: 100;
    user-select: none;
    font-family: monospace;
  }
  
  .capture-shield {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: shield-appear 0.1s ease-out;
  }
  
  @keyframes shield-appear {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .shield-content {
    text-align: center;
    color: white;
  }
  
  .shield-icon {
    width: 64px;
    height: 64px;
    margin-bottom: 1rem;
    stroke: #ef4444;
  }
  
  .shield-message {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  
  .shield-warning {
    color: #fbbf24;
  }
  
  .shield-identity {
    margin-top: 1rem;
    font-family: monospace;
    color: #6b7280;
  }
</style>
```

### Forensic Watermarking

Multiple watermark layers for redundancy and traceability:

```svelte
<!-- ForensicWatermark.svelte -->
<script lang="ts">
  let { viewerEmail, documentId, viewTimestamp } = $props();
  
  const fingerprint = btoa(`${viewerEmail}|${documentId}|${viewTimestamp}`).slice(0, 20);
  
  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
</script>

<div class="forensic-watermarks">
  <!-- Visible watermark -->
  <div class="watermark visible">
    {viewerEmail} • {new Date(viewTimestamp).toISOString().slice(0, 16)}
  </div>
  
  <!-- Semi-visible pattern -->
  <div class="watermark pattern">
    {#each Array(20) as _, i}
      <span style="left: {(i * 5) + 2}%; top: {((i * 7) % 100)}%">
        {fingerprint}
      </span>
    {/each}
  </div>
  
  <!-- Steganographic dots (survives JPEG compression) -->
  <svg class="watermark dots" viewBox="0 0 1000 1000">
    {#each Array(50) as _, i}
      {@const x = (hashCode(fingerprint + i) % 900) + 50}
      {@const y = (hashCode(fingerprint + i + 'y') % 900) + 50}
      <circle cx={x} cy={y} r="1.5" fill="rgba(0,0,0,0.015)" />
    {/each}
  </svg>
</div>

<style>
  .forensic-watermarks {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9998;
  }
  
  .watermark.visible {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 1.5rem;
    color: rgba(0, 0, 0, 0.07);
    white-space: nowrap;
    font-family: monospace;
  }
  
  .watermark.pattern {
    position: absolute;
    inset: 0;
  }
  
  .watermark.pattern span {
    position: absolute;
    font-size: 0.6rem;
    color: rgba(0, 0, 0, 0.02);
    font-family: monospace;
    transform: rotate(-45deg);
  }
  
  .watermark.dots {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
</style>
```

### Psychological Deterrent: Awareness Indicators

The most effective deterrent makes viewers **feel watched**:

```svelte
<!-- ViewerAwarenessIndicators.svelte -->
<script>
  let { viewerEmail, sensitivity } = $props();
  let viewStartTime = Date.now();
  let elapsed = $state(0);
  
  $effect(() => {
    const interval = setInterval(() => {
      elapsed = Math.floor((Date.now() - viewStartTime) / 1000);
    }, 1000);
    return () => clearInterval(interval);
  });
</script>

{#if sensitivity !== 'normal'}
  <div class="awareness-bar">
    <div class="viewer-info">
      <span class="recording-dot"></span>
      Viewing as: <strong>{viewerEmail}</strong>
    </div>
    <div class="session-info">
      Session logged • {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
    </div>
  </div>
{/if}

<style>
  .awareness-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #1f2937;
    color: white;
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    z-index: 9999;
  }
  
  .recording-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    margin-right: 0.5rem;
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
```

### Security Configuration by Level

```typescript
// lib/server/security-config.ts
export const securityLevels = {
  normal: {
    watermark: false,
    shortcutDetection: false,
    blurOnUnfocus: false,
    forensicMarking: false,
    viewAgreement: false,
    maxViewDuration: null,
    alertOnView: false,
  },
  confidential: {
    watermark: true,
    shortcutDetection: true,
    blurOnUnfocus: false,
    forensicMarking: true,
    viewAgreement: false,
    maxViewDuration: 30 * 60 * 1000, // 30 minutes
    alertOnView: false,
  },
  embargoed: {
    watermark: true,
    shortcutDetection: true,
    blurOnUnfocus: true,
    forensicMarking: true,
    viewAgreement: true,
    maxViewDuration: 10 * 60 * 1000, // 10 minutes
    alertOnView: true,
  }
} as const;
```

### What You Cannot Prevent

Be honest about limitations:

```
┌─────────────────────────────────────────────────────────────────┐
│  HUMAN FACTOR RISKS (Technical controls can't solve)           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  • Screenshot and share via other channel                      │
│  • Read aloud on phone call                                    │
│  • Copy-paste to email/Slack                                   │
│  • Authorized user becomes malicious insider                   │
│                                                                 │
│  Mitigations (policy, not technical):                          │
│  • Visible watermarks with viewer identity                     │
│  • Confidentiality agreements                                  │
│  • Audit trail + consequences                                  │
│  • Need-to-know access lists                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Alternative Viewing Modes (Maximum Security)

For truly high-stakes content:

| Mode | Description | Use Case |
|------|-------------|----------|
| Read-in-room | Physical controlled environment, no devices | M&A, earnings pre-release |
| Native app | iOS/Android with FLAG_SECURE / UIScreen.captured | Financial apps, medical records |
| Screen share only | Host controls view, no local copy | Board presentations, legal reviews |

## Practical Shield System

```
┌─────────────────────────────────────────────────────────────────┐
│  PRACTICAL SCREENSHOT SHIELD SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Normal Content                                                 │
│  └── No protection                                             │
│                                                                 │
│  Confidential Content                                           │
│  ├── Visible watermark with viewer email + timestamp           │
│  ├── Keyboard shortcut detection → warning modal               │
│  ├── Right-click disabled                                      │
│  └── Audit log of all views                                    │
│                                                                 │
│  Embargoed Content                                              │
│  ├── All confidential measures, plus:                          │
│  ├── Blur on window/tab unfocus                                │
│  ├── Forensic watermark pattern                                │
│  ├── View session time limits                                  │
│  ├── No-record agreement checkbox before viewing               │
│  └── Real-time alerts to content owner on view                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Recommendation

Combine **visible watermarks** + **awareness indicators** + **forensic marking** + **keyboard detection**.

It won't stop a determined attacker, but it:

1. Makes casual leaking uncomfortable
2. Provides psychological deterrent ("I'm being watched")
3. Creates forensic trail if leaks occur
4. Enables accountability

The little red recording dot and visible timer does more to deter casual screenshots than any technical measure.

---

*Document version: 1.0*
