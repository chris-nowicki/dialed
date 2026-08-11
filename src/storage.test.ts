import { beforeEach, describe, expect, it } from "vitest";
import type { Bean, BrewVariant } from "./types";
import {
  confirmAidenProfile,
  createAidenProfileForBean,
  createSession,
  createStartingRecipe,
  getAidenProfileForBean,
  getRecipe,
  getRecipes,
  getSession,
  markDialedIn,
  migrateStorage,
  recordTaste,
  saveBean,
  updateAidenProfileRecipeSettings,
} from "./storage";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createBean(): Bean {
  return saveBean({
    roaster: "Test Roaster",
    name: "Test Bean",
    roast: "medium",
    tastingNotes: [],
    sourceCitations: [],
    createdBy: "test",
    visibility: "private",
  });
}

function createDialedVariants(bean: Bean): Record<BrewVariant, string> {
  const ids = {
    single: createStartingRecipe(bean, "single").id,
    "small-batch": createStartingRecipe(bean, "small-batch").id,
    "large-batch": createStartingRecipe(bean, "large-batch").id,
  };
  markDialedIn(ids.single);
  markDialedIn(ids["small-batch"]);
  markDialedIn(ids["large-batch"]);
  return ids;
}

function statuses(ids: Record<BrewVariant, string>): Record<BrewVariant, string | undefined> {
  return {
    single: getRecipe(ids.single)?.status,
    "small-batch": getRecipe(ids["small-batch"])?.status,
    "large-batch": getRecipe(ids["large-batch"])?.status,
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
});

describe("profile dependency invalidation", () => {
  it("marks only single serve stale when its pulse temperatures change", () => {
    const bean = createBean();
    createAidenProfileForBean(bean);
    const ids = createDialedVariants(bean);

    updateAidenProfileRecipeSettings(bean.id, {
      singleServePulseTempsF: [205, 203, 201],
    });

    expect(statuses(ids)).toEqual({
      single: "needs-recheck",
      "small-batch": "dialed-in",
      "large-batch": "dialed-in",
    });
  });

  it("marks both batch variants stale when batch temperature changes", () => {
    const bean = createBean();
    createAidenProfileForBean(bean);
    const ids = createDialedVariants(bean);

    updateAidenProfileRecipeSettings(bean.id, { batchPulseTempF: 201 });

    expect(statuses(ids)).toEqual({
      single: "dialed-in",
      "small-batch": "needs-recheck",
      "large-batch": "needs-recheck",
    });
  });

  it("marks all variants stale when ratio or bloom changes", () => {
    const bean = createBean();
    createAidenProfileForBean(bean);
    const ids = createDialedVariants(bean);

    updateAidenProfileRecipeSettings(bean.id, { ratio: 17, bloomTempF: 202 });

    expect(statuses(ids)).toEqual({
      single: "needs-recheck",
      "small-batch": "needs-recheck",
      "large-batch": "needs-recheck",
    });
  });
});

describe("taste snapshots", () => {
  it("records the full single-serve temperature sequence", () => {
    const bean = createBean();
    createAidenProfileForBean(bean);
    confirmAidenProfile(bean.id);
    updateAidenProfileRecipeSettings(bean.id, {
      bloomTempF: 208,
      singleServePulseTempsF: [206, 204, 202],
    });
    const recipe = createStartingRecipe(bean, "single");
    const session = createSession(recipe.id, bean.id);

    const result = recordTaste(session.id, "just-right", "Balanced.");

    expect(result?.event.settings).toMatchObject({
      brewVariant: "single",
      bloomTempF: 208,
      pulseTempsF: [206, 204, 202],
      temperatureDetail: "complete",
    });
  });
});

describe("storage migration", () => {
  it("normalizes recipes and preserves legacy temperature honestly", () => {
    const bean = {
      id: "bean-1",
      roaster: "Legacy",
      name: "Legacy Bean",
      roast: "medium",
      tastingNotes: [],
      sourceCitations: [],
      createdBy: "test",
      visibility: "private",
      createdAt: "2026-01-01T00:00:00.000Z",
    } satisfies Bean;
    localStorage.setItem("dialed:beans", JSON.stringify([bean]));
    localStorage.setItem("dialed:recipes", JSON.stringify([
      {
        id: "small-recipe",
        beanId: bean.id,
        brewMethodId: "aiden",
        grinderModelId: "opus-v1",
        aidenProfileName: bean.name,
        ratio: 16,
        coldBrew: false,
        bloom: { enabled: true, ratio: 2, timeSec: 30, tempF: 205 },
        singleServe: { numPulses: 3, timeBetweenSec: 23, pulseTempsF: [205, 203, 201] },
        batch: { numPulses: 1, timeBetweenSec: 30, pulseTempsF: [205] },
        grindMicron: 800,
        brewSize: "batch",
        cups: 5,
        status: "dialed-in",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]));
    localStorage.setItem("dialed:sessions", JSON.stringify([
      {
        id: "session-1",
        recipeId: "small-recipe",
        beanId: bean.id,
        events: [{
          id: "event-1",
          grindMicron: 800,
          grindDisplay: "7.25",
          tempF: 204,
          ratio: 16,
          tasteResult: "just-right",
          narration: "Balanced.",
          timestamp: "2026-01-01T00:00:00.000Z",
        }],
        completed: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]));

    migrateStorage();

    expect(getRecipes()).toEqual([
      expect.objectContaining({
        id: "small-recipe",
        brewVariant: "small-batch",
        cups: 5,
      }),
    ]);
    expect(getRecipes()[0]).not.toHaveProperty("ratio");
    expect(getAidenProfileForBean(bean.id)?.singleServe.pulseTempsF).toEqual([205, 203, 201]);
    expect(getSession("session-1")?.events[0].settings).toMatchObject({
      pulseTempsF: [204],
      temperatureDetail: "legacy-single-value",
    });
    expect(localStorage.getItem("dialed:schema-version")).toBe("2");
  });
});
