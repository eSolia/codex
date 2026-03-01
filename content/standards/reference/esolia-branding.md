---
title: "eSolia Branding Configuration"
slug: esolia-branding
category: reference
tags: [branding, colors, typography, design-system]
summary: "eSolia CI colors, typography, and branding configuration"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# eSolia DNS Monitor - Production Branding Configuration

# Complete setup guide with actual eSolia CI colors

## ============================================================================

## BRANDING CONFIGURATION

## ============================================================================

export const ESOLIA_BRANDING = { // Official eSolia CI Colors (from PDF) colors:
{ navy: "#2D2F63", // Primary brand color orange: "#FFBC68", // Accent color
cream: "#FFFAD7", // Light backgrounds white: "#FFFFFF", // Pure white

    // Tailwind complementary colors (from website)
    emerald: "#10b981",        // Success/OK status
    sky: "#0ea5e9",            // Warning/Info status
    fuschia: "#d946ef",        // Error/Alert status

},

// Typography - Simplified to IBM Plex Sans only fonts: { body: "IBM Plex Sans,
IBM Plex Sans JP, sans-serif", display: "IBM Plex Sans, IBM Plex Sans JP,
sans-serif", // Same as body },

// Logo paths (hosted in /static/images/)
logos: {
horizontal: "/static/images/logo_horiz_darkblue_bgtransparent.svg", // Desktop header
symbol: "/static/images/symbol_darkblue_bgtransparent.svg", // Mobile/favicon
symbolWhite: "/static/images/symbol_white_bgtransparent.svg", // Dark backgrounds
symbolWhitePng: "/static/images/symbol_white_bgtransparent_web.png", // Email templates (PNG for Outlook)
}
} as const;

## ============================================================================

## QUICK SETUP GUIDE

## ============================================================================

### Step 1: Static Image Files

Logo files are stored in `static/images/` and served at `/static/images/`:

```
static/images/
├── logo_horiz_darkblue_bgtransparent.svg   # Horizontal logo (dark blue)
├── logo_horiz_white_bgtransparent.svg      # Horizontal logo (white)
├── symbol_darkblue_bgtransparent.svg       # Symbol only (dark blue)
├── symbol_white_bgtransparent.svg          # Symbol only (white, for dark bg)
└── symbol_white_bgtransparent_web.png      # Symbol PNG (for email templates)
```

**Important:** For email templates, use PNG format as SVG is not supported by Outlook and many email clients.

### Step 2: Update HTML Template

```html
<link
  href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+JP:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>

<style>
  :root {
    /* eSolia CI Colors */
    --esolia-navy: #2d2f63;
    --esolia-orange: #ffbc68;
    --esolia-cream: #fffad7;
    --esolia-white: #ffffff;

    /* Tailwind Complementary */
    --emerald: #10b981;
    --sky: #0ea5e9;
    --fuschia: #d946ef;
  }

  body {
    font-family: 'IBM Plex Sans', 'IBM Plex Sans JP', sans-serif;
    background: var(--esolia-cream);
  }

  .header {
    background: var(--esolia-white);
    border-bottom: 3px solid var(--esolia-orange);
  }

  .logo {
    height: 48px;
    content: url('/static/images/logo_horiz_darkblue_bgtransparent.svg');
  }

  /* Mobile - use symbol logo */
  @media (max-width: 768px) {
    .logo {
      height: 40px;
      content: url('/static/images/symbol_darkblue_bgtransparent.svg');
    }
  }
</style>

<header class="header">
  <img src="/static/images/logo_horiz_darkblue_bgtransparent.svg" alt="eSolia" class="logo" />
  <div class="brand-name">DNS Monitor</div>
</header>
```

## ============================================================================

## COLOR USAGE GUIDE

## ============================================================================

### Primary Elements (Navy #2D2F63)

- Navigation text
- Brand name
- Primary buttons
- Card titles
- Main headings

### Accent Elements (Orange #FFBC68)

- 3px border under header
- Left border on cards
- Hover states
- Active states
- Call-to-action buttons

### Backgrounds (Cream #FFFAD7)

- Page background
- Table row hover
- Subtle highlights
- Input field backgrounds

### Status Colors

