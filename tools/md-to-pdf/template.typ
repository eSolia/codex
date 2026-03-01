// ─────────────────────────────────────────────────────────────
// template.typ — eSolia branded markdown-to-PDF template
// Designed for: pricing docs, proposals, client deliverables
// Watermark: traces document provenance for Courier/Nexus sharing
// ─────────────────────────────────────────────────────────────

// ── Inputs (passed via typst --input) ───────────────────────
#let watermark-text = sys.inputs.at("watermark", default: "")
#let show-wm = sys.inputs.at("show-watermark", default: "false") == "true"

// ── Colour palette (eSolia CI) ──────────────────────────────
#let navy     = rgb("#1B2A4A")
#let amber    = rgb("#E8A020")
#let cream    = rgb("#FFFAD7")
#let navy-mid = rgb("#2A3F6F")
#let lgray    = rgb("#F2F2F2")
#let drule    = rgb("#CCCCCC")
#let muted    = rgb("#777777")
#let black    = rgb("#1A1A1A")

// ── Page setup ──────────────────────────────────────────────
#set page(
  paper: "a4",
  margin: (top: 2.8cm, bottom: 2.2cm, left: 2cm, right: 2cm),

  header: {
    grid(
      columns: (auto, 1fr),
      align: (left + horizon, right + horizon),
      gutter: 12pt,
      image("logo.svg", height: 18pt),
      text(font: "IBM Plex Sans JP", size: 7pt, fill: muted, weight: "regular")[
        eSolia Inc. — Confidential
      ],
    )
    v(4pt)
    line(length: 100%, stroke: 0.6pt + amber)
  },

  footer: {
    line(length: 100%, stroke: 0.3pt + drule)
    v(4pt)
    grid(
      columns: (1fr, auto),
      align: (left, right),
      text(font: "IBM Plex Sans JP", size: 6pt, fill: muted)[
        #watermark-text
      ],
      context text(font: "IBM Plex Sans JP", size: 7pt, fill: muted)[
        #counter(page).display("1 / 1", both: true)
      ],
    )
  },

  background: if show-wm {
    place(center + horizon,
      rotate(-38deg,
        text(
          size: 28pt,
          fill: rgb("#1B2A4A09"),
          tracking: 2pt,
          weight: "bold",
          font: "IBM Plex Sans JP",
          watermark-text,
        )
      )
    )
  },
)

// ── Typography ──────────────────────────────────────────────
#set text(
  font: "IBM Plex Sans JP",
  size: 10pt,
  fill: black,
  lang: "en",
)

#set par(
  leading: 0.6em,
  justify: true,
)

// ── Heading styles ──────────────────────────────────────────
// All headings use block(breakable: false) to prevent orphaned headings
#show heading.where(level: 1): it => block(breakable: false, below: 0.6em, {
  v(0.3em)
  text(size: 20pt, weight: "bold", fill: navy)[#it.body]
  v(0.05em)
  line(length: 50pt, stroke: 2.5pt + rgb("#0ea5e9"))
})

#show heading.where(level: 2): it => block(breakable: false, below: 0.5em, {
  v(0.8em)
  text(size: 14pt, weight: "bold", fill: navy)[#it.body]
  v(0.05em)
  line(length: 30pt, stroke: 1.5pt + rgb("#0ea5e9"))
})

#show heading.where(level: 3): it => block(breakable: false, below: 0.6em, {
  v(0.5em)
  text(size: 11pt, weight: "semibold", fill: navy-mid)[#it.body]
})

#show heading.where(level: 4): it => block(breakable: false, below: 0.15em, {
  v(0.4em)
  text(size: 10pt, weight: "semibold", fill: navy)[#it.body]
})

// ── Code blocks ─────────────────────────────────────────────
#show raw.where(block: true): it => {
  v(0.3em)
  block(
    fill: lgray,
    inset: (x: 12pt, y: 10pt),
    radius: 3pt,
    width: 100%,
    text(size: 8.5pt, font: "IBM Plex Mono", it),
  )
  v(0.3em)
}

#show raw.where(block: false): it => {
  box(
    fill: lgray,
    inset: (x: 3pt, y: 1.5pt),
    radius: 2pt,
    text(size: 9pt, font: "IBM Plex Mono", it),
  )
}

// ── Tables ──────────────────────────────────────────────────
#set table(
  inset: (x: 8pt, y: 6pt),
  stroke: (x, y) => (
    top: if y <= 1 { 0pt } else { 0.5pt + drule },
    bottom: 0.5pt + drule,
    left: 0pt,
    right: 0pt,
  ),
)

// All table cell styling in one rule to avoid conflicts
#show table.cell: it => {
  if it.y == 0 {
    // Header: semibold grey on light background
    set table.cell(fill: lgray)
    set text(weight: "semibold", fill: muted, size: 9pt)
    it
  } else {
    // Body: alternating rows, no hyphenation
    set table.cell(fill: if calc.odd(it.y) { white } else { lgray })
    set text(size: 9pt, hyphenate: false)
    set par(justify: false)
    it
  }
}

// Pandoc wraps tables in #figure — remove the default figure styling
#show figure.where(kind: table): it => {
  set figure(supplement: none)
  block(width: 100%, it.body)
}

// ── Block quotes ────────────────────────────────────────────
#show quote: it => {
  block(
    inset: (left: 14pt, top: 6pt, bottom: 6pt, right: 8pt),
    stroke: (left: 3pt + amber),
    fill: rgb("#FFFAD720"),
    it.body,
  )
}

// ── Links ───────────────────────────────────────────────────
#show link: it => {
  text(fill: navy-mid, it)
}

// ── Strong and emphasis ─────────────────────────────────────
#show strong: set text(fill: navy)

// ── Lists ───────────────────────────────────────────────────
#set list(marker: text(fill: amber, weight: "bold")[•], indent: 8pt)
#set enum(indent: 8pt)

// ── Content ─────────────────────────────────────────────────
#include "content.typ"
