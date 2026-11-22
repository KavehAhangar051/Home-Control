import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLocalWebSocketController } from "../features/iot/hooks/achaemenidState/useConnectionStrategy.ts";
import {
  createMqttMessageHandler,
  createMqttResumeController,
  createStateUpdateQueue,
} from "../features/iot/services/mqtt/init.ts";
import {
  PRESENCE_ONLINE_FRAME,
  SYNC_REQUEST_FRAME,
} from "../features/iot/services/mqtt/protocol.ts";

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

describe("Rapid Toggle Race Condition — command_ack isolation", () => {
  const encodeJson = (obj) => new TextEncoder().encode(JSON.stringify(obj));

  const createMockSnapshot = (initialPinsState = { 5: false }) => {
    const snapshot = {
      isLocal: true,
      localIp: "192.168.1.50",
      isPageVisible: true,
      pinsState: { ...initialPinsState },
      pinsAnalogValue: { 5: 0 },
      pinsLastNonZeroValue: { 5: 255 },
      pinsPwmResolution: { 5: 8 },
      autoOffRemaining: { 5: 30 },
      setIsLocal: (val) => {
        snapshot.isLocal = val;
      },
      setLocalIp: (val) => {
        snapshot.localIp = val;
      },
      setPinsState: (updater) => {
        snapshot.pinsState = typeof updater === "function" ? updater(snapshot.pinsState) : updater;
      },
      setAutoOffRemaining: (timers) => {
        snapshot.autoOffRemaining = timers;
      },
      setPinsAnalogValue: (updater) => {
        snapshot.pinsAnalogValue =
          typeof updater === "function" ? updater(snapshot.pinsAnalogValue) : updater;
      },
      setPinsLastNonZeroValue: (updater) => {
        snapshot.pinsLastNonZeroValue =
          typeof updater === "function" ? updater(snapshot.pinsLastNonZeroValue) : updater;
      },
      setPinsPwmResolution: (updater) => {
        snapshot.pinsPwmResolution =
          typeof updater === "function" ? updater(snapshot.pinsPwmResolution) : updater;
      },
    };

    return snapshot;
  };

  it("ignores delayed command_ack state/value in MQTT handler and preserves rapid user toggle", () => {
    const snapshot = createMockSnapshot({ 5: false });
    const ackedPins = [];
    const queueCalls = [];

    const stateQueue = createStateUpdateQueue({
      scheduleFrame: () => 1,
      cancelFrame: () => {},
      getSnapshot: () => snapshot,
      getCallbacks: () => [],
    });

    const handler = createMqttMessageHandler({
      commandTopic: "Home/Test/Command",
      stateTopic: "Home/Test/State",
      statusTopic: "Home/Test/Status",
      qos: 1,
      isCurrentGeneration: () => true,
      getSnapshot: () => snapshot,
      queueStateUpdate: (pinId, state, telemetry) => {
        queueCalls.push({ pinId, state, telemetry });
        stateQueue.queueStateUpdate(pinId, state, telemetry);
      },
      onCommandAck: (pinId) => {
        ackedPins.push(pinId);
      },
      flushStateUpdates: stateQueue.flushStateUpdates,
      publishFrame: () => {},
    });

    // Delayed ACK from earlier ON arrives while pin is already toggled OFF by user
    handler(
      "Home/Test/State",
      encodeJson({ type: "command_ack", pin: 5, state: true, value: 255 }),
    );
    stateQueue.flushStateUpdates();

    assert.equal(queueCalls.length, 0);
    assert.equal(snapshot.pinsState["5"], false);
    assert.equal(snapshot.pinsAnalogValue["5"], 0);
    assert.equal(snapshot.autoOffRemaining["5"], 30);
    assert.deepEqual(ackedPins, ["5"]);

    // Real hardware pin_update must still update UI state normally
    handler(
      "Home/Test/State",
      encodeJson({ type: "pin_update", pin: 5, state: true, source: "physical_input" }),
    );
    stateQueue.flushStateUpdates();

    assert.equal(queueCalls.length, 1);
    assert.equal(snapshot.pinsState["5"], true);
    assert.equal(snapshot.autoOffRemaining["5"], 0);
  });

  it("isolates delayed command_ack in Local WebSocket controller without mutating state", () => {
    let pinsState = { 5: false };
    let analogValues = { 5: 0 };
    let timers = { 5: 30 };
    let setPinsCalls = 0;
    let setAnalogCalls = 0;
    let setTimersCalls = 0;
    const dispatched = [];
    const ackedPins = [];
    let activeSocket = null;

    const cleanup = createLocalWebSocketController({
      localIp: "192.168.1.50",
      isNativeRuntime: () => true,
      createWebSocket: () => {
        activeSocket = {
          readyState: 1,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          send: () => {},
          close: () => {},
        };
        return activeSocket;
      },
      setLocalWs: () => {},
      setIsLocal: () => {},
      setPinsState: (updater) => {
        setPinsCalls += 1;
        pinsState = typeof updater === "function" ? updater(pinsState) : updater;
      },
      setPinsAnalogValue: (updater) => {
        setAnalogCalls += 1;
        analogValues = typeof updater === "function" ? updater(analogValues) : updater;
      },
      setAutoOffRemaining: (next) => {
        setTimersCalls += 1;
        timers = next;
      },
      dispatchLocalState: (pin, state) => {
        dispatched.push({ pin, state });
      },
      onCommandAck: (pinId) => {
        ackedPins.push(pinId);
      },
    });

    activeSocket.onmessage({
      data: JSON.stringify({ type: "command_ack", pin: 5, state: true, value: 255 }),
    });

    assert.equal(setPinsCalls, 0);
    assert.equal(setAnalogCalls, 0);
    assert.equal(setTimersCalls, 0);
    assert.equal(dispatched.length, 0);
    assert.equal(pinsState["5"], false);
    assert.equal(analogValues["5"], 0);
    assert.equal(timers["5"], 30);
    assert.deepEqual(ackedPins, ["5"]);

    // Real pin_update still applies and dispatches normally
    activeSocket.onmessage({
      data: JSON.stringify({ type: "pin_update", pin: 5, state: true, source: "physical_input" }),
    });

    assert.equal(setPinsCalls, 1);
    assert.equal(pinsState["5"], true);
    assert.equal(timers["5"], 0);
    assert.deepEqual(dispatched, [{ pin: "5", state: true }]);

    cleanup();
  });
});
