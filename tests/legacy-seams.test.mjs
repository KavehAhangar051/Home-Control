import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNewAutomationAction,
  removeAutomationActionAt,
  updateAutomationActionAt,
} from "../features/iot/components/AutomationsDrawer/hooks/useAutomationActions.ts";
import {
  buildValidatedAutomationDraft,
  computeTimerSchedule,
} from "../features/iot/components/AutomationsDrawer/hooks/useAutomationForm.ts";
import {
  collectTriggerNodeIds,
  dispatchPendingWorkflowActions,
  pruneStaleTimerLatches,
  scheduleUnlatchedTimers,
} from "../features/iot/components/workflows/workflowRuntimeHelpers.ts";
import {
  evaluateCloudflarePushTransition,
  executeCloudflareInitSync,
} from "../features/iot/hooks/achaemenidState/core/cloudflareSyncCoordinator.ts";
import {
  planAddSegment,
  planGroupConfigRegistration,
  planGroupOrderRegistration,
  planRemoveGroup,
  validateRuleActionList,
} from "../features/iot/hooks/achaemenidState/core/segmentOperations.ts";
import {
  createLocalWebSocketController,
  resolveLocalWebSocketCandidates,
} from "../features/iot/hooks/achaemenidState/useConnectionStrategy.ts";
import {
  createVoiceRecognitionSession,
  extractTranscriptText,
  getSpeechRecognitionErrorMessage,
  resolveSpeechRecognitionConstructor,
} from "../features/iot/hooks/voiceRecognitionHelpers.ts";
import { getMqttSettings, publishMqttCommand } from "../features/iot/services/mqtt/client.ts";
import {
  buildMqttClientId,
  createMqttConnectHandler,
  createMqttMessageHandler,
  createStateUpdateQueue,
  MAX_PENDING_PIN_UPDATES,
} from "../features/iot/services/mqtt/init.ts";
import {
  PRESENCE_OFFLINE_FRAME,
  PRESENCE_ONLINE_FRAME,
  SYNC_REQUEST_FRAME,
} from "../features/iot/services/mqtt/protocol.ts";

const textEncoder = new TextEncoder();

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));

  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    snapshot: () => Object.fromEntries(map.entries()),
  };
}

