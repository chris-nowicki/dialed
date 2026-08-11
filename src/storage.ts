/**
 * Local storage layer — app-scoped, private, v1.
 * Schema is shaped for future shared/sellable use (createdBy, visibility ride along).
 */

import type {
  AidenProfile,
  Bean,
  BrewSize,
  DialInSession,
  Recipe,
  RoastLevel,
  TasteEvent,
  TasteResult,
} from "./types";
import { computeAdjustment, computeDose, computeStartingRecipe, OPUS_V1, BASKET_CUPS } from './grindEngine';

const KEYS = {
  beans: 'dialed:beans',
  recipes: 'dialed:recipes',
  sessions: 'dialed:sessions',
  aidenProfiles: "dialed:aiden-profiles",
  settings: 'dialed:settings',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

function uuid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

// ─── Beans ────────────────────────────────────────────────────────────────────

export function getBeans(): Bean[] {
  return load<Bean>(KEYS.beans);
}

export function getBean(id: string): Bean | undefined {
  return getBeans().find((b) => b.id === id);
}

export function saveBean(bean: Omit<Bean, 'id' | 'createdAt'>): Bean {
  const beans = getBeans();
  const newBean: Bean = { ...bean, id: uuid(), createdAt: now() };
  save(KEYS.beans, [...beans, newBean]);
  return newBean;
}

export function updateBean(id: string, patch: Partial<Bean>): Bean | undefined {
  const beans = getBeans();
  const idx = beans.findIndex((b) => b.id === id);
  if (idx === -1) return undefined;
  const updated = { ...beans[idx], ...patch };
  beans[idx] = updated;
  save(KEYS.beans, beans);
  return updated;
}

// ─── Aiden profiles ─────────────────────────────────────────────────────────

export type AidenProfileSettings = Pick<
  AidenProfile,
  "ratio" | "coldBrew" | "bloom" | "singleServe" | "batch"
>;

const BUILT_IN_AIDEN_PROFILES: Record<RoastLevel, AidenProfileSettings> = {
  light: {
    ratio: 17,
    coldBrew: false,
    bloom: { enabled: true, ratio: 3, timeSec: 45, tempF: 210 },
    singleServe: { numPulses: 3, timeBetweenSec: 23, pulseTempsF: [210, 210, 210] },
    batch: { numPulses: 1, timeBetweenSec: 30, pulseTempsF: [210] },
  },
  medium: {
    ratio: 16,
    coldBrew: false,
    bloom: { enabled: true, ratio: 2, timeSec: 30, tempF: 205 },
    singleServe: { numPulses: 3, timeBetweenSec: 23, pulseTempsF: [205, 205, 205] },
    batch: { numPulses: 1, timeBetweenSec: 30, pulseTempsF: [205] },
  },
  dark: {
    ratio: 16,
    coldBrew: false,
    bloom: { enabled: true, ratio: 2, timeSec: 30, tempF: 210 },
    singleServe: { numPulses: 3, timeBetweenSec: 23, pulseTempsF: [185, 185, 185] },
    batch: { numPulses: 1, timeBetweenSec: 30, pulseTempsF: [185] },
  },
};

function cloneProfileSettings(settings: AidenProfileSettings): AidenProfileSettings {
  return {
    ratio: settings.ratio,
    coldBrew: settings.coldBrew,
    bloom: { ...settings.bloom },
    singleServe: {
      ...settings.singleServe,
      pulseTempsF: [...settings.singleServe.pulseTempsF],
    },
    batch: {
      ...settings.batch,
      pulseTempsF: [...settings.batch.pulseTempsF],
    },
  };
}

export function getBuiltInAidenProfile(roast: RoastLevel): AidenProfileSettings {
  return cloneProfileSettings(BUILT_IN_AIDEN_PROFILES[roast]);
}

export function getAidenProfiles(): AidenProfile[] {
  return load<AidenProfile>(KEYS.aidenProfiles);
}

export function getAidenProfileForBean(beanId: string): AidenProfile | undefined {
  return getAidenProfiles().find((profile) => profile.beanId === beanId);
}

function recommendedAidenProfile(bean: Bean): AidenProfileSettings {
  const numbers = computeStartingRecipe({ roast: bean.roast, brewSize: "batch" });
  return {
    ratio: numbers.ratio,
    coldBrew: false,
    bloom: {
      enabled: numbers.bloomEnabled,
      ratio: numbers.bloomRatio,
      timeSec: numbers.bloomTimeSec,
      tempF: numbers.bloomTempF,
    },
    singleServe: {
      numPulses: 3,
      timeBetweenSec: 23,
      pulseTempsF: [numbers.tempF, numbers.tempF, numbers.tempF],
    },
    batch: {
      numPulses: 1,
      timeBetweenSec: 30,
      pulseTempsF: [numbers.tempF],
    },
  };
}

function syncRecipesToAidenProfile(profile: AidenProfile): void {
  const recipes = getRecipes();
  let changed = false;
  const synced = recipes.map((recipe) => {
    if (recipe.beanId !== profile.beanId) return recipe;
    changed = true;
    return {
      ...recipe,
      aidenProfileId: profile.id,
      aidenProfileName: profile.name,
      ratio: profile.ratio,
      coldBrew: profile.coldBrew,
      bloom: profile.bloom,
      singleServe: profile.singleServe,
      batch: profile.batch,
      dose: computeDose(recipe.cups ?? BASKET_CUPS[recipe.brewSize].default, profile.ratio),
      updatedAt: now(),
    };
  });
  if (changed) save(KEYS.recipes, synced);
}

export function createAidenProfileForBean(
  bean: Bean,
  legacyRecipe?: Recipe,
): AidenProfile {
  const existing = getAidenProfileForBean(bean.id);
  if (existing) return existing;

  const settings = legacyRecipe
    ? {
        ratio: legacyRecipe.ratio,
        coldBrew: legacyRecipe.coldBrew,
        bloom: legacyRecipe.bloom,
        singleServe: legacyRecipe.singleServe,
        batch: legacyRecipe.batch,
      }
    : recommendedAidenProfile(bean);
  const timestamp = now();
  const profile: AidenProfile = {
    id: uuid(),
    beanId: bean.id,
    name: bean.name,
    baseRoast: bean.roast,
    ...settings,
    status: "needs-setup",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  save(KEYS.aidenProfiles, [...getAidenProfiles(), profile]);
  syncRecipesToAidenProfile(profile);
  return profile;
}

export function ensureAidenProfile(bean: Bean): AidenProfile {
  return getAidenProfileForBean(bean.id) ?? createAidenProfileForBean(bean);
}

export function updateAidenProfile(
  beanId: string,
  patch: Partial<Omit<AidenProfile, "id" | "beanId" | "createdAt">>,
  requiresConfirmation = true,
): AidenProfile | undefined {
  const profiles = getAidenProfiles();
  const index = profiles.findIndex((profile) => profile.beanId === beanId);
  if (index === -1) return undefined;
  const current = profiles[index];
  const status = requiresConfirmation
    ? current.confirmedAt
      ? "needs-update"
      : "needs-setup"
    : patch.status ?? current.status;
  const updated: AidenProfile = {
    ...current,
    ...patch,
    status,
    updatedAt: now(),
  };
  profiles[index] = updated;
  save(KEYS.aidenProfiles, profiles);
  syncRecipesToAidenProfile(updated);
  return updated;
}

export function updateAidenProfileRecipeSettings(
  beanId: string,
  settings: { ratio?: number; tempF?: number },
): AidenProfile | undefined {
  const profile = getAidenProfileForBean(beanId);
  if (!profile) return undefined;
  const tempF = settings.tempF;
  const ratioChanged = settings.ratio !== undefined && settings.ratio !== profile.ratio;
  const currentTemperatures = [
    profile.bloom.tempF,
    ...profile.singleServe.pulseTempsF,
    ...profile.batch.pulseTempsF,
  ];
  const temperatureChanged = tempF !== undefined
    && currentTemperatures.some((temperature) => temperature !== tempF);
  if (!ratioChanged && !temperatureChanged) return profile;

  return updateAidenProfile(beanId, {
    ratio: settings.ratio ?? profile.ratio,
    bloom: tempF === undefined ? profile.bloom : { ...profile.bloom, tempF },
    singleServe: tempF === undefined
      ? profile.singleServe
      : {
          ...profile.singleServe,
          pulseTempsF: profile.singleServe.pulseTempsF.map(() => tempF),
        },
    batch: tempF === undefined
      ? profile.batch
      : {
          ...profile.batch,
          pulseTempsF: profile.batch.pulseTempsF.map(() => tempF),
        },
  });
}

export function confirmAidenProfile(beanId: string): AidenProfile | undefined {
  const profile = getAidenProfileForBean(beanId);
  if (!profile) return undefined;
  const timestamp = now();
  return updateAidenProfile(beanId, {
    status: "ready",
    confirmedAt: timestamp,
    confirmedSettings: cloneProfileSettings(profile),
  }, false);
}

/** Delete a bean and cascade-remove its recipes and dial-in sessions. */
export function deleteBean(id: string): void {
  save(KEYS.beans, getBeans().filter((b) => b.id !== id));
  save(KEYS.aidenProfiles, getAidenProfiles().filter((profile) => profile.beanId !== id));
  save(KEYS.recipes, getRecipes().filter((r) => r.beanId !== id));
  save(KEYS.sessions, getSessions().filter((s) => s.beanId !== id));
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export function getRecipes(): Recipe[] {
  return load<Recipe>(KEYS.recipes);
}

export function getRecipe(id: string): Recipe | undefined {
  return getRecipes().find((r) => r.id === id);
}

/** All recipes for a bean (up to one per basket). */
export function getRecipesForBean(beanId: string): Recipe[] {
  return getRecipes().filter((r) => r.beanId === beanId);
}

/** The recipe for a specific bean + basket, if one exists. */
export function getRecipeForBeanSize(beanId: string, brewSize: BrewSize): Recipe | undefined {
  return getRecipes().find((r) => r.beanId === beanId && r.brewSize === brewSize);
}

/**
 * Create a starting recipe for a bean + basket from the grind engine, seeded
 * with a default cup count and matching dose. Reuses the bean's researched roast.
 */
export function createStartingRecipe(bean: Bean, brewSize: BrewSize): Recipe {
  const numbers = computeStartingRecipe({ roast: bean.roast, brewSize });
  const profile = ensureAidenProfile(bean);
  const cups = BASKET_CUPS[brewSize].default;
  return saveRecipe({
    beanId: bean.id,
    brewMethodId: 'aiden',
    grinderModelId: 'opus-v1',
    aidenProfileId: profile.id,
    aidenProfileName: profile.name,
    ratio: profile.ratio,
    coldBrew: profile.coldBrew,
    bloom: profile.bloom,
    singleServe: profile.singleServe,
    batch: profile.batch,
    grindMicron: numbers.grindMicron,
    grindDisplay: numbers.grindDisplay,
    dose: computeDose(cups, profile.ratio),
    brewSize,
    cups,
    status: 'starting',
  });
}

export interface ManualSettings {
  grindMicron: number;
  grindDisplay: string;
  ratio: number;
  tempF: number;
  cups: number;
}

/** Create a recipe for a bean + basket from user-entered settings. */
export function createRecipeFromSettings(bean: Bean, brewSize: BrewSize, s: ManualSettings): Recipe {
  const profile = ensureAidenProfile(bean);
  const updatedProfile = updateAidenProfileRecipeSettings(bean.id, {
    ratio: s.ratio,
    tempF: s.tempF,
  }) ?? profile;
  return saveRecipe({
    beanId: bean.id,
    brewMethodId: 'aiden',
    grinderModelId: 'opus-v1',
    aidenProfileId: updatedProfile.id,
    aidenProfileName: updatedProfile.name,
    ratio: updatedProfile.ratio,
    coldBrew: updatedProfile.coldBrew,
    bloom: updatedProfile.bloom,
    singleServe: updatedProfile.singleServe,
    batch: updatedProfile.batch,
    grindMicron: s.grindMicron,
    grindDisplay: s.grindDisplay,
    dose: computeDose(s.cups, updatedProfile.ratio),
    brewSize,
    cups: s.cups,
    status: 'starting',
  });
}

export function saveRecipe(recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Recipe {
  const recipes = getRecipes();
  const ts = now();
  const newRecipe: Recipe = { ...recipe, id: uuid(), createdAt: ts, updatedAt: ts };
  save(KEYS.recipes, [...recipes, newRecipe]);
  return newRecipe;
}

export function updateRecipe(id: string, patch: Partial<Recipe>): Recipe | undefined {
  const recipes = getRecipes();
  const idx = recipes.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const updated = { ...recipes[idx], ...patch, updatedAt: now() };
  recipes[idx] = updated;
  save(KEYS.recipes, recipes);
  return updated;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function getSessions(): DialInSession[] {
  return load<DialInSession>(KEYS.sessions);
}

export function getSession(id: string): DialInSession | undefined {
  return getSessions().find((s) => s.id === id);
}

export function getActiveSessionForRecipe(recipeId: string): DialInSession | undefined {
  return getSessions().find((s) => s.recipeId === recipeId && !s.completed);
}

export function createSession(recipeId: string, beanId: string): DialInSession {
  const sessions = getSessions();
  const ts = now();
  const session: DialInSession = {
    id: uuid(),
    recipeId,
    beanId,
    events: [],
    completed: false,
    createdAt: ts,
    updatedAt: ts,
  };
  save(KEYS.sessions, [...sessions, session]);
  return session;
}

export function recordTaste(
  sessionId: string,
  taste: TasteResult,
  narration: string,
): { session: DialInSession; event: TasteEvent } | undefined {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return undefined;

  const session = sessions[idx];
  const recipe = getRecipe(session.recipeId);
  if (!recipe) return undefined;

  const event: TasteEvent = {
    id: uuid(),
    grindMicron: recipe.grindMicron,
    grindDisplay: recipe.grindDisplay,
    tempF: recipe.batch.pulseTempsF[0] ?? 200,
    ratio: recipe.ratio,
    tasteResult: taste,
    narration,
    timestamp: now(),
  };

  // Update bracketing bounds
  let { sourBound, bitterBound } = session;
  if (taste === 'sour') {
    sourBound = sourBound === undefined
      ? recipe.grindMicron
      : Math.max(sourBound, recipe.grindMicron);
  }
  if (taste === 'bitter') {
    bitterBound = bitterBound === undefined
      ? recipe.grindMicron
      : Math.min(bitterBound, recipe.grindMicron);
  }

  // Completion is now a manual, user-driven choice (see markDialedIn) — a
  // just-right taste is a strong suggestion, not an automatic finish. The
  // session stays open so tuning can continue across brews.
  const updatedSession: DialInSession = {
    ...session,
    events: [...session.events, event],
    sourBound,
    bitterBound,
    updatedAt: now(),
  };

  sessions[idx] = updatedSession;
  save(KEYS.sessions, sessions);

  // Apply the computed adjustment to the recipe so the next brew uses it.
  // just-right yields no change, so this is a no-op in that case.
  const adjustment = computeAdjustment(
    taste,
    { grindMicron: recipe.grindMicron, tempF: event.tempF, ratio: recipe.ratio },
    { sourBound, bitterBound },
    OPUS_V1,
  );
  if (adjustment.newGrindMicron !== undefined) {
    updateRecipe(session.recipeId, {
      grindMicron: adjustment.newGrindMicron,
      grindDisplay: adjustment.newGrindDisplay ?? adjustment.newGrindMicron.toString(),
      batch: {
        ...recipe.batch,
        pulseTempsF: adjustment.newTempF
          ? [adjustment.newTempF]
          : recipe.batch.pulseTempsF,
      },
    });
  }
  if (adjustment.newRatio !== undefined) {
    updateAidenProfileRecipeSettings(recipe.beanId, { ratio: adjustment.newRatio });
  }

  return { session: updatedSession, event };
}

/** Mark a recipe dialed-in and close its active session (user-confirmed). */
export function markDialedIn(recipeId: string): Recipe | undefined {
  const active = getActiveSessionForRecipe(recipeId);
  if (active) {
    const sessions = getSessions();
    const idx = sessions.findIndex((s) => s.id === active.id);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], completed: true, updatedAt: now() };
      save(KEYS.sessions, sessions);
    }
  }
  return updateRecipe(recipeId, { status: 'dialed-in' });
}

/** Reopen a dialed-in recipe for more tuning, ensuring an active session exists. */
export function reopenRecipe(recipeId: string): Recipe | undefined {
  const recipe = getRecipe(recipeId);
  if (!recipe) return undefined;
  if (!getActiveSessionForRecipe(recipeId)) {
    createSession(recipeId, recipe.beanId);
  }
  return updateRecipe(recipeId, { status: 'starting' });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  tempUnit: 'F' | 'C';
}

const DEFAULT_SETTINGS: AppSettings = { tempUnit: 'F' };

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(KEYS.settings, JSON.stringify(updated));
  return updated;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

/**
 * Backfill recipes saved before the per-basket model: assume the legacy
 * single-recipe-per-bean was a batch (flat-basket) dial-in.
 */
export function migrateRecipes(): void {
  const recipes = getRecipes();
  let changed = false;
  const migrated = recipes.map((r) => {
    if (r.brewSize) return r;
    changed = true;
    const cups = r.cups ?? BASKET_CUPS.batch.default;
    return { ...r, brewSize: 'batch' as BrewSize, cups };
  });
  if (changed) save(KEYS.recipes, migrated);
}

export function migrateAidenProfiles(): void {
  const beans = getBeans();
  for (const bean of beans) {
    if (getAidenProfileForBean(bean.id)) continue;
    const legacyRecipe = getRecipeForBeanSize(bean.id, "batch")
      ?? getRecipeForBeanSize(bean.id, "single");
    createAidenProfileForBean(bean, legacyRecipe);
  }
}

export function seedIfEmpty(): void {
  migrateRecipes();
  migrateAidenProfiles();
  if (getBeans().length > 0) return;

  // Validated fallback bean — demo-safe, graceful degrade
  const bean = saveBean({
    roaster: 'Counter Culture',
    name: 'Hologram',
    origin: 'Ethiopia',
    roast: 'light',
    process: 'washed',
    tastingNotes: ['Bergamot', 'Peach', 'Jasmine'],
    sourceCitations: ['https://counterculturecoffee.com/products/hologram'],
    createdBy: 'seed',
    visibility: 'private',
  });

  const profile = createAidenProfileForBean(bean);
  const recipe = createStartingRecipe(bean, "batch");
  void profile;
  void recipe;
}
