# ☕ Dialed

**A coffee dial-in coach that learns your beans, your grinder, and your taste — and gets you to a great cup in fewer brews.**

Dialed is a [mini app for The AI Platform](https://theaiplatform.app). Tell it what bean you're brewing; it researches the roast, proposes a starting recipe for your **Fellow Aiden**, and then — as you taste — walks you one adjustment at a time toward the perfect cup. When it's dialed, anyone in the house can pull up the **Brew It** checklist and make it perfectly.

---

## The problem

Dialing in a new bag of coffee is guesswork. You brew, it's sour, you grind finer, now it's bitter, you overshoot, you waste beans, and you never quite learn *why*. Dialed turns that into a guided, converging loop that behaves like a patient barista looking over your shoulder.

## How it works

### 1. 🔍 Research the bean
Type the roaster and bean. Dialed researches roast level, origin, and process, then derives a **starting recipe** — grind, temperature, ratio, bloom — with the numbers set for *your* gear. Single serve, small batch, and large batch each keep an independent grind history.

### 2. 🎯 Dial In (the coach)
Brew it, taste it, tap how it landed:

| You taste… | Dialed knows… | It changes… |
|---|---|---|
| **Sour / sharp** | under-extracted | grind **finer** |
| **Bitter / harsh** | over-extracted | grind **coarser** |
| **Weak / watery** | under-strength | more coffee (tighten ratio) |
| **Strong / muddy** | over-strength | less coffee (loosen ratio) |

For the original stepped Fellow Opus, Dialed uses Fellow's Aiden starting points: **6.5** for single serve, **8** for small batch, and **10.5** for large batch. Single serve stores bloom and every pulse temperature separately; both batch sizes share the Aiden profile's batch temperature while retaining independent grind targets.

It changes **one variable at a time**—grind for extraction, ratio for strength—and once you've crossed from sour to bitter it **brackets** the grind, narrowing in on the sweet spot like a binary search. Temperature schedules stay under explicit user control because tasting the finished cup cannot reliably identify one pulse to change.

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
- **Rslib + Module Federation** — builds an immutable, descriptor-backed TAP package
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
| `pnpm build` | Build and verify the local TAP package in `dist/` |
| `pnpm check:tap` | Run the complete TAP build and verification path without replacing `dist/` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm preview` | Preview a production build |

### Deploy

`pnpm build` is local-only: it assembles `dist/manifest.tap.json`, the desktop/mobile Federation targets, integrity locks, and the host surface shell. A TAP publisher adapter still needs to be configured before `tap-miniapp publish` can send this package to Zephyr Cloud. The former standalone Rsbuild + Zephyr path remains available as `pnpm build:legacy-zephyr`, but it does not produce a descriptor-backed TAP package.

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

Photo-of-bag OCR input · more brew methods (Chemex, V60) and grinders · a shared, searchable community recipe database · possibly a standalone consumer app.

---

*Built for the demo. Designed for the long haul.* ☕
