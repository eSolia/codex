# Cloudflare Media Services: Images & Stream

A practical guide to creative use cases for Cloudflare's media services, with emphasis on integration patterns for security-focused SaaS products.

---

## Overview

Cloudflare's media services handle the infrastructure-heavy parts of working with images and video—storage, encoding, global delivery, and transformations—so you can focus on the application logic. Think of them as a **Swiss Army knife for pixels and frames**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloudflare Media Stack                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐              ┌─────────────────┐           │
│  │   IMAGES        │              │   STREAM        │           │
│  ├─────────────────┤              ├─────────────────┤           │
│  │ • Storage       │              │ • Video hosting │           │
│  │ • Transforms    │              │ • Live streams  │           │
│  │ • Overlays      │              │ • Clipping      │           │
│  │ • Format auto   │              │ • Signed URLs   │           │
│  │ • Direct upload │              │ • Captions      │           │
│  └────────┬────────┘              └────────┬────────┘           │
│           │                                │                    │
│           └────────────┬───────────────────┘                    │
│                        │                                        │
│                        ▼                                        │
│           ┌─────────────────────────┐                           │
│           │   Workers Integration   │                           │
│           │   (Custom logic layer)  │                           │
│           └─────────────────────────┘                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cloudflare Images

### Capabilities at a Glance

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Storage** | Store images on Cloudflare's edge | Central image repository |
| **Transformations** | Resize, crop, format conversion on-the-fly | Responsive images, thumbnails |
| **Direct Creator Upload** | One-time URLs for user uploads | UGC without backend complexity |
| **Draw Overlays** | Watermarks, logos, compositing | Dynamic branding |
| **Format Auto-negotiation** | Serves WebP/AVIF based on browser | Automatic optimization |
| **Signed URLs** | Time-limited private access | Protected assets |
| **Custom URL Schemes** | Hide origin, add logic via Workers | Smart routing, access control |

### Pricing Model

- **Free tier**: Transformations on external images (limited)
- **Paid tier**: Storage + delivery + transformations
- **Key insight**: Unique transformations billed once per 30 days, then cached

### Supported Formats

**Input**: JPEG, PNG, GIF (animated), WebP (animated), SVG, HEIC

**Output**: JPEG, PNG, GIF (animated), WebP (animated), SVG, AVIF

---

## Cloudflare Stream

### Capabilities at a Glance

| Feature | Description | Use Case |
|---------|-------------|----------|
| **Video Hosting** | Upload, encode, store, deliver | On-demand video |
| **Live Streaming** | RTMP/SRT/WebRTC ingest | Webinars, live events |
| **Signed URLs** | Time/geo/IP-limited access | Paywall, training, geo-fencing |
| **Direct Creator Uploads** | Users upload video directly | UGC platforms |
| **Clipping** | Extract segments from videos | Highlight reels, modular content |
| **Captions/Subtitles** | VTT/SRT support | Accessibility, multi-language |
| **Watermarks** | Brand every frame | Anti-piracy, branding |
| **Thumbnails** | Auto-generated at any timestamp | Video catalogs |
| **Analytics** | Per-video, per-creator metrics | Engagement tracking |
| **Player API** | Control playback programmatically | Custom experiences |

### Supported Input Formats

MP4, MKV, MOV, AVI, FLV, MPEG-2 TS, MPEG-2 PS, MXF, LXF, GXF, 3GP, WebM, MPG, QuickTime

### Limitations

- 30GB maximum file size per upload
- HDR content is re-encoded to SDR for compatibility
- Frame rates above 70 FPS are re-encoded to 70 FPS

---

## Creative Use Cases

### 1. Dynamic Branded Thumbnails

Generate custom thumbnails on-the-fly by compositing base images with client-specific overlays.

