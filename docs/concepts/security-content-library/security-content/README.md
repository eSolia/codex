# Security Content Library

A self-contained, version-controlled library of security education content that can be consumed by multiple applications.

## Design Principles

This content package is **location-agnostic**. It can live:

- As its own repository
- As a git submodule in any product repo
- As a package in a monorepo
- Published to npm and consumed as a dependency

## Structure

```
security-content/
├── content/                    # The actual content
│   ├── periodic/               # DNS monitoring & education
│   ├── pulse/                  # Compliance frameworks & controls
│   ├── quiz/                   # Question banks
│   └── shared/                 # Cross-product content (diagrams, glossary)
│
├── schemas/                    # JSON schemas for validation
├── templates/                  # Content templates for authors
├── scripts/                    # Build, validate, transform scripts
├── dist/                       # Generated outputs (gitignored)
└── content.config.ts           # Deployment configuration
```

## Usage

### As a Standalone Repo

```bash
git clone <this-repo>
npm install
npm run validate
npm run build
```

### As a Git Submodule

```bash
# In your product repo
git submodule add <this-repo> packages/content
```

### As an NPM Package

```bash
npm install @yourorg/security-content
```

### In a Monorepo

```bash
# content lives at packages/security-content
# products import from "@yourorg/security-content"
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run validate` | Lint markdown, check schemas, verify links |
| `npm run validate:links` | Check all internal links resolve |
| `npm run build` | Generate all outputs to `dist/` |
| `npm run build:r2` | Prepare content for R2/AI Search |
| `npm run build:docs` | Generate static documentation site |
| `npm run build:quiz` | Transform quiz YAML to SQL/JSON |
| `npm run deploy` | Deploy to configured targets (see config) |
| `npm run new:issue` | Scaffold a new issue document |
| `npm run new:control` | Scaffold a new control document |

## Configuration

Deployment targets are configured in `content.config.ts`. This file is **not** 
committed with secrets—each consuming application provides its own configuration 
or environment variables.

See `content.config.example.ts` for the configuration schema.

## Content Authoring

### With Claude Code

```bash
# Generate a new issue document
claude "Create a new issue document for DKIM key rotation using our template"

# Generate quiz questions from existing content
claude "Generate 5 quiz questions based on content/periodic/concepts/what-is-spf.md"
```

### Manually

1. Copy the appropriate template from `templates/`
2. Fill in the frontmatter and content
3. Run `npm run validate` to check your work
4. Submit a PR

## Consuming Applications

| Application | What It Uses | How |
|-------------|--------------|-----|
| **Periodic** | Issues, concepts, remediation | AI Search retrieval |
| **Pulse** | Frameworks, controls, implementation | AI Search + static docs |
| **Quiz** | Question banks | D1 database |
| **Nexus** | All (client portal) | Aggregated access |

## License

Proprietary - Internal use only.
