import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMqttStateMessage } from "../features/iot/services/mqtt/messageParser.ts";

const encode = (value) => new TextEncoder().encode(JSON.stringify(value));

describe("MQTT state snapshot parsing", () => {
  it("normalizes output timer remaining seconds with pin states", () => {
    const parsed = parseMqttStateMessage(
      encode({
        type: "state_sync",
        states: { "5": true, "18": false },
        timers: { "5": 297.2, "18": 45 },
      }),
    );

    assert.deepEqual(parsed, {
      kind: "state_sync",
      states: { "5": true, "18": false },
      timers: { "5": 298, "18": 0 },
    });
  });

  it("treats missing timer metadata as inactive for every synchronized pin", () => {
    const parsed = parseMqttStateMessage(
      encode({ type: "state_sync", states: { "5": true } }),
    );

    assert.deepEqual(parsed, {
      kind: "state_sync",
      states: { "5": true },
      timers: { "5": 0 },
    });
  });
});
