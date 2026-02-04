# Avatar System

The Pulse application uses a deterministic avatar system that generates unique, visually distinct avatars for each user. This document describes how the system works and how to use it.

## Overview

Each user in the system gets:

1. **Avatar Hue** - A unique HSL hue value (0-360) that becomes their "signature color"
2. **Initials** - Auto-generated from their name (customizable by admins)
3. **Geometric Pattern** - A deterministic SVG pattern generated from their ID

## Database Schema

The avatar system uses three columns in the `users` table (central DB):

```sql
-- HSL hue value (0-360) for the user's primary color
avatar_hue INTEGER;

-- Seed value for deterministic geometric pattern generation
avatar_pattern TEXT;

-- User's initials (auto-generated, admin-editable)
initials TEXT;
```

Migration: `migrations/central/004_user_avatar.sql`

## Color Generation

### Distinct Color Algorithm

When a new user is created, the system automatically assigns them a color that is maximally different from existing users:

1. **First user**: Gets hue 210 (a nice blue)
2. **Second user**: Gets the opposite side of the color wheel (180° away)
3. **Subsequent users**: The system finds the largest gap in the color wheel and places the new color in the middle

This ensures visual distinction even with many users.

### Color Functions

```typescript
import {
  generateDistinctHue,
  hueToHSL,
  hueToLightBg,
  hueToText,
  getContrastText,
} from '$lib/avatar';

// Generate a new distinct hue
const existingHues = [210, 30, 120]; // hues of existing users
const newHue = generateDistinctHue(existingHues); // returns ~285

// Convert hue to CSS colors
hueToHSL(210); // "hsl(210, 65%, 45%)" - for avatar backgrounds
hueToLightBg(210); // "hsl(210, 70%, 90%)" - for light backgrounds
hueToText(210); // "hsl(210, 70%, 30%)" - for text on light bg
getContrastText(210); // "white" or dark color for contrast
```

## Initials Generation

Initials are automatically generated from the user's name:

```typescript
import { generateInitials } from '$lib/avatar';

generateInitials('John Smith'); // "JS"
generateInitials('田中太郎'); // "田中" (CJK: first 2 chars)
generateInitials(null, 'john@x.com'); // "JO" (fallback to email)
```

Rules:

- **Latin names**: First letter of each word (max 2)
- **CJK names**: First 2 characters (often surname)
- **Email fallback**: From email prefix if name is empty

## Geometric Avatar

The system generates GitHub-style identicons using SVG:

```typescript
import { generateGeometricAvatar } from '$lib/avatar';

// Generate SVG string
const svg = generateGeometricAvatar(
  'user-abc123', // seed (user ID, email, etc.)
  210, // hue
  80 // size in pixels
);
```

Four pattern types are randomly assigned based on the seed:

- **Blocks**: 5x5 symmetric block pattern (GitHub-style)
- **Triangles**: 6-segment radial triangles
- **Circles**: Concentric rings with dots
- **Rings**: Arc segments around center

## UserAvatar Component

The `UserAvatar` Svelte component handles all avatar display:

```svelte
<script>
  import UserAvatar from '$lib/components/UserAvatar.svelte';
</script>

<!-- Initials mode (compact, for small spaces) -->
<UserAvatar
  name="John Smith"
  email="john@example.com"
  initials={user.initials}
  avatarHue={user.avatarHue}
  size="sm"
  mode="initials"
/>

<!-- Geometric mode (for larger displays) -->
<UserAvatar
  name="John Smith"
  patternSeed={user.id}
  avatarHue={user.avatarHue}
  size="xl"
  mode="geometric"
/>

<!-- Auto mode (geometric for lg/xl, initials for smaller) -->
<UserAvatar name="John Smith" avatarHue={user.avatarHue} size="md" mode="auto" />
```

### Props

| Prop          | Type                                   | Default  | Description                          |
| ------------- | -------------------------------------- | -------- | ------------------------------------ |
| `name`        | `string \| null`                       | -        | User's display name                  |
| `email`       | `string \| null`                       | -        | User's email (fallback for initials) |
| `initials`    | `string \| null`                       | -        | Pre-computed initials                |
| `avatarHue`   | `number \| null`                       | 210      | HSL hue (0-360)                      |
| `patternSeed` | `string \| null`                       | -        | Seed for geometric pattern           |
| `size`        | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'`   | Avatar size                          |
| `mode`        | `'initials' \| 'geometric' \| 'auto'`  | `'auto'` | Display mode                         |
| `class`       | `string`                               | `''`     | Additional CSS classes               |

### Sizes

| Size | Dimensions | Use Case               |
| ---- | ---------- | ---------------------- |
| `xs` | 20x20px    | Inline mentions        |
| `sm` | 24x24px    | Compact lists, nav bar |
| `md` | 32x32px    | Standard lists         |
| `lg` | 40x40px    | User cards             |
| `xl` | 64x64px    | Profile pages          |

## Assignee Matching

The system can match typed assignee text to users for color lookup:

```typescript
import { matchAssigneeToUser } from '$lib/avatar';

const users = [
  { id: '1', name: 'John Smith', initials: 'JS', avatarHue: 210 },
  { id: '2', name: 'Jane Doe', initials: 'JD', avatarHue: 30 },
];

// Match by initials
matchAssigneeToUser('JS', users); // { id: '1', name: 'John Smith', ... }

// Match by name (partial)
matchAssigneeToUser('john', users); // { id: '1', name: 'John Smith', ... }

// No match
matchAssigneeToUser('XY', users); // null
```

This is used in the UI to show the correct avatar color when an assignee name is typed in.

## Usage in the Application

### Nav Bar (Current User)

The user menu in the navigation bar shows the current user's avatar:

```svelte
<UserAvatar
  name={data.user.name}
  email={data.user.email}
  initials={data.user.initials}
  avatarHue={data.user.avatarHue}
  size="sm"
  mode="initials"
/>
```

### User Management Table

The users table shows avatars next to each user:

```svelte
<UserAvatar
  name={user.name}
  email={user.email}
  initials={user.initials}
  avatarHue={user.avatarHue}
  size="md"
  mode="initials"
/>
```

### Future: Assignee Picker

When the assignee picker is implemented, it will show avatars for each selectable user, and the selected assignee's color will be used in compact displays.

## Migrating Existing Users

Existing users without avatar data can be backfilled:

```sql
-- Generate initials for users without them
-- (This would need to be done programmatically for proper CJK handling)

-- Assign distinct hues to existing users
-- Run this script to assign hues spaced evenly
```

Or use a migration script that calls the `generateDistinctHue` function for each user.

## Best Practices

1. **Always pass `avatarHue`** when available - it ensures consistent color across the app
2. **Use `mode="initials"`** for compact spaces (tables, lists, nav)
3. **Use `mode="geometric"`** for profile displays where space allows
4. **Use `mode="auto"`** when unsure - it picks appropriately based on size
5. **Store `initials`** for users - allows admin customization (e.g., "RC" instead of "RJC")
