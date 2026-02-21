// eslint-rules/no-raw-db-prepare.js
// InfoSec: Guides new code toward site-scoped query helpers (OWASP A01 - Access Control)
export const noRawDbPrepare = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Discourage direct db.prepare() calls in routes — prefer site-context helpers',
    },
    messages: {
      useHelper:
        'Prefer site-context helpers (siteFirst, siteAll, unscopedFirst, etc.) over raw db.prepare(). See $lib/server/site-context.ts.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        // Match: *.prepare(...)
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'prepare'
        ) {
          return;
        }

        // Check if the argument looks like a SQL string
        const args = node.arguments;
        if (args.length === 0) return;

        const firstArg = args[0];
        const isSqlString =
          (firstArg.type === 'Literal' && typeof firstArg.value === 'string') ||
          firstArg.type === 'TemplateLiteral';

        if (!isSqlString) return;

        context.report({ node, messageId: 'useHelper' });
      },
    };
  },
};
