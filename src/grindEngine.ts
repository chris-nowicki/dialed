/**
 * Grind Engine — microns as the canonical unit.
 *
 * All recommendations are computed in microns, then snapped to the nearest
 * achievable dial position for display.
 *
 * HONESTY CAVEAT: public micron ranges are approximate and vary unit-to-unit.
 * The micron map is a smart starting guess seeded from public specs. The taste
 * loop corrects it over time. Never present a converted number as precise truth.
 */

import type { GrinderModel, RoastLevel, BrewSize, TasteResult } from './types';

// ─── Opus V1 Mapping ──────────────────────────────────────────────────────────
// Dial: 1.00 – 11.00 in 0.25 steps (41 positions)
// Microns: ~230 – 1160µm (linear approximation from Fellow public specs)
// Slope: (1160 - 230) / (11.0 - 1.0) = 93µm per full dial unit = 23.25µm per 0.25 step

const OPUS_MIN_DIAL = 1.0;
const OPUS_MAX_DIAL = 11.0;
const OPUS_DIAL_STEP = 0.25;
const OPUS_MIN_MICRON = 230;
const OPUS_MAX_MICRON = 1160;
const OPUS_MICRONS_PER_UNIT = (OPUS_MAX_MICRON - OPUS_MIN_MICRON) / (OPUS_MAX_DIAL - OPUS_MIN_DIAL); // 93

function opusDialToMicron(dial: number): number {
  const clamped = Math.max(OPUS_MIN_DIAL, Math.min(OPUS_MAX_DIAL, dial));
  return Math.round(OPUS_MIN_MICRON + (clamped - OPUS_MIN_DIAL) * OPUS_MICRONS_PER_UNIT);
}

function opusMicronToDial(micron: number): number {
  const rawDial = OPUS_MIN_DIAL + (micron - OPUS_MIN_MICRON) / OPUS_MICRONS_PER_UNIT;
  const clamped = Math.max(OPUS_MIN_DIAL, Math.min(OPUS_MAX_DIAL, rawDial));
  // Snap to nearest 0.25 step
  const snapped = Math.round(clamped / OPUS_DIAL_STEP) * OPUS_DIAL_STEP;
  return parseFloat(snapped.toFixed(2));
}

export const OPUS_V1: GrinderModel = {
  id: 'opus-v1',
  name: 'Fellow Opus V1 (orig burrs)',
  minMicron: OPUS_MIN_MICRON,
  maxMicron: OPUS_MAX_MICRON,
  dialStep: OPUS_DIAL_STEP,
  dialMin: OPUS_MIN_DIAL,
  dialMax: OPUS_MAX_DIAL,
  dialToMicron: opusDialToMicron,
  micronToDial: opusMicronToDial,
};

export const GRINDERS: Record<string, GrinderModel> = {
  'opus-v1': OPUS_V1,
};

// ─── Starting Recipe Lookup ───────────────────────────────────────────────────
// Seeded from Fellow guidance + PRD anchors.
// Table: (roastLevel, brewSize) → starting dial position on Opus V1

const STARTING_DIAL_TABLE: Record<RoastLevel, Record<BrewSize, number>> = {
  light:  { single: 6.0,  batch: 6.5  },
  medium: { single: 5.75, batch: 6.25 },
  dark:   { single: 5.25, batch: 5.75 },
};

/** Temperature by roast (°F) — midpoint of PRD ranges */
const STARTING_TEMP_TABLE: Record<RoastLevel, number> = {
  light:  203, // 200–205°F
  medium: 200, // 198–202°F
  dark:   197, // 195–200°F
};

/** Default ratio (1:X) */
const DEFAULT_RATIO = 16;

// ─── Cups & Dose ──────────────────────────────────────────────────────────────
// The Aiden defines a "cup" as ~5 oz of water and displays a ratio-based dose in
// grams for the chosen cup count. We mirror that so our number matches its screen.
// Confirmed from the device: 4.5 cups = 22.5 oz, add 42.1 g → ~1:15.8.

const OZ_PER_CUP = 5;
const ML_PER_OZ = 29.5735;
/** mL of water per Aiden "cup" (≈147.9) */
export const ML_PER_CUP = OZ_PER_CUP * ML_PER_OZ;

/** Cup-count range + default per basket (cone = single 1–3 cups, flat = batch 4–10) */
export const BASKET_CUPS: Record<BrewSize, { min: number; max: number; step: number; default: number }> = {
  single: { min: 1, max: 3, step: 0.5, default: 2 },
  batch: { min: 4, max: 10, step: 0.5, default: 6 },
};

/** Grams of coffee to weigh for `cups` at a 1:`ratio` brew (matches the Aiden). */
export function computeDose(cups: number, ratio: number): number {
  const water = cups * ML_PER_CUP; // grams of water ≈ mL
  return Math.round((water / ratio) * 10) / 10;
}

