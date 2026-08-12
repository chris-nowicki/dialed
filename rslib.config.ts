import { defineConfig } from "@rslib/core";
import { tapLifecycleTarget } from "@theaiplatform/miniapp-sdk/rspack";

const tapTarget = tapLifecycleTarget();

export default defineConfig({
  lib: [
    {
      ...tapTarget,
      output: {
        ...tapTarget.output,
        // TAP packages are hosted below an installation-specific path. An
        // absolute "/" prefix makes async CSS load from the server root.
        assetPrefix: "",
      },
    },
  ],
});
