import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retryDynamicImport } from "../lib/dynamicRetry.ts";

describe("retryDynamicImport", () => {
  it("resolves immediately when the initial import succeeds", async () => {
    let calls = 0;
    const result = await retryDynamicImport(async () => {
      calls += 1;
      return "ok";
    });

    assert.equal(result, "ok");
    assert.equal(calls, 1);
  });

  it("retries transient chunk load failures up to configured limit and succeeds", async () => {
    let calls = 0;
    const delays = [];

    const result = await retryDynamicImport(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new Error(`ChunkLoadError attempt ${calls}`);
        }
        return { ready: true };
      },
      {
        retries: 2,
        baseDelayMs: 100,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    );

    assert.deepEqual(result, { ready: true });
    assert.equal(calls, 3);
    assert.deepEqual(delays, [100, 200]);
  });

  it("rethrows the last error once retries are exhausted", async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        retryDynamicImport(
          async () => {
            calls += 1;
            throw new Error(`Chunk failure ${calls}`);
          },
          {
            retries: 2,
            baseDelayMs: 0,
          },
        ),
      /Chunk failure 3/,
    );

    assert.equal(calls, 3);
  });
});
