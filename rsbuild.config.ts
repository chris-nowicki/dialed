import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  // withZephyr() makes `pnpm build` publish an immutable release to Zephyr Cloud.
  // First run opens a browser to authenticate; creds cache in ~/.zephyr. See DEPLOY.md.
  plugins: [pluginReact(), withZephyr()],
  source: {
    entry: {
      index: './src/index.tsx',
    },
    alias: {
      '@': './src',
    },
    // NOTE: we deliberately do NOT inline OPENAI_API_KEY into the client bundle.
    // A mini app is client-side code — a bundled key is a public key. The key is
    // provided at runtime via the Settings screen (localStorage). See research.ts.
  },
  html: {
    template: './src/index.html',
  },
  output: {
    distPath: {
      root: 'dist',
    },
  },
  server: {
    port: 3000,
  },
});
