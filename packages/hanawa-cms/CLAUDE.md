# Hanawa CMS - Package Context

Hanawa is the centralized headless CMS for all eSolia content. Named after Hanawa Hokiichi (塙保己一), the blind scholar who compiled 1,273 classical texts.

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5 (runes)
- **Styling**: Tailwind CSS v4, bits-ui
- **Editor**: Tiptap with custom extensions
- **Runtime**: Cloudflare Pages
- **Database**: D1 (SQLite)
- **Storage**: R2 (codex bucket)
- **AI**: Workers AI, Vectorize

## Development Commands

```bash
npm run dev           # Start dev server
npm run build         # Build for production
npm run check         # Type check
npm run deploy        # Deploy to Cloudflare Pages
npm run db:migrate    # Run D1 migrations (production)
npm run db:migrate:local  # Run D1 migrations (local)
npm run version:bump 0.2.0  # Bump version
npm run version:check       # Verify version consistency
```

## Version Management

**CRITICAL: When releasing a new version, ALL version references must be updated.**

### Version Locations

| File | Field | Purpose |
|------|-------|---------|
| `package.json` | `version` | npm package version |
| `package-lock.json` | `version` | Synced automatically |
| `wrangler.jsonc` | `APP_VERSION` | Runtime version |

### Release Process

```bash
# 1. Bump version (updates all files automatically)
npm run version:bump 0.2.0

# 2. Commit and tag
git add .
git commit -m "chore: bump hanawa-cms version to 0.2.0"
git tag -a v0.2.0 -m "v0.2.0"
git push origin main --tags

# 3. Deploy
npm run deploy

# 4. Create release WITH NOTES (use heredoc for multi-line)
gh release create v0.2.0 --title "v0.2.0 - Short Description" --notes "$(cat <<'EOF'
## Features
- Feature description

## Improvements
- Improvement description

## Bug Fixes
- Bug fix description

**Full Changelog**: https://github.com/eSolia/codex/compare/v0.1.0...v0.2.0
EOF
)"
```

### Release Notes Template

Always structure release notes with these sections (omit empty sections):

- **Features** - New functionality
- **Improvements** - Enhancements to existing features
- **Bug Fixes** - Issues resolved
- **Security** - Security-related changes (InfoSec)
- **Technical** - Internal/architectural changes
- **Breaking Changes** - API or behavior changes (if any)

## Security

See `/SECURITY.md` at repo root for full security documentation.

Key security considerations for Hanawa:

- **XSS Prevention**: All `{@html}` usage must pass through `$lib/sanitize.ts`
- **CSRF**: SvelteKit handles via same-origin checks
- **Auth**: Cloudflare Access protects all routes
- **Input Validation**: Use Zod schemas for all user input

### InfoSec Comments

All security-relevant code must include InfoSec comments:

```typescript
// InfoSec: Sanitize HTML to prevent XSS (OWASP A03)
const clean = sanitizeHtml(userContent);
```

## File Structure

```
src/
├── routes/           # SvelteKit routes
│   ├── +layout.svelte  # Main layout (nav, footer)
│   ├── content/      # Content management
│   ├── fragments/    # Fragment library
│   └── api/          # API routes
├── lib/
│   ├── components/   # Svelte components
│   │   ├── ui/       # bits-ui based UI components
│   │   └── editor/   # Tiptap editor components
│   ├── editor/       # Tiptap extensions
│   ├── server/       # Server-only code
│   └── sanitize.ts   # HTML sanitization
├── app.css           # Global styles + Tailwind theme
└── app.d.ts          # TypeScript definitions
```

## Branding

- **Primary Color**: Rose (`#e11d48`) - Codex theme
- **Icon**: Phosphor RocketLaunch (duotone)
- **Accents**: slate, zinc, teal, amber

---

*See root `/CLAUDE.md` for full monorepo context*
