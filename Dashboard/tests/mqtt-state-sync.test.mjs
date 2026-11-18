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
        timers: { "5": 297.2, "18": 0 },
      }),
    );

    assert.deepEqual(parsed, {
      kind: "state_sync",
      states: { "5": true, "18": false },
      timers: { "5": 298, "18": 0 },
    });
  });

  it("treats missing timer metadata as an empty timer map", () => {
    const parsed = parseMqttStateMessage(
      encode({ type: "state_sync", states: { "5": true } }),
    );

    assert.deepEqual(parsed, {
      kind: "state_sync",
      states: { "5": true },
      timers: {},
    });
  });
});
