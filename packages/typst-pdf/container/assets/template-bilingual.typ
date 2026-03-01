// ─────────────────────────────────────────────────────────────
// template-bilingual.typ — eSolia bilingual PDF with scoped TOCs
//
// Extends the single-language template with:
// - Cover page showing bilingual titles and dual TOCs
// - Scoped #outline() selectors for EN and JA headings
// - Language boundary labels (<en-start>, <ja-start>)
//
// Content.typ must include:
//   #metadata(none) <en-start>
//   ... English content ...
//   #metadata(none) <ja-start>
//   ... Japanese content ...
// ─────────────────────────────────────────────────────────────

// ── Inputs (passed via typst --input) ───────────────────────
#let watermark-text = sys.inputs.at("watermark", default: "")
#let show-wm = sys.inputs.at("show-watermark", default: "false") == "true"

// ── Template variables (set by inputs.typ) ──────────────────
#include "inputs.typ"

// ── Colour palette (eSolia CI) ──────────────────────────────
#let navy     = rgb("#1B2A4A")
#let amber    = rgb("#E8A020")
#let cream    = rgb("#FFFAD7")
#let navy-mid = rgb("#2A3F6F")
#let lgray    = rgb("#F2F2F2")
#let drule    = rgb("#CCCCCC")
#let muted    = rgb("#777777")
#let black    = rgb("#1A1A1A")
#let sky      = rgb("#0ea5e9")

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
        eSolia Inc. — Confidential / 機密
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
#show heading.where(level: 1): it => block(breakable: false, below: 0.6em, {
  v(0.3em)
  text(size: 20pt, weight: "bold", fill: navy)[#it.body]
  v(0.05em)
  line(length: 50pt, stroke: 2.5pt + sky)
})

#show heading.where(level: 2): it => block(breakable: false, below: 0.5em, {
  v(0.8em)
  text(size: 14pt, weight: "bold", fill: navy)[#it.body]
  v(0.05em)
  line(length: 30pt, stroke: 1.5pt + sky)
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

#show table.cell: it => {
  if it.y == 0 {
    set table.cell(fill: lgray)
    set text(weight: "semibold", fill: muted, size: 9pt)
    it
  } else {
    set table.cell(fill: if calc.odd(it.y) { white } else { lgray })
    set text(size: 9pt, hyphenate: false)
    set par(justify: false)
    it
  }
}

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

// ═══════════════════════════════════════════════════════════
// COVER PAGE with bilingual TOCs
// ═══════════════════════════════════════════════════════════
#page(header: none, footer: none, background: none)[
  #image("logo.svg", height: 36pt)
  #v(2em)

  // Title
  #text(size: 24pt, weight: "bold", fill: navy)[#doc-title]
  #if doc-title-ja != doc-title {
    v(0.3em)
    text(size: 18pt, weight: "semibold", fill: navy-mid)[#doc-title-ja]
  }
  #v(1em)

  // Client info
  #if client-display != "" {
    text(size: 11pt, fill: muted)[Prepared for / 宛先:]
    v(0.3em)
    text(size: 13pt, weight: "semibold", fill: navy)[#client-display]
    if client-display-ja != client-display {
      text(size: 13pt, weight: "semibold", fill: navy)[ / #client-display-ja]
    }
    v(0.8em)
  }

  // Date
  #text(size: 10pt, fill: muted)[#date-en #if date-ja != date-en [ / #date-ja]]
  #v(2em)

  // Separator
  #line(length: 100%, stroke: 1pt + amber)
  #v(1.5em)

  // English TOC (scoped to EN section)
  #text(size: 12pt, weight: "semibold", fill: navy)[English / 英語版]
  #v(0.5em)
  #outline(
    title: none,
    target: selector(heading).after(<en-start>).before(<ja-start>),
    depth: 3,
    indent: 1em,
  )

  #v(1.5em)

  // Japanese TOC (scoped to JA section)
  #text(size: 12pt, weight: "semibold", fill: navy)[日本語版 / Japanese]
  #v(0.5em)
  #outline(
    title: none,
    target: selector(heading).after(<ja-start>),
    depth: 3,
    indent: 1em,
  )

  #v(2em)

  // Footer on cover page
  #align(bottom)[
    #line(length: 100%, stroke: 0.3pt + drule)
    #v(4pt)
    #text(size: 7pt, fill: muted, font: "IBM Plex Sans JP")[
      © #{datetime.today().year()} eSolia Inc. — Confidential / 機密
    ]
  ]
]

// ═══════════════════════════════════════════════════════════
// CONTENT (with boundary labels injected by pipeline)
// ═══════════════════════════════════════════════════════════
#include "content.typ"
