/**
 * Local storage layer — app-scoped, private, and versioned.
 * Shared Aiden settings live on profiles; recipes only own variant dial-in state.
 */

import type {
  AidenProfile,
  Bean,
  BloomSettings,
  BrewSettingsSnapshot,
  BrewVariant,
  DialInSession,
  PulseBlock,
  Recipe,
  RecipeStatus,
  RoastLevel,
  TasteEvent,
  TasteResult,
} from "./types";
import {
  BREW_VARIANTS,
  OPUS_V1,
  brewVariantForLegacyRecipe,
  computeAdjustment,
  computeStartingRecipe,
} from "./grindEngine";

const CURRENT_SCHEMA_VERSION = 2;

const KEYS = {
  beans: "dialed:beans",
  recipes: "dialed:recipes",
  sessions: "dialed:sessions",
  aidenProfiles: "dialed:aiden-profiles",
  settings: "dialed:settings",
  schemaVersion: "dialed:schema-version",
} as const;

interface LegacyRecipe {
  id: string;
  beanId: string;
  brewMethodId: string;
  grinderModelId: string;
  aidenProfileId?: string;
  aidenProfileName?: string;
  ratio?: number;
  coldBrew?: boolean;
  bloom?: BloomSettings;
  singleServe?: PulseBlock;
  batch?: PulseBlock;
  grindMicron: number;
  grindDisplay?: string;
  dose?: number;
  brewSize?: "single" | "batch";
  brewVariant?: BrewVariant;
  cups?: number;
  status: RecipeStatus;
  createdAt: string;
  updatedAt: string;
}

interface LegacyTasteEvent {
  id: string;
  settings?: BrewSettingsSnapshot;
  grindMicron?: number;
  grindDisplay?: string;
  tempF?: number;
  ratio?: number;
  tasteResult: TasteResult;
  narration: string;
  timestamp: string;
}

interface LegacyDialInSession extends Omit<DialInSession, "events"> {
  events: LegacyTasteEvent[];
}

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

