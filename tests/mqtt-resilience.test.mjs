import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMqttResumeController } from "../features/iot/services/mqtt/init.ts";
import { PRESENCE_ONLINE_FRAME, SYNC_REQUEST_FRAME } from "../features/iot/services/mqtt/protocol.ts";

describe("MQTT Resume & Reconnect Controller", () => {
  it("returns noop when MQTT client has not been initialized", () => {
    const resume = createMqttResumeController({
      getClient: () => null,
      getSettings: () => ({ baseTopic: "Home/Test", qos: 1 }),
    });

    assert.equal(resume(), "noop");
  });

  it("publishes presence online and state sync once per cooldown window when connected", () => {
    let clock = 10_000;
    const published = [];

    const resume = createMqttResumeController({
      getClient: () => ({
        connected: true,
        publish: (topic, payload, options) => published.push({ topic, payload, options }),
      }),
      getSettings: () => ({ baseTopic: "Home/Test", qos: 2 }),
      now: () => clock,
      minSyncIntervalMs: 3000,
    });

    assert.equal(resume(), "synced");
    assert.equal(published.length, 2);
    assert.equal(published[0].topic, "Home/Test/Command");
    assert.deepEqual(published[0].payload, PRESENCE_ONLINE_FRAME);
    assert.deepEqual(published[1].payload, SYNC_REQUEST_FRAME);
    assert.deepEqual(published[0].options, { qos: 2 });

    // Immediate second call within 3s cooldown is throttled
    clock += 1200;
    assert.equal(resume(), "throttled");
    assert.equal(published.length, 2);

    // After cooldown expires, syncs again
    clock += 2000;
    assert.equal(resume(), "synced");
    assert.equal(published.length, 4);
  });

  it("triggers immediate reconnect when client exists but disconnected while asleep", () => {
    let clientReconnectCalls = 0;
    let fallbackReconnectCalls = 0;

    const resumeWithClientMethod = createMqttResumeController({
      getClient: () => ({
        connected: false,
        publish: () => {},
        reconnect: () => {
          clientReconnectCalls += 1;
        },
      }),
      getSettings: () => ({ baseTopic: "Home/Test", qos: 1 }),
      onReconnect: () => {
        fallbackReconnectCalls += 1;
      },
    });

    assert.equal(resumeWithClientMethod(), "reconnected");
    assert.equal(clientReconnectCalls, 1);
    assert.equal(fallbackReconnectCalls, 0);

    const resumeWithFallback = createMqttResumeController({
      getClient: () => ({
        connected: false,
        publish: () => {},
      }),
      getSettings: () => ({ baseTopic: "Home/Test", qos: 1 }),
      onReconnect: () => {
        fallbackReconnectCalls += 1;
      },
    });

    assert.equal(resumeWithFallback(), "reconnected");
    assert.equal(fallbackReconnectCalls, 1);
  });
});
