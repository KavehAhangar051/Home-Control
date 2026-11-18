import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLazyIconRegistry } from "../features/iot/utils/iconRegistry.ts";

describe("Lazy Segment Icon Registry", () => {
  it("resolves static icons immediately, reports membership accurately, and deduplicates concurrent loads", async () => {
    let lightbulbLoads = 0;
    let resolveLightbulb;

    const registry = createLazyIconRegistry(
      { Cpu: "cpu-comp", Layers: "layers-comp" },
      {
        Lightbulb: () => {
          lightbulbLoads += 1;
          return new Promise((resolve) => {
            resolveLightbulb = resolve;
          });
        },
        Key: async () => "key-comp",
      },
      "Cpu",
    );

    assert.equal(registry.hasIcon("Cpu"), true);
    assert.equal(registry.hasIcon("Lightbulb"), true);
    assert.equal(registry.hasIcon("NonExistent"), false);
    assert.equal(registry.getResolved("Cpu"), "cpu-comp");
    assert.equal(registry.getResolved("Lightbulb"), null);

    let notifications = 0;
    const unsubscribe = registry.subscribe(() => {
      notifications += 1;
    });

    const p1 = registry.loadIcon("Lightbulb");
    const p2 = registry.loadIcon("Lightbulb");
    assert.equal(p1, p2);
    assert.equal(lightbulbLoads, 1);

    resolveLightbulb("lightbulb-comp");
    const [r1, r2] = await Promise.all([p1, p2]);

    assert.equal(r1, "lightbulb-comp");
    assert.equal(r2, "lightbulb-comp");
    assert.equal(registry.getResolved("Lightbulb"), "lightbulb-comp");
    assert.equal(notifications, 1);

    unsubscribe();
  });

  it("falls back safely on rejected icon loads and unknown keys", async () => {
    const registry = createLazyIconRegistry(
      { Cpu: "cpu-comp" },
      {
        Broken: async () => {
          throw new Error("chunk load failed");
        },
      },
      "Cpu",
    );

    assert.equal(await registry.loadIcon("Unknown"), "cpu-comp");
    assert.equal(await registry.loadIcon("Broken"), "cpu-comp");
    assert.equal(registry.getResolved("Broken"), "cpu-comp");
  });
});
