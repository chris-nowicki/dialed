# ☕ Dialed

**A coffee dial-in coach that learns your beans, your grinder, and your taste — and gets you to a great cup in fewer brews.**

Dialed is a [mini app for The AI Platform](https://theaiplatform.app). Tell it what bean you're brewing; it researches the roast, proposes a starting recipe for your **Fellow Aiden**, and then — as you taste — walks you one adjustment at a time toward the perfect cup. When it's dialed, anyone in the house can pull up the **Brew It** checklist and make it perfectly.

---

## The problem

Dialing in a new bag of coffee is guesswork. You brew, it's sour, you grind finer, now it's bitter, you overshoot, you waste beans, and you never quite learn *why*. Dialed turns that into a guided, converging loop that behaves like a patient barista looking over your shoulder.

## How it works

### 1. 🔍 Research the bean
Type the roaster and bean. Dialed researches roast level, origin, and process, then derives a **starting recipe** — grind, temperature, ratio, bloom — with the numbers set for *your* gear.

### 2. 🎯 Dial In (the coach)
Brew it, taste it, tap how it landed:

| You taste… | Dialed knows… | It changes… |
|---|---|---|
| **Sour / sharp** | under-extracted | grind **finer** |
| **Bitter / harsh** | over-extracted | grind **coarser** (or cooler) |
| **Weak / watery** | under-strength | more coffee (tighten ratio) |
| **Strong / muddy** | over-strength | less coffee (loosen ratio) |

It changes **one variable at a time** (grind → temp → ratio), and once you've crossed from sour to bitter it **brackets** — narrowing in on the sweet spot like a binary search, with a live visualization of the bracket closing. Say **"just right"** and the recipe is saved.

### 3. 📋 Brew It (the instructions)
Anyone can pick a dialed-in bean and follow a kitchen-friendly, one-step-at-a-time checklist: select the Aiden profile, set the grinder, weigh, brew. No decisions, no guesswork.

---

## The clever bit: microns are the source of truth

Grinders don't agree with each other — "6" on a Fellow Opus is not "6" on an Ode. So Dialed never stores a dial number. It stores **microns**, and every grinder carries its own settings ↔ micron mapping.

- The loop reasons in microns ("go ~25 µm finer") and renders it as **your** grinder's real, clickable setting.
- Cross-grinder conversion is free — same recipe, different mapping.
- Public micron specs are a *starting guess*; every dial-in you finish calibrates the map further. **The app gets smarter with use.**

> Honesty note baked into the UI: converted numbers are smart starting points, not lab-precise truth. The taste loop exists to close that gap.

---

## Tech stack

- **The AI Platform Miniapp SDK** (`@theaiplatform/miniapp-sdk`) — webview surface, user-scoped storage, agent + network capabilities
- **React 19 + TypeScript**
- **Rsbuild** (Module Federation) — builds an immutable, hot-swappable release
- **pnpm** (enforced — `npm`/`yarn` are blocked)
- Delivered via **Zephyr Cloud** with live/OTA updates

## Getting started

**Prerequisites:** Node ≥ 20, pnpm ≥ 10.33, and The AI Platform desktop app.

```bash
pnpm install
pnpm dev          # builds + watches, hot-updates in the platform
```

Then link it once: **The AI Platform → Settings → Miniapps → add Local Directory → point at `dist/`**, and open Dialed from the workspace nav. Edits rebuild and hot-swap automatically.

Set your research key in a local `.env` (never committed):

```bash
OPENAI_API_KEY=sk-...
```

### Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev build + watch, linked into the platform |
| `pnpm build` | Production immutable release (→ Zephyr Cloud) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm preview` | Preview a production build |

### Deploy

`pnpm build` publishes an immutable release to Zephyr Cloud; the platform *follows* your `development` environment and hot-swaps it. Promote to `production` by pinning the verified version. See [`DEPLOY.md`](./DEPLOY.md) for the full runbook.

## Project structure

```
src/
  grindEngine.ts        # microns ↔ grinder-setting mapping, the loop's math
  research.ts           # bean research → starting recipe
  storage.ts            # user-scoped persistence
  types.ts              # Bean, Recipe, DialInSession, Grinder…
  surface.tsx           # mini app entry / surface mount
  AppContext.tsx        # app state
  screens/              # Home, AddBean, Researching, Dial-In loop, Brew It…
  components/           # GrindDial gauge, GuidedBrewFlow…
PRD.md                  # product requirements & design decisions
```

## Roadmap

Single-serve mode with per-pour temperatures · photo-of-bag OCR input · more brew methods (Chemex, V60) and grinders · a shared, searchable community recipe database · possibly a standalone consumer app.

---

*Built for the demo. Designed for the long haul.* ☕
