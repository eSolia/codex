import adapter from "@sveltejs/adapter-cloudflare";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// InfoSec: Disable remote platform proxy in CI to avoid auth requirement during build
const isCI = process.env.CI === "true";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      routes: {
        include: ["/*"],
        exclude: ["<all>"],
      },
      // Skip platformProxy in CI to avoid remote auth requirement during build
      ...(isCI
        ? {}
        : {
            platformProxy: {
              configPath: "wrangler.jsonc",
              experimentalJsonConfig: true,
              persist: true,
            },
          }),
    }),
    alias: {
      $lib: "./src/lib",
      $components: "./src/lib/components",
      $server: "./src/lib/server",
    },
    // Disable prerendering in CI to avoid platform proxy auth requirement
    prerender: {
      entries: isCI ? [] : ["*"],
    },
  },
};

export default config;
