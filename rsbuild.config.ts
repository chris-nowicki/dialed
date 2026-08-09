import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rsbuild-plugin';

const { publicVars } = loadEnv({ prefixes: ['OPENAI_'] });

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
    define: publicVars,
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
