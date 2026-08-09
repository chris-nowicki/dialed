# PRD — Coffee Dial-In Mini App (working name: **Dialed**)

**Platform:** [theaiplatform.app](https://theaiplatform.app) mini app
**Author:** Chris Nowicki
**Date:** 2026-08-08
**Milestone:** Contest demo — conference, Wed 2026-08-13 (1:1 booth demo to platform CEO)
**Status:** Draft for build

---

## 1. Summary

Dialed is a mini app that helps dial in coffee on a **Fellow Aiden** brewer, using a **Fellow Opus V1** grinder. You tell it what bean you're brewing; it researches the bean and proposes a starting recipe (grind, temperature, ratio, bloom). Then, as you taste, you tell it the cup is *sour, bitter, weak,* or *strong*, and it walks you — one variable at a time — toward a great cup, using a barista's bracketing method to converge on the right grind.

The app has two front doors:

- **Dial In** — the coach. Research a bean, get a starting recipe, program it into the Aiden as a profile, then iterate on taste.
- **Brew It** — the instructions. A no-thinking, kitchen-friendly checklist for anyone (e.g. a partner) to brew a already-dialed-in bean correctly.

Every dialed-in recipe is saved locally, building a personal database of beans and settings — the seed of a future shared, searchable reference.

## 2. Goals & non-goals

### Goals (Wednesday)
- Demo the **taste-feedback dial-in loop** as the centerpiece: legible, one-variable-at-a-time, visibly converging.
- Make **live bean research** feel real and produce a credible starting recipe.
- Show the **Brew It** instructions path working off a saved recipe.
- Prove the **microns-canonical grind engine** produces real, dialable Opus settings.

### Non-goals (roadmap, explicitly out)
- Single-serve mode with per-pour temperatures (schema models it; loop does not drive it).
- Photo-of-bag OCR input.
- Other brew methods (Chemex, V60) and other grinders (schema supports; none seeded but Aiden + Opus V1).
- Shared/public database, multi-user, accounts.
- Bloom / pulse-count as loop-adjustable levers (stored & shown, not auto-tuned).
- Any Bluetooth control of the Aiden — **the app coaches, it never controls the machine.**
- Localization beyond a °C/°F toggle.

## 3. Users

- **The dialer (Chris):** wants to reach a great cup on a new bean in fewer brews, and learn *why*.
- **The brewer (e.g. partner):** wants to make a good cup of an already-dialed-in bean without decisions — just follow steps.

## 4. Context & constraints

- **Brewer:** Fellow Aiden. The app does **not** talk to the machine. During dial-in the user programs a **named profile** into the Aiden by hand; the app tells them what to set and stores a mirror of that profile.
- **Grinder:** Fellow Opus V1, original burrs. Outer dial 1.00–11.00 in **0.25 steps** (41 positions), ~230–1160µm.
- **Aiden profile shape** (from the Fellow app): one profile per bean holds **shared** settings (coffee-to-water ratio, bloom on/ratio/time/temp, cold-brew flag) plus **two pulse blocks** — Single Serve (multiple pulses, per-pulse temperatures) and Batch (usually one pulse). Brew *size* selects which block runs. **Batch = one pulse ≈ one temperature**, which is the mode the demo uses.
- **Demo environment:** booth, 1:1 with CEO, phone tethered for reliable internet. Live research is an asset here, de-risked by a validated fallback bean + graceful degrade.

## 5. Core concepts

### 5.1 Microns as the canonical grind unit
The single most important architecture decision. Grind is stored and reasoned about internally in **microns**. Each grinder model carries a **settings↔microns mapping**. Recommendations are computed in microns, then **snapped to the nearest achievable dial position** for display (nearest 0.25 on the Opus, e.g. `6.25`).

Why:
- The loop reasons in microns ("go ~60µm finer") and renders in *your* grinder's dial.
- The Ode-Gen-2-vs-Opus problem collapses to two mappings onto one micron axis.
- The future vision — others search the shared DB and get numbers **for their** grinder — works for free.

**Honesty caveat (bake into UI copy):** public micron ranges are approximate and vary unit-to-unit. The micron map is a *smart starting guess*, seeded from public ranges and **corrected over time by real dialed-in recipes**. The taste loop exists precisely to close that gap. Never present a converted number as precise truth.

### 5.2 Hybrid brain: LLM classifies, rules decide
- **LLM** does open-ended work: research the bean, classify it (roast level, density, origin, process), narrate *why* an adjustment is happening in friendly language, and classify free-text taste descriptions into a bucket.
- **Deterministic rules** own every number: the starting-grind lookup, the taste→adjustment mapping, and the bracketing math. The LLM **never invents a grind number.** This keeps the loop coherent, debuggable, and demo-safe.

### 5.3 One variable at a time
Adjustments follow a fixed priority: **grind → temperature → ratio.** The app holds a dial-in session and changes exactly one lever per iteration, so every brew is a clean data point and the user learns the cause/effect.

### 5.4 Bracketing on grind
Grind is the primary lever and uses binary-search convergence:
- Track each grind value tried and its taste result within the session.
- Once the session has tasted on **both sides** (a sour result at a coarser-than-ideal setting and a bitter result at a finer-than-ideal setting — i.e. an upper and lower micron bound), **halve the step** and aim between them.
- Steps are always whole dial clicks (0.25 or 0.5 on the Opus) so every instruction is physically settable.
- Temperature and ratio use simple fixed steps (they're secondary/tertiary).

## 6. Data model

Local/app-scoped storage now; schema shaped for shared/sellable later (`createdBy`, `visibility` ride along, always `private` for v1).

- **Bean** — `id, roaster, name, origin, roast (light|medium|dark), process, tastingNotes[], sourceCitations[], createdBy, visibility`
- **BrewMethod** — reference data. Seeded: `Aiden`. (Chemex, V60… later.)
- **Grinder** — reference data with settings↔microns mapping. Seeded: `Opus V1 (orig burrs)`. Fields: `id, name, minMicron, maxMicron, stepNotation, mapFn`.
- **Recipe** — one per Bean per BrewMethod. Mirrors the Aiden profile:
  - `aidenProfileName` (usually the bean name)
  - `ratio` (shared, e.g. 1:16)
  - `coldBrew: bool`
  - `bloom: { enabled, ratio, timeSec, tempF }`
  - `singleServe: { numPulses, timeBetweenSec, pulseTempsF[] }` *(modeled, not loop-driven in v1)*
  - `batch: { numPulses, timeBetweenSec, pulseTempsF[] }` *(demo mode)*
  - `grindMicron` **(canonical)** + derived `grindDisplay` (e.g. "6.25") per brew size
  - `dose` (g), `status (starting|dialed-in)`
- **DialInSession** — `id, recipeId, events[]` where each event is `{ grindMicron, tempF, ratio, tasteResult, timestamp }`. Holds the bracketing history + taste log; drives the convergence visualization.

## 7. Features

### 7.1 Home
Two large buttons — **☕ Dial In** and **📋 Brew It** — plus a short list of saved beans. Mobile-first webview. °C/°F toggle in settings.

### 7.2 Dial In (the coach)
1. **Pick / add bean** — type name & roaster (or pick an existing bean).
2. **Research** — live LLM + web lookup. Produces a **Bean Card**: roast, origin, process, tasting notes, with citations. Graceful degrade: on failure, derive a starting recipe from roast level alone.
3. **Starting recipe** — rules pick the starting grind from `(brewSize, roastLevel)` (Opus V1 table, seeded from Fellow guidance + your anchors), temp from roast, ratio, bloom. Shown as concrete numbers.
4. **Program-to-Aiden checklist** — "Create a profile named *[bean]*; set ratio X, bloom Y, batch pulse temp Z…" The user programs the Aiden by hand.
5. **Brew & taste** — after brewing, four taste buttons **(sour / bitter / weak / strong)** + **just right** + optional free-text (LLM classifies into a bucket).
6. **Adjustment card** — one-variable change with narration: *"Sour → under-extracted. Go Opus 6.50 → 6.25 (~25µm finer). Keep everything else. Re-brew."*
7. **Convergence visualization (hero screen)** — a number line showing the sour-side and bitter-side bounds narrowing toward the sweet spot as the session progresses.
8. Loop until **Just right** → recipe saved with `status: dialed-in`.

### 7.3 Brew It (the instructions)
For anyone to brew a dialed-in bean, kitchen-friendly, one step per screen with a checkbox:
1. Pick a saved bean.
2. Pick brew size (single/batch) — demo uses batch.
3. Checklist, values pulled from the saved recipe:
   - On the Aiden, select profile **"[bean]"**
   - Set the **Opus** grinder to **[grindDisplay]**
   - Weigh **[dose] g** beans, grind
   - Put in filter
   - Ensure water is filled
   - Hit **Start** — the Aiden runs the saved profile
Content is **template-driven** (only the bolded values come from the recipe) — deterministic, identical every time.

## 8. Rules reference (v1)

**Taste → adjustment (one lever, in priority order):**

| Taste input | Axis | Action |
|---|---|---|
| Sour / sharp | extraction (under) | grind **finer** (primary); then raise temp |
| Bitter / harsh | extraction (over) | grind **coarser** (primary); then lower temp (→ ~195°F) |
| Weak / watery / thin | strength | tighten **ratio** (more coffee) |
| Strong / muddy | strength | loosen **ratio** (less coffee) |
| Just right | — | end session, save recipe |

**Reference numbers:** temp by roast — light 200–205°F (93–96°C), dark 195–200°F (91–93°C). Grind by size — larger batch → coarser. Grinder ranges — Opus V1 ~230–1160µm (0.25 steps); Ode Gen 2 ~275–1160µm (same setting number is coarser than Opus).

## 9. UX principles
- One action per screen; big text; kitchen-friendly.
- Buttons over free text wherever the flow could go off-script.
- Always show a **real, dialable** number, never microns.
- Narrate the *why* on every adjustment — the app teaches, not just tells.

## 10. Success criteria (demo)
- CEO names (or picks) a bean → research returns a credible Bean Card + starting recipe in seconds.
- A simulated/real taste input produces a correct, single-variable adjustment with clear narration.
- The convergence visualization visibly narrows across 2–3 iterations.
- Brew It renders a clean, correct checklist for a saved bean.
- Nothing visibly breaks if the network hiccups (fallback bean / graceful degrade).

## 11. Open questions / to calibrate
- Seed the Opus V1 starting-grind table with Chris's own known-good recipes (first anchor: capture the grind used for a known-good batch).
- Confirm exact Opus micron-per-0.25-step once calibrated against real recipes (public specs are approximate).
- Working app name — **Dialed** is a placeholder.

## 12. Roadmap (post-contest)
Single-serve + per-pour temps · photo-of-bag OCR · more brew methods & grinders · shared searchable database · sync/accounts · possibly a standalone consumer app (long term).