/** Water volume in fluid ounces for a cup count (as the Aiden shows it). */
export function cupsToOz(cups: number): number {
  return Math.round(cups * OZ_PER_CUP * 10) / 10;
}

/** Default dose (g) — legacy seed fallback */
const DEFAULT_DOSE = computeDose(BASKET_CUPS.batch.default, DEFAULT_RATIO);

export interface StartingRecipeParams {
  roast: RoastLevel;
  brewSize: BrewSize;
  grinderId?: string;
}

export interface StartingRecipeNumbers {
  grindMicron: number;
  grindDisplay: string;
  tempF: number;
  ratio: number;
  dose: number;
  bloomEnabled: boolean;
  bloomRatio: number;
  bloomTimeSec: number;
  bloomTempF: number;
}

export function computeStartingRecipe(params: StartingRecipeParams): StartingRecipeNumbers {
  const grinder = GRINDERS[params.grinderId ?? 'opus-v1'] ?? OPUS_V1;
  const startDial = STARTING_DIAL_TABLE[params.roast][params.brewSize];
  const grindMicron = grinder.dialToMicron(startDial);
  const grindDisplay = grinder.micronToDial(grindMicron).toFixed(2);
  const tempF = STARTING_TEMP_TABLE[params.roast];

  return {
    grindMicron,
    grindDisplay,
    tempF,
    ratio: DEFAULT_RATIO,
    dose: DEFAULT_DOSE,
    bloomEnabled: true,
    bloomRatio: 2,
    bloomTimeSec: 45,
    bloomTempF: tempF,
  };
}

// ─── Taste → Adjustment Rules ─────────────────────────────────────────────────
// Priority: grind → temperature → ratio
// Grind uses bracketing (binary search once both bounds are known).

export type AdjustmentAxis = 'grind' | 'temperature' | 'ratio';

export interface AdjustmentResult {
  axis: AdjustmentAxis;
  newGrindMicron?: number;
  newGrindDisplay?: string;
  deltaMicron?: number;
  newTempF?: number;
  newRatio?: number;
  direction: 'finer' | 'coarser' | 'hotter' | 'cooler' | 'tighter' | 'looser' | 'none';
  narration: string;
}

const GRIND_STEP_LARGE = 4 * OPUS_DIAL_STEP; // 1.0 dial unit = ~93µm — initial big step
const GRIND_STEP_SMALL = 2 * OPUS_DIAL_STEP; // 0.5 dial unit = ~46µm — after first bound
// TEMP_STEP_F and temperature adjustment are roadmap (post-v1)
const RATIO_STEP = 1; // 1:16 → 1:15 (tighter) or 1:17 (looser)

