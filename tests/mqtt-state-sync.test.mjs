import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMqttStateMessage } from "../features/iot/services/mqtt/messageParser.ts";

const encode = (value) => new TextEncoder().encode(JSON.stringify(value));

describe("MQTT state snapshot parsing", () => {
  it("normalizes output timer remaining seconds with pin states", () => {
    const parsed = parseMqttStateMessage(
      encode({
        type: "state_sync",
        states: { 5: true, 18: false },
        timers: { 5: 297.2, 18: 45 },
      }),
    );

    assert.deepEqual(parsed, {
      kind: "state_sync",
      states: { 5: true, 18: false },
      timers: { 5: 298, 18: 0 },
    });
  });

  it("treats missing timer metadata as inactive for every synchronized pin", () => {
    const parsed = parseMqttStateMessage(encode({ type: "state_sync", states: { 5: true } }));

    assert.deepEqual(parsed, {
      kind: "state_sync",
      states: { 5: true },
      timers: { 5: 0 },
    });
  });
});

describe("command_ack parser & pinAckBus isolation", () => {
  it("parses command_ack as its own variant rather than pin_update", () => {
    const parsed = parseMqttStateMessage(encode({ type: "command_ack", pin: 5, state: true }));

    assert.equal(parsed.kind, "command_ack");
    assert.deepEqual(parsed, {
      kind: "command_ack",
      pinId: "5",
      state: true,
      value: undefined,
      resolution: undefined,
    });

    const minimalAck = parseMqttStateMessage(encode({ type: "command_ack", pin: 12 }));

    assert.deepEqual(minimalAck, {
      kind: "command_ack",
      pinId: "12",
      state: undefined,
      value: undefined,
      resolution: undefined,
    });
  });

  it("parses physical pin_update payloads as kind pin_update", () => {
    const parsed = parseMqttStateMessage(
      encode({ type: "pin_update", pin: 5, state: true, source: "physical_input" }),
    );

    assert.deepEqual(parsed, {
      kind: "pin_update",
      pinId: "5",
      state: true,
      source: "json",
      value: undefined,
      resolution: undefined,
    });
  });

  it("delivers per-pin ACK notifications only to matching pin listeners", async () => {
    const { subscribePinCommandAck, notifyPinCommandAck } = await import(
      "../features/iot/services/pinAckBus.ts"
    );

    let pin5Count = 0;
    let pin18Count = 0;

    const unsub5 = subscribePinCommandAck("5", () => {
      pin5Count += 1;
    });
    const unsub18 = subscribePinCommandAck("18", () => {
      pin18Count += 1;
    });

    notifyPinCommandAck("5");
    assert.equal(pin5Count, 1);
    assert.equal(pin18Count, 0);

    unsub5();
    notifyPinCommandAck("5");
    assert.equal(pin5Count, 1);

    unsub18();
  });
});
