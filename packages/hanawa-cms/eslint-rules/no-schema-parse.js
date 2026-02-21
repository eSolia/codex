// eslint-rules/no-schema-parse.js
// Enforces safeParse() over parse() for schema validation
export const noSchemaParse = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer safeParse() over parse() for schema validation',
    },
    messages: {
      useSafeParse:
        'Use .safeParse() instead of .parse() for explicit error handling. If you intentionally want to throw, add a suppression comment. See SVELTEKIT_BACKPRESSURE.md § Layer 1.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'parse'
        ) {
          const objText = context.getSourceCode().getText(node.callee.object);
          if (
            objText.match(/Schema$/i) ||
            objText.match(/^z\./) ||
            objText.match(/\.object\(/) ||
            objText.match(/\.string\(/) ||
            objText.match(/\.array\(/)
          ) {
            context.report({ node: node.callee.property, messageId: 'useSafeParse' });
          }
        }
      },
    };
  },
};
