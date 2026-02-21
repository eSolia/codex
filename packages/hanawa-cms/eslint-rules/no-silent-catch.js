// eslint-rules/no-silent-catch.js
// Prevents swallowing errors with empty catch blocks
export const noSilentCatch = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow empty catch blocks that swallow errors',
    },
    messages: {
      silentCatch:
        'Empty catch block silently swallows errors. Log the error, rethrow, or handle it explicitly.',
    },
    schema: [],
  },
  create(context) {
    return {
      CatchClause(node) {
        if (node.body.type === 'BlockStatement' && node.body.body.length === 0) {
          context.report({ node, messageId: 'silentCatch' });
        }
      },
    };
  },
};