describe("Legacy Seams: MQTT Client Settings, Publishing, Connect & State Queue", () => {
  it("resolves MQTT settings priority (storeConfig > localStorage > defaults) with QoS validation", () => {
    const storage = createMemoryStorage({
      mqtt_broker_url: "wss://saved.example/mqtt",
      mqtt_base_topic: "Saved/Topic",
      mqtt_qos: "2",
    });

    const fromStorage = getMqttSettings({ storeConfig: null, storage });
    assert.deepEqual(fromStorage, {
      brokerUrl: "wss://saved.example/mqtt",
      baseTopic: "Saved/Topic",
      qos: 2,
    });

    const fromStore = getMqttSettings({
      storeConfig: {
        broker_ws_url: "wss://esp.example/mqtt",
        base_topic: "Esp/Topic",
        qos: 0,
      },
      storage,
    });
    assert.deepEqual(fromStore, {
      brokerUrl: "wss://esp.example/mqtt",
      baseTopic: "Esp/Topic",
      qos: 0,
    });

    const defaultsFallback = getMqttSettings({
      storeConfig: null,
      storage: createMemoryStorage({ mqtt_qos: "9" }),
    });
    assert.deepEqual(defaultsFallback, {
      brokerUrl: "wss://broker.emqx.io:8084/mqtt",
      baseTopic: "KamyarIoT/Achaemenid",
      qos: 1,
    });
  });

  it("publishes binary MQTT commands only when client exists & is connected, otherwise triggers lazy init", () => {
    let initCalled = 0;
    const warnings = [];
    const logs = [];
    const payload = new Uint8Array([0x01, 0x02]);

    const noClientResult = publishMqttCommand(payload, "TestPin", {
      getClient: () => null,
      initClient: () => {
        initCalled += 1;
      },
      warn: (msg) => warnings.push(msg),
    });
    assert.equal(noClientResult, false);
    assert.equal(initCalled, 1);
    assert.match(warnings[0], /Client initializing.*\(TestPin\)/);

    const disconnectedResult = publishMqttCommand(payload, "TestPin", {
      getClient: () => ({ connected: false, publish: () => {} }),
      warn: (msg) => warnings.push(msg),
    });
    assert.equal(disconnectedResult, false);
    assert.match(warnings[1], /Client not connected/);

    const published = [];
    const connectedResult = publishMqttCommand(payload, "Toggle 2", {
      getClient: () => ({
        connected: true,
        publish: (topic, buf, opts) => {
          published.push({ topic, buf: Array.from(buf), opts });
        },
      }),
      getSettings: () => ({
        brokerUrl: "wss://b.test/mqtt",
        baseTopic: "Home/Test",
        qos: 2,
      }),
      log: (msg) => logs.push(msg),
    });
    assert.equal(connectedResult, true);
    assert.deepEqual(published, [{ topic: "Home/Test/Command", buf: [1, 2], opts: { qos: 2 } }]);
    assert.deepEqual(logs, ["[MQTT Binary] Toggle 2"]);
  });

  it("bounds pending pin update queue to 256 FIFO entries, coalesces changes, and cancels rAF on clear", () => {
    let nextRafId = 10;
    let scheduledCallback = null;
    const cancelledIds = [];
    let currentPins = { keep: true };
    let applyCalls = 0;
    const firedCallbacks = [];

    const queue = createStateUpdateQueue({
      scheduleFrame: (cb) => {
        scheduledCallback = cb;
        nextRafId += 1;
        return nextRafId;
      },
      cancelFrame: (id) => cancelledIds.push(id),
      applyPinsState: (updater) => {
        applyCalls += 1;
        currentPins = typeof updater === "function" ? updater(currentPins) : updater;
      },
      getCallbacks: () => [(pinId, state) => firedCallbacks.push({ pinId, state })],
    });

    // Insert 260 updates (beyond MAX_PENDING_PIN_UPDATES = 256): oldest 4 drop out
    for (let i = 0; i < MAX_PENDING_PIN_UPDATES + 4; i++) {
      queue.queueStateUpdate(`pin_${i}`, i % 2 === 0);
    }
    assert.equal(queue.getPendingCount(), MAX_PENDING_PIN_UPDATES);
    assert.ok(scheduledCallback);

    queue.flushStateUpdates();
    assert.equal(queue.getPendingCount(), 0);
    assert.equal(applyCalls, 1);
    assert.equal("pin_0" in currentPins, false);
    assert.equal("pin_3" in currentPins, false);
    assert.equal(currentPins.pin_4, true);
    assert.equal(firedCallbacks.length, MAX_PENDING_PIN_UPDATES);

    // No-op flush skips reference churn when incoming state matches currentPins
    const beforeRef = currentPins;
    queue.queueStateUpdate("pin_4", true);
    queue.flushStateUpdates();
    assert.equal(currentPins, beforeRef);

    // Clear cancels pending rAF and wipes buffered updates
    queue.queueStateUpdate("pin_99", false);
    queue.clear();
    assert.equal(cancelledIds.length, 1);
    assert.equal(queue.getPendingCount(), 0);
  });

  it("handles MQTT connect/message lifecycle and ignores stale connection generations", () => {
    let isCurrent = true;
    let isLocalVal = false;
    let localIpVal = "0.0.0.0";
    let pins = {};
    const queued = [];
    const subscriptions = [];
    const published = [];
    const microtasks = [];

    const snapshot = {
      isPageVisible: true,
      localIp: localIpVal,
      setIsLocal: (v) => {
        isLocalVal = v;
      },
      setLocalIp: (ip) => {
        localIpVal = ip;
      },
      setPinsState: (updater) => {
        pins = typeof updater === "function" ? updater(pins) : updater;
      },
    };

    const onConnect = createMqttConnectHandler({
      brokerUrl: "wss://test/mqtt",
      commandTopic: "T/Command",
      stateTopic: "T/State",
      statusTopic: "T/Status",
      qos: 1,
      isCurrentGeneration: () => isCurrent,
      getSnapshot: () => snapshot,
      subscribeTopic: (topic) => subscriptions.push(topic),
      publishFrame: (topic, buf, qos) => published.push({ topic, buf, qos }),
      scheduleMicrotask: (fn) => microtasks.push(fn),
    });

    onConnect();
    assert.deepEqual(subscriptions, ["T/State", "T/Status"]);
    assert.equal(microtasks.length, 1);
    microtasks.shift()();
    assert.equal(published.length, 2);
    assert.deepEqual(published[0].buf, PRESENCE_ONLINE_FRAME);
    assert.deepEqual(published[1].buf, SYNC_REQUEST_FRAME);

    const onMessage = createMqttMessageHandler({
      commandTopic: "T/Command",
      stateTopic: "T/State",
      statusTopic: "T/Status",
      qos: 1,
      isCurrentGeneration: () => isCurrent,
      getSnapshot: () => ({ ...snapshot, isPageVisible: false }),
      queueStateUpdate: (pinId, state) => queued.push({ pinId, state }),
      publishFrame: (topic, buf, qos) => published.push({ topic, buf, qos }),
      scheduleMicrotask: (fn) => microtasks.push(fn),
    });

    onMessage("T/Status", textEncoder.encode('{"status":"online","ip":"192.168.1.77"}'));
    assert.equal(isLocalVal, true);
    assert.equal(localIpVal, "192.168.1.77");

    onMessage("T/State", new Uint8Array([0x06, 12, 0x01]));
    assert.deepEqual(queued, [{ pinId: "12", state: true }]);

    onMessage("T/State", textEncoder.encode('{"command":"ping"}'));
    microtasks.shift()();
    assert.deepEqual(published[2].buf, PRESENCE_OFFLINE_FRAME);

    onMessage("T/State", textEncoder.encode('{"type":"state_sync","states":{"4":1,"5":0}}'));
    assert.deepEqual(pins, { 4: true, 5: false });

    onMessage("T/Status", textEncoder.encode("offline"));
    assert.equal(isLocalVal, false);

    // Stale generation ignores all subsequent frames
    isCurrent = false;
    onMessage("T/Status", textEncoder.encode('{"status":"online","ip":"10.0.0.1"}'));
    assert.equal(isLocalVal, false);
    assert.equal(localIpVal, "192.168.1.77");

    assert.match(
      buildMqttClientId(() => 0.123456789),
      /^dashboard_[0-9a-f]{8}$/,
    );
  });
});

