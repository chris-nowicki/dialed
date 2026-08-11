import { describe, expect, it } from "vitest";
import {
  BREW_VARIANTS,
  OPUS_V1,
  brewVariantForLegacyRecipe,
  computeStartingRecipe,
} from "./grindEngine";

describe("brew variants", () => {
  it("uses Fellow's published original Opus starting settings", () => {
    expect(OPUS_V1.micronToDial(computeStartingRecipe({
      roast: "light",
      brewVariant: "single",
    }).grindMicron)).toBe(6.5);
    expect(OPUS_V1.micronToDial(computeStartingRecipe({
      roast: "medium",
      brewVariant: "small-batch",
    }).grindMicron)).toBe(8);
    expect(OPUS_V1.micronToDial(computeStartingRecipe({
      roast: "dark",
      brewVariant: "large-batch",
    }).grindMicron)).toBe(10.5);
  });

  it("keeps roast level from shifting the starting grind", () => {
    const dials = (["light", "medium", "dark"] as const).map((roast) => (
      OPUS_V1.micronToDial(computeStartingRecipe({
        roast,
        brewVariant: "small-batch",
      }).grindMicron)
    ));
    expect(dials).toEqual([8, 8, 8]);
  });

  it("defines non-overlapping half-cup ranges", () => {
    expect(BREW_VARIANTS.single.cups).toMatchObject({ min: 1, max: 3 });
    expect(BREW_VARIANTS["small-batch"].cups).toMatchObject({ min: 3.5, max: 5 });
    expect(BREW_VARIANTS["large-batch"].cups).toMatchObject({ min: 5.5, max: 10 });
  });

  it("migrates legacy batch recipes at the five-cup boundary", () => {
    expect(brewVariantForLegacyRecipe("single", 3)).toBe("single");
    expect(brewVariantForLegacyRecipe("batch", 5)).toBe("small-batch");
    expect(brewVariantForLegacyRecipe("batch", 5.5)).toBe("large-batch");
    expect(brewVariantForLegacyRecipe("batch", undefined)).toBe("large-batch");
  });
});
