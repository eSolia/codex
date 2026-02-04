# eSolia Typora Theme

A professional Typora theme matching eSolia's brand guidelines, designed for creating consistent ad-hoc reports and documentation. Features IBM Plex Sans JP font for excellent English and Japanese rendering.

## Features

- **IBM Plex Sans JP** - Clean, professional font with excellent CJK support
- **eSolia Brand Colors** - Navy blue headings (#2D2F63), orange accents (#FFBC68)
- **Mermaid Diagram Support** - Styled diagrams that match the brand
- **Print/PDF Export** - Optimized for professional PDF output
- **Responsive** - Works across different window sizes
- **Accessibility** - Respects reduced motion and high contrast preferences

## Installation

### macOS

1. Open Typora
2. Go to **Typora** → **Preferences** → **Appearance** → **Open Theme Folder**
3. Copy the following files to the theme folder:
   - `esolia.css`
   - `esolia/` folder (contains logo.svg)
4. Restart Typora
5. Select **Themes** → **eSolia**

### Windows

1. Open Typora
2. Go to **File** → **Preferences** → **Appearance** → **Open Theme Folder**
3. Copy the following files to the theme folder:
   - `esolia.css`
   - `esolia/` folder (contains logo.svg)
4. Restart Typora
5. Select **Themes** → **eSolia**

### Alternative: Quick Install via Terminal

**macOS:**
```bash
# Find Typora theme folder
THEME_DIR="$HOME/Library/Application Support/abnerworks.Typora/themes"

# Copy files
cp esolia.css "$THEME_DIR/"
cp -r esolia "$THEME_DIR/"
```

**Windows (PowerShell):**
```powershell
# Find Typora theme folder
$THEME_DIR = "$env:APPDATA\Typora\themes"

# Copy files
Copy-Item esolia.css -Destination $THEME_DIR
Copy-Item -Recurse esolia -Destination $THEME_DIR
```

## File Structure

```
typora-theme/
├── esolia.css          # Main theme file
├── esolia/             # Assets folder
│   └── logo.svg        # eSolia horizontal logo
└── README.md           # This file
```

## Usage Tips

### Adding the Logo to Documents

The theme automatically adds the eSolia logo above the first H1 heading when exporting. If you need the logo in the editor view, add this at the start of your document:

```markdown
![eSolia](esolia/logo.svg)

# Your Document Title
```

### Creating Professional Headers

For client-facing documents, use this structure:

```markdown
# Document Title

**Prepared for:** Client Name
**Date:** January 27, 2026

---

## Section 1
```

### Info Callouts

Create styled callouts using blockquotes:

```markdown
> **ℹ️ Note:** This is an informational callout that will be styled with a blue border.

> **⚠️ Warning:** This is a warning callout.
```

### Mermaid Diagrams

Mermaid diagrams are fully supported and styled to match the theme:

```markdown
​```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
​```
```

## Exporting to PDF

For best results when exporting:

1. Go to **File** → **Export** → **PDF**
2. In export settings:
   - Page Size: A4 or Letter
   - Margins: Normal (0.75in)
   - Theme CSS: Include (checked)

### Footer Customization

The theme includes footer text for confidential documents. To customize, edit the `@page` rule in `esolia.css`:

```css
@page {
  @bottom-left {
    content: "eSolia Inc. — CONFIDENTIAL / 機密";
  }
}
```

## Brand Colors Reference

| Color | Hex | Usage |
|-------|-----|-------|
| Navy Blue | `#2D2F63` | Headings, emphasis |
| Orange | `#FFBC68` | Accents, H1 underline |
| Link Blue | `#4A7CB8` | Links, callout borders |
| Text Gray | `#374151` | Body text |
| Muted Gray | `#6B7280` | Secondary text |

## Troubleshooting

### Font not loading?

If IBM Plex Sans JP doesn't render:

1. Ensure you have internet access (fonts load from Google Fonts)
2. Or install IBM Plex Sans JP locally from [Google Fonts](https://fonts.google.com/specimen/IBM+Plex+Sans+JP)

### Logo not appearing in exports?

1. Ensure the `esolia/` folder is in the theme directory
2. Check that `logo.svg` exists in the `esolia/` folder
3. Try using an absolute path in the CSS if needed

### Mermaid diagrams look wrong?

Mermaid uses its own CSS. For more control, add custom styles to the `.mermaid` selectors in the CSS.

## Customization

### Changing Colors

Edit the CSS variables at the top of `esolia.css`:

```css
:root {
  --esolia-navy: #2D2F63;
  --esolia-orange: #FFBC68;
  --esolia-link: #4A7CB8;
  /* ... */
}
```

### Changing Fonts

To use a different font, update the `@import` statement and `--font-family` variable:

```css
@import url('https://fonts.googleapis.com/css2?family=Your+Font&display=swap');

:root {
  --font-family: 'Your Font', sans-serif;
}
```

## Version History

- **1.0.0** (2026-02-02) - Initial release

## License

MIT License - Free to use and modify for eSolia projects.

## Contact

**eSolia Inc.**
Shiodome City Center 5F (Work Styling)
1-5-2 Higashi-Shimbashi, Minato-ku, Tokyo, Japan 105-7105
**Tel (Main):** +813-4577-3380
**Web:** https://esolia.co.jp/en