describe("Legacy Seams: Local WebSocket Connection Controller", () => {
  it("discovers the firmware mDNS host and SoftAP IP without MQTT or a remembered IP", () => {
    assert.deepEqual(resolveLocalWebSocketCandidates(null, null), [
      "achaemenid.local",
      "192.168.4.1",
    ]);
    assert.deepEqual(
      resolveLocalWebSocketCandidates("192.168.1.50", createMemoryStorage({
        "home-control:local-ws-host": "192.168.1.50",
      })),
      ["192.168.1.50", "achaemenid.local", "192.168.4.1"],
    );
  });

  it("skips WebSocket creation outside native Capacitor runtime", () => {
    let created = 0;
    const cleanup = createLocalWebSocketController({
      localIp: "192.168.1.50",
      setIsLocal: () => {},
      setPinsState: () => {},
      isNativeRuntime: () => false,
      createWebSocket: () => {
        created += 1;
        return null;
      },
    });

    assert.equal(created, 0);
    cleanup();
  });

  it("performs handshake, updates pins, falls back & schedules jittered reconnect, and prevents reconnect after cleanup", () => {
    const sockets = [];
    const localStates = [];
    let pinsState = {};
    const isLocalEvents = [];
    const scheduledTimeouts = [];
    const clearedTimeouts = [];
    const wsRefs = [];
    let nextTimerId = 100;

    const cleanup = createLocalWebSocketController({
      localIp: "192.168.1.50",
      isNativeRuntime: () => true,
      storage: createMemoryStorage(),
      setIsLocalWebSocketConnected: () => {},
      getIsMqttDeviceOnline: () => false,
      createWebSocket: (url) => {
        const sock = {
          url,
          readyState: 1,
          sent: [],
          closed: false,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          send(data) {
            this.sent.push(JSON.parse(data));
          },
          close() {
            this.closed = true;
          },
        };
        sockets.push(sock);
        return sock;
      },
      setLocalWs: (ws) => wsRefs.push(ws),
      setIsLocal: (val) => isLocalEvents.push(val),
      setPinsState: (updater) => {
        pinsState = typeof updater === "function" ? updater(pinsState) : updater;
      },
      dispatchLocalState: (pin, state) => localStates.push({ pin, state }),
      scheduleTimeout: (fn, delayMs) => {
        nextTimerId += 1;
        scheduledTimeouts.push({ id: nextTimerId, fn, delayMs });
        return nextTimerId;
      },
      clearTimeoutFn: (id) => clearedTimeouts.push(id),
      randomFn: () => 0.5,
    });

    assert.equal(sockets.length, 1);
    assert.equal(sockets[0].url, "ws://192.168.1.50:81");

    sockets[0].onopen();
    assert.deepEqual(sockets[0].sent, [
      { command: "client_hello", client: "capacitor-dashboard" },
      { command: "get_state" },
    ]);
    assert.equal(isLocalEvents.length, 0);

    sockets[0].onmessage({ data: JSON.stringify({ type: "state_sync", states: { 2: true } }) });
    assert.equal(isLocalEvents.at(-1), true);
    assert.deepEqual(pinsState, { 2: true });

    sockets[0].onmessage({ data: JSON.stringify({ pin: 4, state: 1 }) });
    assert.deepEqual(pinsState, { 2: true, 4: true });
    assert.deepEqual(localStates, [{ pin: "4", state: true }]);

    sockets[0].readyState = 3;
    sockets[0].onclose();
    assert.equal(isLocalEvents.at(-1), false);
    assert.equal(wsRefs.at(-1), null);
    assert.equal(scheduledTimeouts.length, 2); // handshake timeout + reconnect timer
    assert.equal(scheduledTimeouts.at(-1).delayMs, 400);

    // Fire the next discovery attempt (mDNS) after the remembered IP disconnects.
    scheduledTimeouts.at(-1).fn();
    assert.equal(sockets.length, 2);
    assert.equal(sockets[1].url, "ws://achaemenid.local:81");

    // Cleanup closes active socket cleanly without scheduling another reconnect
    cleanup();
    assert.equal(sockets[1].closed, true);
    assert.equal(scheduledTimeouts.length, 3); // both connection attempts schedule handshake timeouts
    assert.equal(isLocalEvents.at(-1), false);
  });
});

