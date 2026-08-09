import { defineConfig, loadEnv } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

const { publicVars } = loadEnv({ prefixes: ['OPENAI_'] });

export default defineConfig({
  plugins: [pluginReact()],
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