```
┌─────────────────────────────────────────────────────────┐
│  Base Template (stored in R2)                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │                                                   │  │
│  │   [Client Logo Overlay]     [Security Badge]     │  │
│  │                                                   │  │
│  │        "Security Proposal for {ClientName}"      │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
            │
            ▼ Worker transforms on request
            
https://proposals.example.com/cover/acme-corp
  → Fetches base template from R2
  → Draws client logo overlay
  → Returns branded cover image
```

**Worker Implementation:**

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const clientSlug = url.pathname.split('/').pop();
    
    const client = await env.D1.prepare(
      "SELECT logo_url, name FROM clients WHERE slug = ?"
    ).bind(clientSlug).first();
    
    return fetch(`${env.R2_URL}/templates/proposal-cover.png`, {
      cf: {
        image: {
          width: 1200,
          height: 630,
          draw: [
            {
              url: client.logo_url,
              top: 40,
              left: 40,
              width: 200
            }
          ]
        }
      }
    });
  }
};
```

**Benefits:**
- No need to pre-generate hundreds of branded images
- Generate once, transform dynamically
- Cache at edge for repeat requests

---

### 2. Educational Diagrams with Content States

Serve diagrams with different presentations based on content status (draft vs published).

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const diagramId = url.pathname.split('/')[2];
    
    const metadata = await env.D1.prepare(
      "SELECT status FROM diagrams WHERE id = ?"
    ).bind(diagramId).first();
    
    const transformOptions = {
      width: 1200,
      format: 'auto',
    };
    
    // Add draft watermark for unpublished content
    if (metadata?.status === 'draft') {
      transformOptions.draw = [{
        url: `${env.ASSETS_URL}/draft-watermark.png`,
        opacity: 0.3,
        repeat: true
      }];
    }
    
    return fetch(`${env.R2_URL}/diagrams/${diagramId}.svg`, {
      cf: { image: transformOptions }
    });
  }
};
```

**Integration with Content-as-Code:**

```
security-content/
├── content/
│   └── diagrams/
│       ├── spf-flow.svg
│       └── zero-trust-architecture.svg
│
└── ci/
    └── deploy.ts  ──── Syncs to R2 on merge
```

---

### 3. User-Uploaded Evidence for Compliance

Allow clients to upload screenshots as evidence of control implementation with automatic tenant isolation and watermarking.

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Client uploads   │────▶│ Direct Creator  │────▶│ Stored with      │
│ MFA screenshot   │     │ Upload URL      │     │ tenant isolation │
└──────────────────┘     └─────────────────┘     └──────────────────┘
                                                          │
                         ┌────────────────────────────────┘
                         ▼
              ┌──────────────────────────────────────┐
              │ Served with:                         │
              │ • Auto-format (WebP/AVIF)            │
              │ • Signed URL (time-limited access)   │
              │ • Audit watermark overlay            │
              └──────────────────────────────────────┘
```

**Implementation Pattern:**

1. Generate one-time upload URL scoped to tenant:
   ```javascript
   const uploadUrl = await generateDirectCreatorUpload({
     customId: `tenant-${tenantId}/evidence/${controlId}/${timestamp}`,
     expiry: 300 // 5 minutes to complete upload
   });
   ```

2. On retrieval, apply signed URLs + automatic watermarking
3. Store with custom path structure for tenant isolation

---

### 4. Gated Training Videos with Progress Tracking

Implement a training module system with video access control and completion tracking.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Training Module Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User starts "Email Security" module                         │
│                                                                 │
│  2. Worker checks:                                              │
│     • Is user authenticated?                                    │
│     • Has user completed prerequisites?                         │
│     • Is user's organization licensed?                          │
│                                                                 │
│  3. If authorized → Generate signed URL with:                   │
│     • 24-hour expiry                                            │
│     • Geo-lock to user's country                                │
│     • downloadable: false                                       │
│                                                                 │
│  4. Embed video with Stream Player                              │
│     • Track completion via Player API                           │
│     • Update D1 with progress                                   │
│                                                                 │
│  5. On completion → Unlock quiz                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Signed Token Generation:**

```javascript
import { sign } from 'jsonwebtoken';

