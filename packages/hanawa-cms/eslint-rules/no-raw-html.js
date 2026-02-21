// eslint-rules/no-raw-html.js
// InfoSec: Prevents unsanitized {@html} usage (OWASP A03 - Injection)
export const noRawHtml = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow {@html} without sanitizeHtml() wrapper',
    },
    messages: {
      unsanitized:
        'Raw HTML rendering detected. Wrap with sanitizeHtml(), sanitizeComment(), nlToBr(), highlightSearchMatch(), or renderContent() from $lib/sanitize. See SVELTEKIT_GUIDE.md § XSS Prevention.',
    },
    schema: [],
  },
  create(context) {
    return {
      SvelteRawMustacheTag(node) {
        const expr = node.expression;

        // Allow: {@html sanitizeHtml(x)}, {@html nlToBr(x)}, etc.
        if (
          expr.type === 'CallExpression' &&
          expr.callee.type === 'Identifier' &&
          [
            'sanitizeHtml',
            'nlToBr',
            'sanitizeComment',
            'highlightSearchMatch',
            'renderContent',
          ].includes(expr.callee.name)
        ) {
          return;
        }

        context.report({ node, messageId: 'unsanitized' });
      },
    };
  },
};