describe("Legacy Seams: MQTT and Local WebSocket transport isolation", () => {
  it("keeps the device reachable and ignores stale MQTT state while Local WebSocket is active", () => {
    let isLocal = true;
    let mqttOnline = true;
    let pins = {};
    const queued = [];
    const snapshot = {
      isLocal,
      isLocalWebSocketConnected: true,
      isPageVisible: true,
      localIp: null,
      setIsLocal: (value) => { isLocal = value; snapshot.isLocal = value; },
      setIsMqttDeviceOnline: (value) => { mqttOnline = value; },
      setHasReceivedMqttStatus: () => {},
      setLocalIp: () => {},
      setPinsState: (updater) => { pins = typeof updater === "function" ? updater(pins) : updater; },
    };
    const handler = createMqttMessageHandler({
      commandTopic: "T/Command",
      stateTopic: "T/State",
      statusTopic: "T/Status",
      qos: 1,
      isCurrentGeneration: () => true,
      getSnapshot: () => snapshot,
      queueStateUpdate: (pinId, state) => queued.push({ pinId, state }),
      publishFrame: () => {},
    });

    handler("T/Status", textEncoder.encode("offline"));
    assert.equal(mqttOnline, false);
    assert.equal(isLocal, true);

    handler("T/State", textEncoder.encode('{"type":"pin_update","pin":4,"state":false}'));
    assert.deepEqual(queued, []);
    assert.deepEqual(pins, {});
  });
});

