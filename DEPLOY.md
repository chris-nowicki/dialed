# Deploy Runbook — Dialed

> **Migration note:** this documents the former standalone Rsbuild + Zephyr flow. The default `pnpm build` now creates a verified TAP package locally. Cloud publication requires configuring the TAP SDK's Zephyr publisher adapter; `pnpm build:legacy-zephyr` retains the old deployment path but does not publish the descriptor-backed package.

How Dialed ships to The AI Platform. Mini apps deploy as **immutable Module-Federation releases** published to **Zephyr Cloud**; the platform *follows* a Zephyr environment and hot-swaps the running code. Publishing **is** updating.

> **For a booth/laptop demo you may not need this at all** — `pnpm dev` + a linked Local Directory is a legitimate live demo path. Deploy only when it needs to run off your machine.

---

## Phase A — Green cloud build (local)

```bash
pnpm install
pnpm build        # must succeed — this is the release artifact
```
Confirm storage is **user-scoped** and 1–2 **sample beans are seeded** so a cold open looks alive.

## Phase B — Wire in Zephyr Cloud *(one-time)*

Deploy is handled by the Zephyr Rsbuild plugin — it hooks into `pnpm build`.

1. Install the [Zephyr Chrome extension](https://docs.zephyr-cloud.io/) (auth prereq).
2. Add the plugin:
   ```bash
   pnpm add -D zephyr-rsbuild-plugin
   ```
3. Wire it into `rsbuild.config.ts`:
   ```ts
   import { withZephyr } from 'zephyr-rsbuild-plugin';
   // plugins: [pluginReact(), withZephyr()],
   ```
   Module Federation is auto-detected; no extra config.

> ⚠️ Once `withZephyr()` is in the config, `pnpm build` is **no longer a local-only build** — it authenticates and deploys. Your next build *is* your first deploy.

## Phase C — First publish *(interactive auth on first run)*

```bash
pnpm build        # 1st run: browser pops up → sign up / log into Zephyr
```
Creds cache in `~/.zephyr`. This creates your **application record** and pushes an immutable release to the **`development`** environment (follows the moving `dev` tag, auto-advances each build). Note the org / project / application ID / version shown in the Zephyr UI.

## Phase D — Environments (Zephyr Cloud UI)

- **`development`** — follows the `dev` tag. Auto-updates on each build.
- **`production`** — locked, **pinned to one specific immutable version**. Builds cannot touch it; you promote deliberately.

## Phase E — Point the platform at the cloud

**Settings → Miniapps** → switch source from *Local Directory* to **Zephyr Cloud** → pick **org → project → app → environment** → enable **Follow updates** → activation mode:
- **OTA** — hot-swaps the running realm, no restart.
- **Next launch** — applies on reopen.

Open Dialed and confirm it's running **from the cloud**, not the linked local dir.

## Phase F — Demo hardening

- Test a **cold open** (seeded state looks credible).
- If possible, open on a **second account** to confirm user-scoped isolation.
- **Keep Local Directory linked as a fallback** — if the cloud hiccups at the booth, flip the source back and demo locally.

## Rollback

Re-pin `production` (or `development`) to the last known-good version in Zephyr Cloud. The platform retains the last good version if an activation fails.

---

## ⚠️ Do the dry run early

The only unpredictable part is **Phase B/C** — Zephyr auth and the first authenticated build. Shake that out **days before**, not demo morning. After that, deploy day is just `pnpm build` → confirm → done.