**Emerald (#10b981) - Success/OK**

```css
.status-ok {
  background: color-mix(in srgb, #10b981 20%, white);
  color: #065f46;
  border: 1px solid #10b981;
}

.stat-card.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}
```

**Sky (#0ea5e9) - Warning/Info**

```css
.status-warning {
  background: color-mix(in srgb, #0ea5e9 20%, white);
  color: #075985;
  border: 1px solid #0ea5e9;
}

.stat-card.warning {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
}
```

**Fuschia (#d946ef) - Error/Alert**

```css
.status-error {
  background: color-mix(in srgb, #d946ef 20%, white);
  color: #86198f;
  border: 1px solid #d946ef;
}

.stat-card.error {
  background: linear-gradient(135deg, #d946ef 0%, #c026d3 100%);
}
```

## ============================================================================

## EXAMPLE CLIENT CONFIGURATION

## ============================================================================

```typescript
const esoliaClient: Client = {
  id: 'esolia-dns-monitor',
  name: 'eSolia Inc.',
  nameJa: '株式会社イソリア',
  email: 'hello@esolia.co.jp',

  branding: {
    logo: '/static/images/logo_horiz_darkblue_bgtransparent.svg',
    logoAlt: 'eSolia Inc. 株式会社イソリア',

    primaryColor: '#2D2F63', // Navy
    accentColor: '#FFBC68', // Orange
    lightColor: '#FFFAD7', // Cream

    successColor: '#10b981', // Emerald
    warningColor: '#0ea5e9', // Sky
    errorColor: '#d946ef', // Fuschia

    displayFont: 'IBM Plex Sans, IBM Plex Sans JP, sans-serif',
    bodyFont: 'IBM Plex Sans, IBM Plex Sans JP, sans-serif'
  },

  checks: [
    {
      id: 'esolia-ns',
      domain: 'esolia.co.jp',
      recordType: 'NS',
      name: '',
      expected: ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
      matchMode: 'exact',
      adminEmails: ['admin@esolia.co.jp'],
      requireDualAuthorization: true,
      requireMFA: true,
      alertOnNSChange: true,
      checkNSFirst: true
      // ... rest of config
    }
  ],

  users: [],
  createdAt: new Date().toISOString()
};
```

## ============================================================================

## VISUAL PREVIEW

## ============================================================================

Header: ┌────────────────────────────────────────────────────────────┐ │ [eSolia
Logo] DNS Monitor EN/日本語 user@esolia.co.jp │ ← White bg
└────────────────────────────────────────────────────────────┘ ▲ 3px Orange
border

Dashboard Cards: ┌─ Orange 4px left border │
┌──────────────────────────────────────────────────────┐ │ │ Navy title: "DNS
Checks" │ │ │ │ │ │ Content in Navy text on White background │ │ │ │ │
└──────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────────

Status Cards: ┌──────────┐ ┌──────────┐ ┌──────────┐ │ Emerald │ │ Sky │ │
Fuschia │ │ 12 │ │ 3 │ │ 1 │ │ OK │ │ Warning │ │ Error │ └──────────┘
└──────────┘ └──────────┘

## ============================================================================

## DEPLOYMENT CHECKLIST

## ============================================================================

- [ ] Upload logo SVG files to /assets/
- [ ] Load IBM Plex Sans & IBM Plex Sans JP from Google Fonts
- [ ] Set CSS variables with eSolia colors
- [ ] Test logo display on desktop (horizontal)
- [ ] Test logo display on mobile (symbol)
- [ ] Verify all status colors (emerald/sky/fuschia)
- [ ] Test English and Japanese language switching
- [ ] Verify Navy text is readable on Cream background
- [ ] Verify Orange accents are visible but not overwhelming
- [ ] Check contrast ratios for accessibility (WCAG AA)

## ============================================================================

## ACCESSIBILITY NOTES

## ============================================================================

Color Contrast Ratios (WCAG AA minimum: 4.5:1):

✓ Navy (#2D2F63) on White (#FFFFFF): 11.8:1 - PASS ✓ Navy (#2D2F63) on Cream
(#FFFAD7): 10.5:1 - PASS ✓ Orange (#FFBC68) on Navy (#2D2F63): 4.7:1 - PASS ✗
Orange (#FFBC68) on White (#FFFFFF): 2.8:1 - FAIL (use Navy text instead)

Recommendation: Never use Orange for body text, only for accents and borders.

## ============================================================================

## RESPONSIVE BREAKPOINTS

## ============================================================================

Desktop (>768px):

- Full horizontal logo
- Multi-column stats grid
- Expanded navigation

Mobile (≤768px):

- Symbol logo only
- Single-column layout
- Collapsed hamburger menu
- Larger touch targets (48px minimum)

## ============================================================================

## BRAND CONSISTENCY TIPS

## ============================================================================

1. **Logo Usage**
   - Always use official SVG files (never recreate)
   - Maintain aspect ratio
   - Minimum clear space: logo height × 0.25

2. **Color Application**
   - Navy: Primary text, buttons, headings
   - Orange: Accents only (never body text)
   - Cream: Backgrounds, subtle states
   - Emerald/Sky/Fuschia: Status indicators only

3. **Typography**
   - Headings: IBM Plex Sans 600-700 weight
   - Body: IBM Plex Sans 400-500 weight
   - Japanese: IBM Plex Sans JP same weights
   - Never mix different fonts

4. **Spacing**
   - Use multiples of 8px (8, 16, 24, 32, 48, 64)
   - Maintain consistent padding in cards (2rem/32px)
   - Consistent gap in grids (1.5rem/24px)

## ============================================================================

## EMAIL TEMPLATE BRANDING

## ============================================================================

### Logo Requirements for Email

Email clients (especially Outlook) have limited support for image formats:

- **Use PNG format** - SVG is not supported by Outlook
- **Host images at absolute URLs** - Relative paths don't work in email
- **Use the white logo on navy header** - `symbol_white_bgtransparent_web.png`

### Email Template Header Pattern

```html
<div
  style="background: #2D2F63; color: white; padding: 20px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center;"
>
  <div>
    <h1 style="margin: 0; font-size: 24px;">Email Title</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9;">eSolia Periodic</p>
  </div>
  <img
    src="https://periodic.esolia.co.jp/static/images/symbol_white_bgtransparent_web.png"
    alt="eSolia"
    style="width: 50px; height: 50px;"
  />
</div>
```

### Email Font Stack

Web fonts are not reliable in email. Use system fonts:

```css
/* English */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;

/* Japanese */
font-family:
  -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Hiragino Sans', 'Yu Gothic', sans-serif;
```

### Email Templates Location

All email templates are in `src/integrations/maileroo.ts`:

- Domain Security Check Results (EN/JA)
- DNS Monitoring Alert
- DNS Change Authorization Request
- Magic Link Login
- Email Change Verification/Notification/Confirmation (EN/JA)

## ============================================================================

## END OF CONFIGURATION

## ============================================================================
