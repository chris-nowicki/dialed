import packageJson from "./package.json" with { type: "json" };
import { defineTapMiniapp } from "@theaiplatform/miniapp-sdk/authoring";
import { commandTargetBuilder } from "@theaiplatform/miniapp-sdk/lifecycle";

const surfaceExpose = "./ui/dialed";
const targetBuilder = commandTargetBuilder({
  command: "pnpm",
  args: ["run", "build:target"],
});

export default defineTapMiniapp({
  release: { version: packageJson.version },
  identity: {
    packageId: "dialed",
    publisherId: "chris-nowicki",
    namespace: "chris-nowicki",
    slug: "dialed",
  },
  presentation: {
    name: "Dialed",
    description: "Coffee dial-in coach for Fellow Aiden + Opus V1 grinder",
    categories: ["utilities"],
  },
  compatibility: { tapHost: ">=1.0.0" },
  lifecycle: {
    checkpoint: "retained",
    lifecycleExpose: surfaceExpose,
  },
  targets: {
    desktop: {
      remoteName: "dialed_desktop",
      exposes: {
        [surfaceExpose]: { source: "./src/surface.tsx", runtime: "webview" },
      },
      builder: targetBuilder,
    },
    mobile: {
      remoteName: "dialed_mobile",
      exposes: {
        [surfaceExpose]: { source: "./src/surface.tsx", runtime: "webview" },
      },
      builder: targetBuilder,
    },
  },
  contributions: [
    {
      kind: "ui.surface",
      id: "dialed-ui",
      apiVersion: 1,
      lifecycleScope: "mount",
      options: {
        displayName: "Dialed",
        description: "Dial in coffee and get step-by-step brew instructions",
        placement: "workspace-left",
        scope: "user",
        instancePolicy: "per-mount",
        persistence: "retained",
      },
      authorization: {
        onDemand: [
          "network.request",
          "credentials.read",
          "credentials.use",
        ],
        effects: [
          { kind: "host-http", resources: ["https://api.openai.com"] },
          { kind: "host-api", resources: ["tap.credentials:read"] },
          { kind: "credentials", resources: ["tap.credentials:use"] },
        ],
      },
      targets: {
        desktop: { expose: surfaceExpose, runtime: "webview" },
        mobile: { expose: surfaceExpose, runtime: "webview" },
      },
    },
    {
      kind: "permission.catalog",
      id: "dialed-permissions",
      apiVersion: 1,
      options: {
        actions: [
          {
            id: "network.request",
            resource: "network",
            scopes: ["user"],
            directActors: ["human"],
            delegatedActors: [],
            autonomyCeiling: "do",
            consent: "reusable",
            risk: "consequential",
          },
          {
            id: "credentials.read",
            resource: "tap.credentials:read",
            scopes: ["user"],
            directActors: ["human"],
            delegatedActors: [],
            autonomyCeiling: "do",
            consent: "reusable",
            risk: "read",
          },
          {
            id: "credentials.use",
            resource: "tap.credentials:use",
            scopes: ["user"],
            directActors: ["human"],
            delegatedActors: [],
            autonomyCeiling: "do",
            consent: "reusable",
            risk: "consequential",
          },
        ],
      },
    },
  ],
});