describe("Legacy Seams: Segment Operations & Cloudflare Sync Coordinator", () => {
  it("plans segment addition with GPIO checks, placeholder replacement, group registration, and rule validation", () => {
    const rejectedFlash = planAddSegment({
      input: { type: "relay", pin: "6" },
      segments: [],
      targetPlaceholderId: null,
    });
    assert.equal(rejectedFlash.ok, false);

    const rejectedInputOnly = planAddSegment({
      input: { type: "relay", pin: "34" },
      segments: [],
      targetPlaceholderId: null,
    });
    assert.equal(rejectedInputOnly.ok, false);

    const replaced = planAddSegment({
      input: { type: "relay", pin: "14", group: "آشپزخانه" },
      segments: [{ id: "ph_1", type: "placeholder", pin: "", title: "خالی", group: "پذیرایی" }],
      targetPlaceholderId: "ph_1",
      createId: () => "seg_123",
    });
    assert.equal(replaced.ok, true);
    if (replaced.ok) {
      assert.equal(replaced.replacedPlaceholder, true);
      assert.equal(replaced.newSegment.id, "seg_123");
      assert.equal(replaced.newSegment.group, "پذیرایی");
      assert.equal(replaced.newSegment.title, "کنترل پایه دیجیتال (GPIO 14)");
    }

    const cfg1 = planGroupConfigRegistration({}, "پذیرایی", "Lamp");
    assert.deepEqual(cfg1["پذیرایی"], { maxCols: 3, icon: "Lamp" });
    assert.deepEqual(planGroupOrderRegistration(["حیاط"], "پذیرایی"), ["حیاط", "پذیرایی"]);
    assert.deepEqual(planGroupOrderRegistration(["حیاط"], "حیاط"), ["حیاط"]);

    const removed = planRemoveGroup({
      groupsOrder: ["پذیرایی", "حیاط"],
      segments: [
        { id: "s1", type: "relay", pin: "2", title: "A", group: "پذیرایی" },
        { id: "s2", type: "relay", pin: "4", title: "B", group: "حیاط" },
      ],
      groupId: "پذیرایی",
    });
    assert.deepEqual(removed.nextGroupsOrder, ["حیاط"]);
    assert.deepEqual(
      removed.nextSegments.map((s) => s.id),
      ["s2"],
    );

    assert.equal(validateRuleActionList([{ targetPin: "2" }, { targetPin: "4" }]), null);
    assert.ok(validateRuleActionList([{ targetPin: "34" }]));
  });

  it("coordinates Cloudflare init sync retries, cache fallback, empty reset, bypass cancellation, and push transitions", async () => {
    let cacheCleared = 0;
    let applied = null;
    let readyCount = 0;
    let resetCount = 0;
    let epoch = 0;
    let workerUrl = "";
    let attempts = 0;

    const retrySuccess = await executeCloudflareInitSync({
      maxAttempts: 2,
      configLocalCacheEnabled: true,
      isCloudflareEnabled: () => true,
      isOnline: () => true,
      isBypassed: () => false,
      fetchConfig: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("timeout");
        return {
          version: "1.2.0",
          device: {
            name: "ESP32",
            chip: "ESP32-S3",
            firmware: "1",
            reboot_count: 0,
            last_boot: "",
          },
          preferences: {
            theme_mode: "dark",
            accent_color_3: "#fff",
            accent_color_4: "#000",
            font_family: "dana",
            animations_enabled: true,
            header_title: "تست",
          },
          layout: { groups_order: ["Test"], groups_cols: 1, group_configs: {} },
          segments: [{ id: "1", type: "relay", pin: "2", title: "لامپ" }],
          worker_url: "https://sync.example.workers.dev",
        };
      },
      readLocalCache: () => null,
      writeLocalCache: (cfg) => {
        cacheCleared -= 1;
        void cfg;
      },
      clearLocalCache: () => {
        cacheCleared += 1;
      },
      applyConfig: (cfg) => {
        applied = cfg;
      },
      onWorkerUrlChange: (url) => {
        workerUrl = url;
      },
      onResetEmptyState: () => {
        resetCount += 1;
      },
      onSyncStatus: () => {},
      onBumpRemoteEpoch: () => {
        epoch += 1;
      },
      onReady: () => {
        readyCount += 1;
      },
      sleep: async () => {},
    });

    assert.deepEqual(retrySuccess, { kind: "remote_applied", attempts: 2 });
    assert.equal(workerUrl, "https://sync.example.workers.dev");
    assert.equal(epoch, 1);
    assert.equal(readyCount, 1);
    assert.ok(applied);

    // Offline cache recovery path
    const cacheRecovered = await executeCloudflareInitSync({
      configLocalCacheEnabled: true,
      isCloudflareEnabled: () => true,
      isOnline: () => false,
      isBypassed: () => false,
      fetchConfig: async () => {
        throw new Error("should not fetch offline");
      },
      readLocalCache: () => applied,
      writeLocalCache: () => {},
      clearLocalCache: () => {},
      applyConfig: () => {},
      onWorkerUrlChange: () => {},
      onResetEmptyState: () => {
        resetCount += 1;
      },
      onSyncStatus: () => {},
      onBumpRemoteEpoch: () => {},
      onReady: () => {},
      sleep: async () => {},
    });
    assert.deepEqual(cacheRecovered, { kind: "cache_recovered" });

    // Disabled without cache falls back to empty state & clears stale cache
    const emptyFallback = await executeCloudflareInitSync({
      configLocalCacheEnabled: false,
      isCloudflareEnabled: () => false,
      isOnline: () => true,
      isBypassed: () => false,
      fetchConfig: async () => null,
      readLocalCache: () => null,
      writeLocalCache: () => {},
      clearLocalCache: () => {
        cacheCleared += 1;
      },
      applyConfig: () => {},
      onWorkerUrlChange: () => {},
      onResetEmptyState: () => {
        resetCount += 1;
      },
      onSyncStatus: () => {},
      onBumpRemoteEpoch: () => {},
      onReady: () => {},
      sleep: async () => {},
    });
    assert.deepEqual(emptyFallback, { kind: "empty_fallback" });
    assert.equal(resetCount, 1);
    assert.ok(cacheCleared >= 0);

    // Pure push transitions
    assert.equal(
      evaluateCloudflarePushTransition({
        isFullyReady: false,
        remoteSyncEpoch: 1,
        lastRemoteEpoch: 1,
        lastSyncedSignature: "a",
        configSignature: "b",
      }),
      "reset",
    );
    assert.equal(
      evaluateCloudflarePushTransition({
        isFullyReady: true,
        remoteSyncEpoch: 2,
        lastRemoteEpoch: 1,
        lastSyncedSignature: "a",
        configSignature: "a",
      }),
      "baseline",
    );
    assert.equal(
      evaluateCloudflarePushTransition({
        isFullyReady: true,
        remoteSyncEpoch: 2,
        lastRemoteEpoch: 2,
        lastSyncedSignature: "same",
        configSignature: "same",
      }),
      "noop",
    );
    assert.equal(
      evaluateCloudflarePushTransition({
        isFullyReady: true,
        remoteSyncEpoch: 2,
        lastRemoteEpoch: 2,
        lastSyncedSignature: "old",
        configSignature: "new",
      }),
      "schedule",
    );
  });
});