export function computeAdjustment(
  taste: TasteResult,
  current: { grindMicron: number; tempF: number; ratio: number },
  bounds: { sourBound?: number; bitterBound?: number },
  grinder: GrinderModel = OPUS_V1,
): AdjustmentResult {
  if (taste === 'just-right') {
    return {
      axis: 'grind',
      direction: 'none',
      narration: "That's the sweet spot! Saving this recipe as dialed-in. ☕",
    };
  }

  // ── Extraction issues: grind first, then temp ─────────────────────────────
  if (taste === 'sour') {
    // Sour = under-extracted → go finer
    const { sourBound, bitterBound } = bounds;
    let targetMicron: number;
    let deltaMicron: number;

    if (sourBound !== undefined && bitterBound !== undefined) {
      // Both bounds known → halve the gap
      targetMicron = Math.round((sourBound + bitterBound) / 2);
      deltaMicron = current.grindMicron - targetMicron;
    } else if (bitterBound !== undefined) {
      // Only bitter bound known → step toward it
      const stepMicron = Math.round(GRIND_STEP_SMALL * OPUS_MICRONS_PER_UNIT / (1 / OPUS_DIAL_STEP));
      targetMicron = Math.max(bitterBound + 1, current.grindMicron - stepMicron);
      deltaMicron = current.grindMicron - targetMicron;
    } else {
      // No bounds yet → large step finer
      const dialStep = sourBound !== undefined ? GRIND_STEP_SMALL : GRIND_STEP_LARGE;
      const dialCurrent = grinder.micronToDial(current.grindMicron);
      const dialTarget = Math.max(grinder.dialMin, dialCurrent - dialStep);
      targetMicron = grinder.dialToMicron(dialTarget);
      deltaMicron = current.grindMicron - targetMicron;
    }

    const newDial = grinder.micronToDial(targetMicron);
    const newDisplay = newDial.toFixed(2);
    const currentDisplay = grinder.micronToDial(current.grindMicron).toFixed(2);

    return {
      axis: 'grind',
      newGrindMicron: targetMicron,
      newGrindDisplay: newDisplay,
      deltaMicron,
      direction: 'finer',
      narration: `Sour → under-extracted. Go Opus ${currentDisplay} → ${newDisplay} (~${Math.round(deltaMicron)}µm finer). Keep everything else the same. Re-brew.`,
    };
  }

  if (taste === 'bitter') {
    // Bitter = over-extracted → go coarser
    const { sourBound, bitterBound } = bounds;
    let targetMicron: number;
    let deltaMicron: number;

    if (sourBound !== undefined && bitterBound !== undefined) {
      targetMicron = Math.round((sourBound + bitterBound) / 2);
      deltaMicron = targetMicron - current.grindMicron;
    } else if (sourBound !== undefined) {
      const stepMicron = Math.round(GRIND_STEP_SMALL * OPUS_MICRONS_PER_UNIT / (1 / OPUS_DIAL_STEP));
      targetMicron = Math.min(sourBound - 1, current.grindMicron + stepMicron);
      deltaMicron = targetMicron - current.grindMicron;
    } else {
      const dialStep = bitterBound !== undefined ? GRIND_STEP_SMALL : GRIND_STEP_LARGE;
      const dialCurrent = grinder.micronToDial(current.grindMicron);
      const dialTarget = Math.min(grinder.dialMax, dialCurrent + dialStep);
      targetMicron = grinder.dialToMicron(dialTarget);
      deltaMicron = targetMicron - current.grindMicron;
    }

    const newDial = grinder.micronToDial(targetMicron);
    const newDisplay = newDial.toFixed(2);
    const currentDisplay = grinder.micronToDial(current.grindMicron).toFixed(2);

    return {
      axis: 'grind',
      newGrindMicron: targetMicron,
      newGrindDisplay: newDisplay,
      deltaMicron,
      direction: 'coarser',
      narration: `Bitter → over-extracted. Go Opus ${currentDisplay} → ${newDisplay} (~${Math.round(deltaMicron)}µm coarser). Keep everything else the same. Re-brew.`,
    };
  }

  // ── Strength issues: ratio ─────────────────────────────────────────────────
  if (taste === 'weak') {
    const newRatio = current.ratio - RATIO_STEP;
    return {
      axis: 'ratio',
      newRatio,
      direction: 'tighter',
      narration: `Weak → too little coffee. Tighten the ratio from 1:${current.ratio} to 1:${newRatio} (add a bit more coffee). Keep grind and temp the same. Re-brew.`,
    };
  }

  if (taste === 'strong') {
    const newRatio = current.ratio + RATIO_STEP;
    return {
      axis: 'ratio',
      newRatio,
      direction: 'looser',
      narration: `Strong → too much coffee. Loosen the ratio from 1:${current.ratio} to 1:${newRatio} (use a bit less coffee). Keep grind and temp the same. Re-brew.`,
    };
  }

  return {
    axis: 'grind',
    direction: 'none',
    narration: 'No adjustment needed.',
  };
}

// ─── Grind display (mini-dial friendly) ──────────────────────────────────────
// The Opus dial is numbered 1–11 with 3 tick marks between each number (41
// clicks). Express a dial position the way the grinder reads: a whole number
// plus how many ticks past it, e.g. 6.25 → "Set dial to 6, then 1 tick toward 7".

export interface GrindLabel {
  /** Snapped dial value (e.g. 6.25) */
  dial: number;
  /** Whole number on the dial (e.g. 6) */
  whole: number;
  /** Ticks past the whole number, 0–3 */
  ticks: number;
  /** Actionable label for the physical grinder */
  label: string;
}

export function formatGrind(dial: number, grinder: GrinderModel = OPUS_V1): GrindLabel {
  const step = grinder.dialStep; // 0.25
  const ticksPerNumber = Math.round(1 / step); // 4
  const snapped = parseFloat((Math.round(dial / step) * step).toFixed(2));
  let whole = Math.floor(snapped + 1e-9);
  let ticks = Math.round((snapped - whole) / step);
  if (ticks >= ticksPerNumber) {
    whole += 1;
    ticks = 0;
  }
  const capped = Math.min(whole, grinder.dialMax);
  let label: string;
  if (ticks === 0) {
    label = `Set dial to ${capped}`;
  } else {
    const toward = Math.min(whole + 1, grinder.dialMax);
    label = `Set dial to ${whole}, then ${ticks} tick${ticks === 1 ? '' : 's'} toward ${toward}`;
  }
  return { dial: snapped, whole, ticks, label };
}

/** Convenience: label straight from microns. */
export function formatGrindFromMicron(micron: number, grinder: GrinderModel = OPUS_V1): GrindLabel {
  return formatGrind(grinder.micronToDial(micron), grinder);
}

/** Convert °F to °C, rounded to 1 decimal */
export function fToC(f: number): number {
  return parseFloat(((f - 32) * 5 / 9).toFixed(1));
}

/** Format temperature for display */
export function formatTemp(f: number, unit: 'F' | 'C'): string {
  if (unit === 'C') return `${fToC(f)}°C`;
  return `${f}°F`;
}