async function generateVideoToken(videoUid, userId, country) {
  const payload = {
    sub: videoUid,
    kid: env.STREAM_KEY_ID,
    exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    accessRules: [
      { 
        type: "ip.geoip.country", 
        action: "allow", 
        country: [country] 
      },
      { 
        type: "any", 
        action: "block" 
      }
    ],
    downloadable: false
  };
  
  return sign(payload, env.STREAM_SIGNING_KEY, { 
    algorithm: 'RS256' 
  });
}
```

**Player Integration:**

```html
<stream 
  src="{videoUid}" 
  signed-token="{signedToken}"
  controls
></stream>

<script src="https://embed.cloudflarestream.com/embed/sdk.latest.js"></script>
<script>
  const player = Stream(document.querySelector('stream'));
  
  player.addEventListener('ended', async () => {
    await fetch('/api/progress', {
      method: 'POST',
      body: JSON.stringify({ 
        videoId: '{videoUid}', 
        completed: true 
      })
    });
  });
</script>
```

---

### 5. Live Security Briefings with Instant Clips

Record live presentations and automatically create clips of key moments.

```
Live Stream (OBS/WebRTC)
        │
        ▼
┌───────────────────────┐
│  Cloudflare Stream    │
│  Live Input           │
├───────────────────────┤
│ • Recording enabled   │
│ • DVR mode for        │
│   catch-up viewing    │
└───────────────────────┘
        │
        ▼ Stream ends
        │
┌───────────────────────┐
│ Webhook triggers      │
│ Worker                │
├───────────────────────┤
│ • Create clips at     │
│   bookmarked times    │
│ • Store clip IDs      │
│   in D1               │
│ • Send notification   │
└───────────────────────┘
```

**Webhook Handler:**

```javascript
export default {
  async fetch(request, env) {
    const event = await request.json();
    
    if (event.type === 'live_input.disconnected') {
      const recordingUid = event.data.recording.uid;
      
      // Fetch bookmarks created during stream
      const bookmarks = await env.D1.prepare(
        "SELECT timestamp_seconds, label FROM bookmarks WHERE stream_id = ?"
      ).bind(event.data.uid).all();
      
      // Create clips for each bookmark
      for (const bookmark of bookmarks.results) {
        await createClip(env, recordingUid, bookmark);
      }
    }
    
    return new Response('OK');
  }
};

async function createClip(env, videoUid, bookmark) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/stream/clip`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clippedFromVideoUID: videoUid,
        startTimeSeconds: Math.max(0, bookmark.timestamp_seconds - 30),
        endTimeSeconds: bookmark.timestamp_seconds + 90,
        meta: { name: bookmark.label }
      })
    }
  );
  
  return response.json();
}
```

---

### 6. Multi-Tenant Video Platform with Branding

Serve videos with per-tenant branding using Stream's watermark profiles.

