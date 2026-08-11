import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig(async ({ command }) => {
  const zephyrPlugins = command === "build"
    ? [(await import("zephyr-rsbuild-plugin")).withZephyr()]
    : [];

  return {
    // withZephyr() makes `pnpm build` publish an immutable release to Zephyr Cloud.
    // The dynamic import keeps Zephyr entirely out of local dev and preview commands.
    plugins: [
      pluginReact(),
      ...zephyrPlugins,
    ],
    source: {
      entry: {
        index: "./src/index.tsx",
      },
      alias: {
        "@": "./src",
      },
      // NOTE: we deliberately do NOT inline OPENAI_API_KEY into the client bundle.
      // A mini app is client-side code — a bundled key is a public key. The key is
      // provided at runtime via the Settings screen (localStorage). See research.ts.
    },
    html: {
      template: "./src/index.html",
    },
    output: {
      distPath: {
        root: "dist",
      },
    },
    server: {
      port: 3000,
    },
  };
});
