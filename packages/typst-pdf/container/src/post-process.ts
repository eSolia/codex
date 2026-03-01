/**
 * Post-Process Pandoc Typst Output
 *
 * Replicates the sed transforms from tools/md-to-pdf/generate.sh:
 * 1. table.header(repeat: true, ...) — headers repeat across page breaks
 * 2. Column percentages → 1fr — responsive widths
 * 3. Images → width: 85%
 * 4. PDFTYPSTPAGEBREAK → #pagebreak()
 * 5. Prepend horizontalrule compat function
 */

/** horizontalrule compat block (pandoc emits this for ---) */
const COMPAT_HEADER = `// Pandoc compatibility
#let horizontalrule = {
  v(0.4em)
  line(length: 100%, stroke: 0.5pt + rgb("#CCCCCC"))
  v(0.4em)
}

`;

/**
 * Apply all post-processing transforms to pandoc's Typst output.
 */
export function postProcess(typstContent: string): string {
  let result = typstContent;

  // 1. Make table headers repeat across page breaks
  result = result.replace(/table\.header\(/g, 'table.header(repeat: true, ');

  // 2. Replace percentage column widths with 1fr (only on lines containing "columns:")
  result = result.replace(
    /^(.*columns:.*)$/gm,
    (line) => line.replace(/[\d.]+%/g, '1fr')
  );

  // 3. Constrain images to 85% width
  result = result.replace(
    /#box\(image\("([^"]+)"\)\)/g,
    '#box(image("$1", width: 85%))'
  );

  // 4. Replace pagebreak markers
  result = result.replace(/PDFTYPSTPAGEBREAK/g, '#pagebreak()');

  // 5. Prepend compatibility header
  result = COMPAT_HEADER + result;

  return result;
}

/**
 * Pre-process markdown before pandoc conversion.
 * Converts HTML pagebreak comments to a marker that survives pandoc.
 */
export function preProcessMarkdown(markdown: string): string {
  return markdown.replace(
    /^\s*<!--\s*pagebreak\s*-->\s*$/gm,
    'PDFTYPSTPAGEBREAK'
  );
}