```javascript
export default {
  async fetch(request, env) {
    const { tenantId, videoSlug } = parseRequest(request);
    
    // Fetch tenant branding
    const tenant = await env.D1.prepare(
      "SELECT watermark_profile_id FROM tenants WHERE id = ?"
    ).bind(tenantId).first();
    
    // Get video metadata
    const video = await env.D1.prepare(
      "SELECT stream_uid FROM videos WHERE tenant_id = ? AND slug = ?"
    ).bind(tenantId, videoSlug).first();
    
    // Generate signed URL
    const token = await generateSignedToken({
      sub: video.stream_uid,
      exp: Math.floor(Date.now() / 1000) + 3600
    });
    
    return Response.json({
      embedUrl: `https://customer-${env.CF_HASH}.cloudflarestream.com/${token}/iframe`,
      tenant: { id: tenantId }
    });
  }
};
```

---

### 7. Dynamic Video Thumbnails

Generate custom thumbnails by compositing Stream's auto-generated thumbnails with overlays.

```javascript
export default {
  async fetch(request, env) {
    const videoId = getVideoIdFromPath(request.url);
    
    const videoMeta = await env.D1.prepare(
      "SELECT title, duration_seconds, view_count FROM videos WHERE stream_uid = ?"
    ).bind(videoId).first();
    
    // Format duration
    const duration = formatDuration(videoMeta.duration_seconds);
    
    // Base thumbnail from Stream
    const baseThumbnail = `https://customer-${env.CF_HASH}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`;
    
    return fetch(baseThumbnail, {
      cf: {
        image: {
          width: 1280,
          height: 720,
          draw: [
            // Play button overlay (centered)
            { 
              url: `${env.ASSETS_URL}/play-button.png`,
              opacity: 0.9
            },
            // Duration badge (bottom right)
            { 
              url: `${env.ASSETS_URL}/badges/duration-${duration}.png`,
              bottom: 10, 
              right: 10 
            }
          ]
        }
      }
    });
  }
};

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
```

---

## Access Control Patterns

### Images: Signed URLs for Private Images

```javascript
// Generate a signed URL for private image access
async function getSignedImageUrl(imageId, expirySeconds = 3600) {
  const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
  
  const token = await sign(
    { sub: imageId, exp: expiry },
    env.IMAGES_SIGNING_KEY
  );
  
  return `https://imagedelivery.net/${env.ACCOUNT_HASH}/${imageId}/public?token=${token}`;
}
```

### Stream: Access Rules

Stream supports granular access control via JWT claims:

| Rule Type | Description | Example |
|-----------|-------------|---------|
| `ip.geoip.country` | Allow/block by country | `country: ["JP", "US"]` |
| `ip.geoip.continent` | Allow/block by continent | `continent: ["EU"]` |
| `ip.src` | Allow/block by IP range | `ip: ["192.168.1.0/24"]` |
| `any` | Catch-all rule | Final deny rule |

**Example Access Rules:**

```json
{
  "accessRules": [
    {
      "type": "ip.geoip.country",
      "action": "allow",
      "country": ["JP"]
    },
    {
      "type": "ip.src",
      "action": "block",
      "ip": ["203.0.113.0/24"]
    },
    {
      "type": "any",
      "action": "block"
    }
  ]
}
```

---

## Overlay and Watermark Patterns

### Images: Draw Options

```javascript
const transformOptions = {
  image: {
    draw: [
      {
        url: 'https://example.com/watermark.png',
        opacity: 0.3,        // 0-1 transparency
        repeat: true,        // Tile across image
        // OR position explicitly:
        // top: 10,
        // left: 10,
        // bottom: 10,
        // right: 10
      }
    ]
  }
};
```

### Stream: Watermark Profiles

Create reusable watermark profiles via API:

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/watermarks" \
  -H "Authorization: Bearer {token}" \
  -F file=@watermark.png \
  -F name="Company Logo" \
  -F position="upperRight" \
  -F scale=0.15 \
  -F opacity=0.75
```

Apply to videos during upload or update:

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{video_id}" \
  -H "Authorization: Bearer {token}" \
  -d '{"watermark": {"uid": "{watermark_profile_id}"}}'
```

---

## Cost Optimization Strategies

| Strategy | How It Saves | When to Use |
|----------|--------------|-------------|
| **Transform once, cache forever** | Unique transformations billed once/30 days | High-traffic images |
| **Format auto-negotiation** | Smaller payloads = less bandwidth | All images |
| **Signed URL expiry** | Prevents hotlinking abuse | Protected content |
| **Direct creator upload** | Skip your origin server entirely | User-generated content |
| **Thumbnail pre-generation** | Avoid on-demand generation at peak | Video catalogs |
| **R2 + Transformations** | Free egress from R2 to Workers | High-volume transformations |

### Cost Modeling Example

For a training platform with 1,000 videos and 10,000 monthly active users:

```
Stream Storage:
  1,000 videos × avg 500MB = 500GB
  Cost: ~$5/month storage

