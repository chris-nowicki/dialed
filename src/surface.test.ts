import { describe, expect, it } from "vitest";
import applicationLifecyclePlugin, {
  mount,
  unmount,
} from "./surface";

describe("TAP surface lifecycle", () => {
  it("shares the installed lifecycle handlers without mounting React for package startup", () => {
    expect(applicationLifecyclePlugin.mount).toBe(mount);
    expect(applicationLifecyclePlugin.unmount).toBe(unmount);
    expect(mount({ packageId: "dialed" })).toBeUndefined();
  });
});
