// eslint-rules/no-binding-leak.js
// InfoSec: Prevents leaking Cloudflare bindings to the client
export const noBindingLeak = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow returning platform.env bindings from load functions',
    },
    messages: {
      bindingLeak:
        'Do not return platform.env bindings to the client. Query the binding and return the data instead. See SVELTEKIT_GUIDE.md § Cloudflare Integration.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename();
    if (!filename.match(/\+(page|layout)\.server\.(ts|js)$/)) {
      return {};
    }

    return {
      ReturnStatement(node) {
        if (!node.argument || node.argument.type !== 'ObjectExpression') return;

        for (const prop of node.argument.properties) {
          if (prop.type !== 'Property') continue;

          const value = prop.value;
          if (
            value.type === 'MemberExpression' &&
            context.getSourceCode().getText(value).includes('platform.env')
          ) {
            context.report({ node: prop, messageId: 'bindingLeak' });
          }
        }
      },
    };
  },
};