Stream Delivery:
  10,000 users × 5 videos/month × 10 min avg = 500,000 minutes
  Cost: ~$500/month @ $1/1000 minutes

Images Transformations:
  1,000 thumbnails × 3 variants = 3,000 unique transforms
  Cost: Minimal (billed once per 30 days, then cached)

Total: ~$505/month
```

---

## Integration with Content-as-Code Architecture

```
security-content/
├── content/
│   ├── diagrams/               ◀── Deploy to R2 ──▶ Serve via Images
│   │   ├── spf-flow.svg
│   │   └── zero-trust.svg
│   │
│   └── videos/                 ◀── Metadata only (video hosted on Stream)
│       └── metadata/
│           ├── email-security-basics.yaml
│           └── phishing-awareness.yaml
│
├── assets/
│   ├── overlays/
│   │   ├── draft-watermark.png
│   │   └── play-button.png
│   └── branding/
│       └── client-logos/
│
└── ci/
    ├── deploy-diagrams.ts      ──── Syncs diagrams to R2
    ├── deploy-assets.ts        ──── Syncs overlays to R2
    └── sync-video-metadata.ts  ──── Updates D1 with video info
```

**Video Metadata Schema:**

```yaml
# content/videos/metadata/email-security-basics.yaml
id: email-security-basics
stream_uid: abc123xyz  # Cloudflare Stream video ID
title: Email Security Fundamentals
duration_seconds: 847
topics:
  - spf
  - dkim
  - dmarc
prerequisites:
  - security-awareness-intro
quiz_id: email-security-quiz-001
```

---

## Limitations and Considerations

### Images

| Limitation | Workaround |
|------------|------------|
| Requires zone on Cloudflare | Use Images storage instead of external sources |
| No native text rendering | Pre-render text as PNG/SVG overlays |
| SVG resize not supported | Convert to raster format first |
| 100MB max file size | Resize before upload if needed |

### Stream

| Limitation | Workaround |
|------------|------------|
| 30GB max upload size | Use resumable (tus) uploads for large files |
| HDR → SDR conversion | Accept SDR output or use alternative encoding |
| 70 FPS max output | Source at or below 70 FPS |
| No real-time transcoding control | Use webhooks to track encoding status |

---

## Quick Reference: API Endpoints

### Images

```bash
# Upload image
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1" \
  -H "Authorization: Bearer {token}" \
  -F file=@image.png

# Get direct creator upload URL
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v2/direct_upload" \
  -H "Authorization: Bearer {token}"

# List images
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1" \
  -H "Authorization: Bearer {token}"
```

### Stream

```bash
# Upload video
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream" \
  -H "Authorization: Bearer {token}" \
  -F file=@video.mp4

# Get direct creator upload URL
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/direct_upload" \
  -H "Authorization: Bearer {token}" \
  -d '{"maxDurationSeconds": 3600}'

# Create clip
curl -X POST \
  "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/clip" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "clippedFromVideoUID": "{video_uid}",
    "startTimeSeconds": 0,
    "endTimeSeconds": 60
  }'

# Get video details
curl "https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{video_uid}" \
  -H "Authorization: Bearer {token}"
```

---

## Related Resources

- [Cloudflare Images Documentation](https://developers.cloudflare.com/images/)
- [Cloudflare Stream Documentation](https://developers.cloudflare.com/stream/)
- [Transform via Workers](https://developers.cloudflare.com/images/transform-images/transform-via-workers/)
- [Stream Signed URLs](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/)
- [Direct Creator Uploads (Images)](https://developers.cloudflare.com/images/upload-images/direct-creator-upload/)
- [Direct Creator Uploads (Stream)](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/)

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-26 | Initial document creation |