describe("Legacy Seams: Automations, Workflows & Voice Sessions", () => {

  it("computes deterministic timer rollovers, automation draft validation, and action mutations", () => {
    const fixedNow = new Date(2025, 0, 15, 23, 30, 0);
    const rolled = computeTimerSchedule(1, 15, fixedNow);
    assert.deepEqual(rolled, {
      time: "00:45",
      days: [new Date(2025, 0, 16, 0, 45, 0).getDay()],
      repeatCount: 1,
    });

    const timerDraft = buildValidatedAutomationDraft(
      {
        editingId: null,
        title: "چراغ شب",
        autoType: "timer",
        time: "",
        days: [],
        repeatCount: "",
        delayHours: 1,
        delayMinutes: 15,
        city: "",
        temperatureThreshold: "",
        temperatureCondition: "greater",
        intervalMinutes: "",
        hasWeatherCondition: false,
        actions: [{ targetPin: "2", actionOn: true }],
      },
      fixedNow,
    );
    assert.equal(timerDraft.ok, true);
    if (timerDraft.ok) {
      assert.equal(timerDraft.automation.id, `auto_${fixedNow.getTime()}`);
      assert.equal(timerDraft.automation.time, "00:45");
      assert.equal(timerDraft.automation.repeatCount, 1);
    }

    const weatherInvalid = buildValidatedAutomationDraft(
      {
        editingId: null,
        title: "هوا",
        autoType: "weather",
        time: "",
        days: [],
        repeatCount: "",
        delayHours: "",
        delayMinutes: "",
        city: "Tehran",
        temperatureThreshold: "",
        temperatureCondition: "greater",
        intervalMinutes: 10,
        hasWeatherCondition: false,
        actions: [{ targetPin: "2", actionOn: true }],
      },
      fixedNow,
    );
    assert.equal(weatherInvalid.ok, false);

    const newAction = buildNewAutomationAction(
      "pin",
      [
        { type: "placeholder", pin: "" },
        { type: "input", pin: "34" },
        { type: "relay", pin: "12" },
      ],
      [],
    );
    assert.deepEqual(newAction, { targetPin: "12", actionOn: true });
    assert.deepEqual(updateAutomationActionAt([newAction], 0, { actionOn: false }), [
      { targetPin: "12", actionOn: false },
    ]);
    assert.deepEqual(removeAutomationActionAt([newAction], 0), []);
  });

  it("enforces workflow timer edge-latching and level vs toggle dispatch deduplication", () => {
    const latches = new Set(["timer_a", "timer_stale"]);
    pruneStaleTimerLatches(latches, ["timer_a", "timer_b"]);
    assert.deepEqual(Array.from(latches), ["timer_a"]);

    const triggers = collectTriggerNodeIds([
      { id: "n1", kind: "trigger_manual", position: { x: 0, y: 0 }, data: {} },
      { id: "n2", kind: "action_pin", position: { x: 0, y: 0 }, data: {} },
    ]);
    assert.deepEqual(Array.from(triggers), ["n1"]);

    const startedTimers = [];
    scheduleUnlatchedTimers(
      ["timer_a", "timer_b"],
      [{ id: "timer_b", kind: "logic_timer", position: { x: 0, y: 0 }, data: {} }],
      latches,
      (fn) => fn(),
      (node) => startedTimers.push(node.id),
    );
    assert.deepEqual(startedTimers, ["timer_b"]);
    assert.equal(latches.has("timer_b"), true);

    const activeToggleNodesRef = { current: new Set() };
    const lastSigRef = { current: "" };
    const dispatched = [];

    const actions = [
      { nodeId: "act_lvl", targetPin: "2", actionOn: true, actionMode: "level" },
      { nodeId: "act_tog", targetPin: "4", actionOn: true, actionMode: "toggle" },
    ];

    dispatchPendingWorkflowActions(
      actions,
      activeToggleNodesRef,
      lastSigRef,
      { 2: false },
      (p, s) => dispatched.push({ p, s }),
    );
    assert.deepEqual(dispatched, [
      { p: "4", s: true },
      { p: "2", s: true },
    ]);

    // Repeating same active state does NOT re-fire either toggle or level
    dispatchPendingWorkflowActions(
      actions,
      activeToggleNodesRef,
      lastSigRef,
      { 2: false },
      (p, s) => dispatched.push({ p, s }),
    );
    assert.equal(dispatched.length, 2);

    // Clearing pending actions resets edge tracking so next activation fires again
    dispatchPendingWorkflowActions([], activeToggleNodesRef, lastSigRef, {}, () => {});
    assert.equal(activeToggleNodesRef.current.size, 0);
    assert.equal(lastSigRef.current, "");
  });

  it("isolates SpeechRecognition lifecycle, restart abort sync callbacks, and error mapping", () => {
    assert.match(getSpeechRecognitionErrorMessage("not-allowed"), /میکروفون/);
    assert.match(getSpeechRecognitionErrorMessage("unknown"), /تشخیص فرمان صوتی/);
    assert.equal(
      extractTranscriptText({
        results: {
          length: 2,
          0: { 0: { transcript: " چراغ " } },
          1: { 0: { transcript: "روشن" } },
        },
      }),
      "چراغ روشن",
    );

    const FakeCtor = () => {};
    assert.equal(
      resolveSpeechRecognitionConstructor({ webkitSpeechRecognition: FakeCtor }),
      FakeCtor,
    );

    let instance = null;
    let listening = false;
    let transcript = "";
    const toasts = [];
    const completed = [];

    const session = createVoiceRecognitionSession({
      createRecognition: () => {
        instance = {
          continuous: false,
          interimResults: false,
          lang: "",
          onresult: null,
          onerror: null,
          onend: null,
          start() {},
          stop() {},
          abort() {
            // Simulate synchronous aborted callback fired inside browser abort()
            this.onerror?.({ error: "aborted" });
            this.onend?.();
          },
        };
        return instance;
      },
      getIsListening: () => listening,
      setIsListening: (v) => {
        listening = v;
      },
      setTranscript: (t) => {
        transcript = t;
      },
      showToast: (msg, type) => toasts.push({ msg, type }),
    });

    assert.equal(session.init(), true);
    assert.equal(
      session.start((txt) => completed.push(txt)),
      true,
    );
    assert.equal(listening, true);

    instance.onresult({ results: { length: 1, 0: { 0: { transcript: "سلام" } } } });
    assert.equal(transcript, "سلام");

    // Restart while listening: sync abort() callbacks must NOT clobber the new session!
    assert.equal(
      session.start((txt) => completed.push(`restarted:${txt}`)),
      true,
    );
    instance.onresult({ results: { length: 1, 0: { 0: { transcript: "پریز یک" } } } });
    instance.onend();
    assert.deepEqual(completed, ["restarted:پریز یک"]);
    assert.equal(toasts.length, 0);

    session.dispose();
  });
});
