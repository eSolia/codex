import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// InfoSec: Disable remote platform proxy in CI to avoid auth requirement during build
const isCI = process.env.CI === 'true';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'],
      },
      // In CI, use minimal config without bindings to avoid remote auth requirement
      platformProxy: isCI
        ? {
            configPath: 'wrangler.ci.jsonc',
            experimentalJsonConfig: true,
            persist: { path: '.wrangler/state' },
          }
        : {
            configPath: 'wrangler.jsonc',
            experimentalJsonConfig: true,
            persist: true,
          },
    }),
    alias: {
      $lib: './src/lib',
      $components: './src/lib/components',
      $server: './src/lib/server',
    },
    // InfoSec: CSP with automatic nonces for inline scripts (OWASP A03)
    // Eliminates 'unsafe-inline' from script-src via SvelteKit's built-in nonce injection
    csp: {
      directives: {
        'default-src': ['self'],
        'script-src': ['self', 'https://static.cloudflareinsights.com'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'img-src': ['self', 'data:', 'https:'],
        'connect-src': ['self', 'https://cloudflareinsights.com'],
        'frame-ancestors': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
    // Disable prerendering in CI to avoid platform proxy auth requirement
    prerender: {
      entries: isCI ? [] : ['*'],
    },
  },
};

export default config;