function arraysEqual(left: number[], right: number[]): boolean {
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

// ─── Beans ────────────────────────────────────────────────────────────────────

export function getBeans(): Bean[] {
  return load<Bean>(KEYS.beans);
}

export function getBean(id: string): Bean | undefined {
  return getBeans().find((bean) => bean.id === id);
}

export function saveBean(bean: Omit<Bean, "id" | "createdAt">): Bean {
  const newBean: Bean = { ...bean, id: uuid(), createdAt: now() };
  save(KEYS.beans, [...getBeans(), newBean]);
  return newBean;
}

export function updateBean(id: string, patch: Partial<Bean>): Bean | undefined {
  const beans = getBeans();
  const index = beans.findIndex((bean) => bean.id === id);
  if (index === -1) return undefined;
  const updated = { ...beans[index], ...patch };
  beans[index] = updated;
  save(KEYS.beans, beans);
  return updated;
}

// ─── Aiden profiles ───────────────────────────────────────────────────────────

export type AidenProfileSettings = Pick<
  AidenProfile,
  "ratio" | "coldBrew" | "bloom" | "singleServe" | "batch"
>;

export interface AidenProfileRecipeSettingsPatch {
  ratio?: number;
  bloomTempF?: number;
  singleServePulseTempsF?: number[];
  batchPulseTempF?: number;
}

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
  const numbers = computeStartingRecipe({
    roast: bean.roast,
    brewVariant: "single",
  });
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

function legacyProfileSettings(
  bean: Bean,
  recipe?: LegacyRecipe,
): AidenProfileSettings {
  if (
    recipe?.ratio !== undefined
    && recipe.bloom
    && recipe.singleServe
    && recipe.batch
  ) {
    return {
      ratio: recipe.ratio,
      coldBrew: recipe.coldBrew ?? false,
      bloom: recipe.bloom,
      singleServe: recipe.singleServe,
      batch: recipe.batch,
    };
  }
  return recommendedAidenProfile(bean);
}

export function createAidenProfileForBean(
  bean: Bean,
  legacyRecipe?: LegacyRecipe,
): AidenProfile {
  const existing = getAidenProfileForBean(bean.id);
  if (existing) return existing;

  const timestamp = now();
  const profile: AidenProfile = {
    id: uuid(),
    beanId: bean.id,
    name: bean.name,
    baseRoast: bean.roast,
    ...legacyProfileSettings(bean, legacyRecipe),
    status: "needs-setup",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  save(KEYS.aidenProfiles, [...getAidenProfiles(), profile]);
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
  return updated;
}

function markVariantsForRecheck(
  beanId: string,
  variants: Set<BrewVariant>,
): void {
  if (variants.size === 0) return;
  const timestamp = now();
  const recipes = getRecipes().map((recipe) => {
    if (
      recipe.beanId !== beanId
      || !variants.has(recipe.brewVariant)
      || recipe.status !== "dialed-in"
    ) {
      return recipe;
    }
    return { ...recipe, status: "needs-recheck" as const, updatedAt: timestamp };
  });
  save(KEYS.recipes, recipes);
}

export function updateAidenProfileRecipeSettings(
  beanId: string,
  patch: AidenProfileRecipeSettingsPatch,
): AidenProfile | undefined {
  const profile = getAidenProfileForBean(beanId);
  if (!profile) return undefined;
  if (
    patch.singleServePulseTempsF
    && patch.singleServePulseTempsF.length !== profile.singleServe.numPulses
  ) {
    throw new Error(
      `Expected ${profile.singleServe.numPulses} single-serve pulse temperatures.`,
    );
  }

  const affectedVariants = new Set<BrewVariant>();
  const ratioChanged = patch.ratio !== undefined && patch.ratio !== profile.ratio;
  const bloomChanged = patch.bloomTempF !== undefined
    && patch.bloomTempF !== profile.bloom.tempF;
  const singleTempsChanged = patch.singleServePulseTempsF !== undefined
    && !arraysEqual(patch.singleServePulseTempsF, profile.singleServe.pulseTempsF);
  const batchTempChanged = patch.batchPulseTempF !== undefined
    && patch.batchPulseTempF !== profile.batch.pulseTempsF[0];

  if (ratioChanged || bloomChanged) {
    affectedVariants.add("single");
    affectedVariants.add("small-batch");
    affectedVariants.add("large-batch");
  }
  if (singleTempsChanged) affectedVariants.add("single");
  if (batchTempChanged) {
    affectedVariants.add("small-batch");
    affectedVariants.add("large-batch");
  }
  if (affectedVariants.size === 0) return profile;

  const updated = updateAidenProfile(beanId, {
    ratio: patch.ratio ?? profile.ratio,
    bloom: patch.bloomTempF === undefined
      ? profile.bloom
      : { ...profile.bloom, tempF: patch.bloomTempF },
    singleServe: patch.singleServePulseTempsF === undefined
      ? profile.singleServe
      : {
          ...profile.singleServe,
          pulseTempsF: [...patch.singleServePulseTempsF],
        },
    batch: patch.batchPulseTempF === undefined
      ? profile.batch
      : {
          ...profile.batch,
          pulseTempsF: [patch.batchPulseTempF],
        },
  });
  markVariantsForRecheck(beanId, affectedVariants);
  return updated;
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

export function deleteBean(id: string): void {
  save(KEYS.beans, getBeans().filter((bean) => bean.id !== id));
  save(
    KEYS.aidenProfiles,
    getAidenProfiles().filter((profile) => profile.beanId !== id),
  );
  save(KEYS.recipes, getRecipes().filter((recipe) => recipe.beanId !== id));
  save(KEYS.sessions, getSessions().filter((session) => session.beanId !== id));
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

export function getRecipes(): Recipe[] {
  return load<Recipe>(KEYS.recipes);
}

export function getRecipe(id: string): Recipe | undefined {
  return getRecipes().find((recipe) => recipe.id === id);
}

export function getRecipesForBean(beanId: string): Recipe[] {
  return getRecipes().filter((recipe) => recipe.beanId === beanId);
}

export function getRecipeForBeanVariant(
  beanId: string,
  brewVariant: BrewVariant,
): Recipe | undefined {
  return getRecipes().find(
    (recipe) => recipe.beanId === beanId && recipe.brewVariant === brewVariant,
  );
}

export function getPulseTemperatures(
  profile: AidenProfile,
  brewVariant: BrewVariant,
): number[] {
  const block = BREW_VARIANTS[brewVariant].basket === "single"
    ? profile.singleServe
    : profile.batch;
  return block.pulseTempsF.slice(0, block.numPulses);
}

export function createStartingRecipe(
  bean: Bean,
  brewVariant: BrewVariant,
): Recipe {
  const profile = ensureAidenProfile(bean);
  const numbers = computeStartingRecipe({ roast: bean.roast, brewVariant });
  return saveRecipe({
    beanId: bean.id,
    brewMethodId: "aiden",
    grinderModelId: "opus-v1",
    aidenProfileId: profile.id,
    grindMicron: numbers.grindMicron,
    brewVariant,
    cups: BREW_VARIANTS[brewVariant].cups.default,
    status: "starting",
  });
}

export interface ManualSettings {
  grindMicron: number;
  ratio: number;
  bloomTempF: number;
  pulseTempsF: number[];
  cups: number;
}

export function createRecipeFromSettings(
  bean: Bean,
  brewVariant: BrewVariant,
  settings: ManualSettings,
): Recipe {
  const profile = ensureAidenProfile(bean);
  const isSingle = BREW_VARIANTS[brewVariant].basket === "single";
  updateAidenProfileRecipeSettings(bean.id, {
    ratio: settings.ratio,
    bloomTempF: settings.bloomTempF,
    singleServePulseTempsF: isSingle ? settings.pulseTempsF : undefined,
    batchPulseTempF: isSingle ? undefined : settings.pulseTempsF[0],
  });
  return saveRecipe({
    beanId: bean.id,
    brewMethodId: "aiden",
    grinderModelId: "opus-v1",
    aidenProfileId: profile.id,
    grindMicron: settings.grindMicron,
    brewVariant,
    cups: settings.cups,
    status: "starting",
  });
}

export function saveRecipe(
  recipe: Omit<Recipe, "id" | "createdAt" | "updatedAt">,
): Recipe {
  const recipes = getRecipes();
  const duplicate = recipes.some(
    (existing) => existing.beanId === recipe.beanId
      && existing.brewVariant === recipe.brewVariant,
  );
  if (duplicate) {
    throw new Error(`A ${recipe.brewVariant} recipe already exists for this bean.`);
  }
  const timestamp = now();
  const newRecipe: Recipe = {
    ...recipe,
    id: uuid(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  save(KEYS.recipes, [...recipes, newRecipe]);
  return newRecipe;
}

export function updateRecipe(
  id: string,
  patch: Partial<Pick<Recipe, "grindMicron" | "cups" | "status">>,
): Recipe | undefined {
  const recipes = getRecipes();
  const index = recipes.findIndex((recipe) => recipe.id === id);
  if (index === -1) return undefined;
  const current = recipes[index];
  const grindChanged = patch.grindMicron !== undefined
    && patch.grindMicron !== current.grindMicron;
  const status = patch.status
    ?? (grindChanged && current.status === "dialed-in"
      ? "needs-recheck"
      : current.status);
  const updated = { ...current, ...patch, status, updatedAt: now() };
  recipes[index] = updated;
  save(KEYS.recipes, recipes);
  return updated;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function getSessions(): DialInSession[] {
  return load<DialInSession>(KEYS.sessions);
}

export function getSession(id: string): DialInSession | undefined {
  return getSessions().find((session) => session.id === id);
}

export function getActiveSessionForRecipe(recipeId: string): DialInSession | undefined {
  return getSessions().find(
    (session) => session.recipeId === recipeId && !session.completed,
  );
}

export function createSession(recipeId: string, beanId: string): DialInSession {
  const timestamp = now();
  const session: DialInSession = {
    id: uuid(),
    recipeId,
    beanId,
    events: [],
    completed: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  save(KEYS.sessions, [...getSessions(), session]);
  return session;
}

function snapshotSettings(recipe: Recipe, profile: AidenProfile): BrewSettingsSnapshot {
  return {
    brewVariant: recipe.brewVariant,
    cups: recipe.cups,
    grindMicron: recipe.grindMicron,
    ratio: profile.ratio,
    bloomTempF: profile.bloom.tempF,
    pulseTempsF: getPulseTemperatures(profile, recipe.brewVariant),
    temperatureDetail: "complete",
  };
}

export function recordTaste(
  sessionId: string,
  taste: TasteResult,
  narration: string,
): { session: DialInSession; event: TasteEvent } | undefined {
  const sessions = getSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);
  if (index === -1) return undefined;

  const session = sessions[index];
  const recipe = getRecipe(session.recipeId);
  const profile = recipe ? getAidenProfileForBean(recipe.beanId) : undefined;
  if (!recipe || !profile) return undefined;

  const settings = snapshotSettings(recipe, profile);
  const event: TasteEvent = {
    id: uuid(),
    settings,
    tasteResult: taste,
    narration,
    timestamp: now(),
  };

  let { sourBound, bitterBound } = session;
  if (taste === "sour") {
    sourBound = sourBound === undefined
      ? recipe.grindMicron
      : Math.max(sourBound, recipe.grindMicron);
  }
  if (taste === "bitter") {
    bitterBound = bitterBound === undefined
      ? recipe.grindMicron
      : Math.min(bitterBound, recipe.grindMicron);
  }

  const updatedSession: DialInSession = {
    ...session,
    events: [...session.events, event],
    sourBound,
    bitterBound,
    updatedAt: now(),
  };
  sessions[index] = updatedSession;
  save(KEYS.sessions, sessions);

  const adjustment = computeAdjustment(
    taste,
    {
      grindMicron: recipe.grindMicron,
      tempF: settings.pulseTempsF[0] ?? settings.bloomTempF,
      ratio: settings.ratio,
    },
    { sourBound, bitterBound },
    OPUS_V1,
  );
  if (adjustment.newGrindMicron !== undefined) {
    updateRecipe(session.recipeId, { grindMicron: adjustment.newGrindMicron });
  }
  if (adjustment.newRatio !== undefined) {
    updateAidenProfileRecipeSettings(recipe.beanId, {
      ratio: adjustment.newRatio,
    });
  }

  return { session: updatedSession, event };
}

export function markDialedIn(recipeId: string): Recipe | undefined {
  const active = getActiveSessionForRecipe(recipeId);
  if (active) {
    const sessions = getSessions();
    const index = sessions.findIndex((session) => session.id === active.id);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], completed: true, updatedAt: now() };
      save(KEYS.sessions, sessions);
    }
  }
  return updateRecipe(recipeId, { status: "dialed-in" });
}

export function reopenRecipe(recipeId: string): Recipe | undefined {
  const recipe = getRecipe(recipeId);
  if (!recipe) return undefined;
  if (!getActiveSessionForRecipe(recipeId)) {
    createSession(recipeId, recipe.beanId);
  }
  return updateRecipe(recipeId, { status: "starting" });
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  tempUnit: "F" | "C";
}

const DEFAULT_SETTINGS: AppSettings = { tempUnit: "F" };

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const updated = { ...getSettings(), ...settings };
  localStorage.setItem(KEYS.settings, JSON.stringify(updated));
  return updated;
}

// ─── Migration and seed data ──────────────────────────────────────────────────

function migrateTasteEvent(
  event: LegacyTasteEvent,
  recipe: Recipe,
  profile: AidenProfile,
): TasteEvent {
  if (event.settings) return event as TasteEvent;
  const legacyTempF = event.tempF
    ?? getPulseTemperatures(profile, recipe.brewVariant)[0]
    ?? profile.bloom.tempF;
  return {
    id: event.id,
    settings: {
      brewVariant: recipe.brewVariant,
      cups: recipe.cups,
      grindMicron: event.grindMicron ?? recipe.grindMicron,
      ratio: event.ratio ?? profile.ratio,
      bloomTempF: legacyTempF,
      pulseTempsF: [legacyTempF],
      temperatureDetail: "legacy-single-value",
    },
    tasteResult: event.tasteResult,
    narration: event.narration,
    timestamp: event.timestamp,
  };
}

export function migrateStorage(): void {
  const schemaVersion = Number(localStorage.getItem(KEYS.schemaVersion) ?? "0");
  if (schemaVersion >= CURRENT_SCHEMA_VERSION) return;

  const beans = getBeans();
  const legacyRecipes = load<LegacyRecipe>(KEYS.recipes);
  for (const bean of beans) {
    if (getAidenProfileForBean(bean.id)) continue;
    const legacyRecipe = legacyRecipes.find(
      (recipe) => recipe.beanId === bean.id && recipe.brewSize === "batch",
    ) ?? legacyRecipes.find((recipe) => recipe.beanId === bean.id);
    createAidenProfileForBean(bean, legacyRecipe);
  }

  const profiles = getAidenProfiles();
  const migratedRecipes: Recipe[] = legacyRecipes.map((legacyRecipe) => {
    const brewVariant = legacyRecipe.brewVariant
      ?? brewVariantForLegacyRecipe(legacyRecipe.brewSize, legacyRecipe.cups);
    const profile = profiles.find((item) => item.beanId === legacyRecipe.beanId);
    if (!profile) {
      throw new Error(`Cannot migrate recipe ${legacyRecipe.id} without an Aiden profile.`);
    }
    return {
      id: legacyRecipe.id,
      beanId: legacyRecipe.beanId,
      brewMethodId: legacyRecipe.brewMethodId,
      grinderModelId: legacyRecipe.grinderModelId,
      aidenProfileId: profile.id,
      grindMicron: legacyRecipe.grindMicron,
      brewVariant,
      cups: legacyRecipe.cups ?? BREW_VARIANTS[brewVariant].cups.default,
      status: legacyRecipe.status,
      createdAt: legacyRecipe.createdAt,
      updatedAt: legacyRecipe.updatedAt,
    };
  });

  const legacySessions = load<LegacyDialInSession>(KEYS.sessions);
  const migratedSessions: DialInSession[] = legacySessions.map((session) => {
    const recipe = migratedRecipes.find((item) => item.id === session.recipeId);
    const profile = recipe
      ? profiles.find((item) => item.beanId === recipe.beanId)
      : undefined;
    if (!recipe || !profile) return session as DialInSession;
    return {
      ...session,
      events: session.events.map((event) => migrateTasteEvent(event, recipe, profile)),
    };
  });

  save(KEYS.recipes, migratedRecipes);
  save(KEYS.sessions, migratedSessions);
  localStorage.setItem(KEYS.schemaVersion, String(CURRENT_SCHEMA_VERSION));
}

export function seedIfEmpty(): void {
  migrateStorage();
  if (getBeans().length > 0) return;

  const bean = saveBean({
    roaster: "Counter Culture",
    name: "Hologram",
    origin: "Ethiopia",
    roast: "light",
    process: "washed",
    tastingNotes: ["Bergamot", "Peach", "Jasmine"],
    sourceCitations: ["https://counterculturecoffee.com/products/hologram"],
    createdBy: "seed",
    visibility: "private",
  });
  createAidenProfileForBean(bean);
  createStartingRecipe(bean, "large-batch");
}
