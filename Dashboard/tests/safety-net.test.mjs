import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildEspConfig,
  persistStoreConfigToCloudflare,
} from "../features/iot/hooks/achaemenidState/core/buildEspConfig.ts";
import {
  executeBatchPinUpdate,
  executeSinglePinUpdate,
} from "../features/iot/hooks/achaemenidState/usePinOperations.ts";
import { useIoTStore } from "../features/iot/hooks/useIoTStore.ts";
import {
  fetchConfigFromCloudflare,
  getCloudflareReliabilityHealth,
  saveConfigToCloudflare,
  updateBatchPinsOnCloudflare,
  updatePinOnCloudflare,
} from "../features/iot/services/cloudflare/api.ts";
import {
  getCloudflareWorkerUrl,
  isCloudflareEnabled,
  setCloudflareWorkerUrl,
} from "../features/iot/services/cloudflare/config.ts";
import {
  InMemoryDeviceSyncAdapter,
  LiveDeviceSyncAdapter,
} from "../features/iot/services/deviceGatewayAdapter.ts";
import { dispatchLocalState, onLocalStateUpdate } from "../features/iot/services/localWs/client.ts";
import {
  parseMqttStateMessage,
  parseMqttStatusMessage,
  toBooleanPinState,
} from "../features/iot/services/mqtt/messageParser.ts";
import {
  buildBatchPinCommandFrame,
  buildPinCommandFrame,
} from "../features/iot/services/mqtt/pinPublishers.ts";
import {
  BATCH_ACTION_SIZE,
  BATCH_HEADER_SIZE,
  MQTT_OPCODES,
  PIN_COMMAND_BUFFER_SIZE,
  PIN_STATE_HIGH,
  PIN_STATE_LOW,
} from "../features/iot/services/mqtt/protocol.ts";
import {
  buildAddSegmentFrame,
  buildDeleteSegmentFrame,
  buildUpdateRuleFrame,
} from "../features/iot/services/mqtt/segmentPublishers.ts";
import { fetchArchivePlaylist, fetchTrackUrl } from "../lib/audio/playlist.ts";
import {
  CircuitBreaker,
  CircuitOpenError,
  computeFullJitterDelayMs,
  createTimeoutSignal,
  retryWithBackoff,
} from "../lib/resilience.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

describe("Phase 1 Safety Net: MQTT Binary Wire Encoders", () => {
  it("encodes single pin toggle frame with signed 32-bit LE timer", () => {
    const frameOn = buildPinCommandFrame("14", true, 5000);
    assert.equal(frameOn.length, PIN_COMMAND_BUFFER_SIZE);
    assert.equal(frameOn[0], MQTT_OPCODES.TOGGLE_PIN);
    assert.equal(frameOn[1], 14);
    assert.equal(frameOn[2], PIN_STATE_HIGH);
    assert.equal(new DataView(frameOn.buffer).getInt32(3, true), 5000);

    const frameOffDefault = buildPinCommandFrame("2", false);
    assert.equal(frameOffDefault[2], PIN_STATE_LOW);
    assert.equal(new DataView(frameOffDefault.buffer).getInt32(3, true), -1);
  });

  it("encodes batch pin command frames and rejects empty action lists", () => {
    assert.equal(buildBatchPinCommandFrame([]), null);

    const frame = buildBatchPinCommandFrame([
      { pin: "4", state: true, timer: 1200 },
      { pin: "5", state: false },
    ]);
    assert.ok(frame);
    assert.equal(frame.length, BATCH_HEADER_SIZE + 2 * BATCH_ACTION_SIZE);
    assert.equal(frame[0], MQTT_OPCODES.BATCH_PINS);
    assert.equal(frame[1], 2);

    const view = new DataView(frame.buffer);
    assert.equal(frame[2], 4);
    assert.equal(frame[3], PIN_STATE_HIGH);
    assert.equal(view.getInt32(4, true), 1200);
    assert.equal(frame[8], 5);
    assert.equal(frame[9], PIN_STATE_LOW);
    assert.equal(view.getInt32(10, true), -1);
  });

  it("encodes add_segment, delete_segment, and update_rule binary frames", () => {
    const addBuf = buildAddSegmentFrame("seg_1", "relay", 12, true);
    assert.equal(addBuf[0], MQTT_OPCODES.ADD_SEGMENT);
    assert.equal(addBuf[1], 12);
    assert.equal(addBuf[2], PIN_STATE_HIGH);
    const decodedStrings = textDecoder.decode(addBuf.slice(3)).split("\0");
    assert.equal(decodedStrings[0], "seg_1");
    assert.equal(decodedStrings[1], "relay");

    const delBuf = buildDeleteSegmentFrame("seg_1");
    assert.equal(delBuf[0], MQTT_OPCODES.DELETE_SEGMENT);
    assert.equal(textDecoder.decode(delBuf.slice(1, delBuf.length - 1)), "seg_1");
    assert.equal(delBuf[delBuf.length - 1], 0);

    const ruleBuf = buildUpdateRuleFrame(
      "in_1",
      [{ reqHold: 500, targetPin: "4", actionOn: true, actionType: 1, delay: 200 }],
      [{ reqHold: 0, targetPin: "5", actionOn: false }],
    );
    assert.equal(ruleBuf[0], MQTT_OPCODES.UPDATE_RULE);
    assert.equal(textDecoder.decode(ruleBuf.slice(1, 5)), "in_1");
    assert.equal(ruleBuf[5], 0);
    assert.equal(ruleBuf[6], 1);
    assert.equal(ruleBuf[7], 4);
    const ruleView = new DataView(ruleBuf.buffer);
    assert.equal(ruleView.getInt32(8, true), 500);
    assert.equal(ruleBuf[12], 1);
    assert.equal(ruleBuf[13], 1);
    assert.equal(ruleView.getInt32(14, true), 200);
    assert.equal(ruleBuf[18], 1);
    assert.equal(ruleBuf[19], 5);
  });
});

describe("Phase 1 Safety Net: MQTT Incoming Payload Parsers", () => {
  it("normalizes ESP32 raw pin values cleanly", () => {
    assert.equal(toBooleanPinState(true), true);
    assert.equal(toBooleanPinState(1), true);
    assert.equal(toBooleanPinState("1"), true);
    assert.equal(toBooleanPinState("true"), true);
    assert.equal(toBooleanPinState(false), false);
    assert.equal(toBooleanPinState(0), false);
    assert.equal(toBooleanPinState("0"), false);
    assert.equal(toBooleanPinState(null), false);
  });

  it("parses LWT status plain-text and JSON status frames", () => {
    assert.deepEqual(parseMqttStatusMessage(textEncoder.encode("offline")), { kind: "offline" });
    assert.deepEqual(parseMqttStatusMessage(textEncoder.encode(" OFFLINE \n")), {
      kind: "offline",
    });
    assert.deepEqual(
      parseMqttStatusMessage(textEncoder.encode('{"status":"online","ip":"192.168.1.44"}')),
      { kind: "online", ip: "192.168.1.44" },
    );
    assert.deepEqual(parseMqttStatusMessage(textEncoder.encode('{"status":"offline"}')), {
      kind: "offline",
    });
    assert.equal(parseMqttStatusMessage(new Uint8Array([])).kind, "ignored");
    assert.equal(parseMqttStatusMessage(textEncoder.encode("{bad json")).kind, "error");
  });

  it("parses binary 0x06 pin frames, full state_sync, ping, and JSON pin updates", () => {
    assert.deepEqual(parseMqttStateMessage(new Uint8Array([0x06, 15, 0x01])), {
      kind: "pin_update",
      pinId: "15",
      state: true,
      source: "binary",
    });

    assert.deepEqual(
      parseMqttStateMessage(
        textEncoder.encode('{"type":"state_sync","states":{"2":1,"4":"true","5":0}}'),
      ),
      { kind: "state_sync", states: { 2: true, 4: true, 5: false } },
    );

    assert.deepEqual(parseMqttStateMessage(textEncoder.encode('{"command":"ping"}')), {
      kind: "ping",
    });

    assert.deepEqual(parseMqttStateMessage(textEncoder.encode('{"id":13,"value":"1"}')), {
      kind: "pin_update",
      pinId: "13",
      state: true,
      source: "json",
    });

    assert.equal(parseMqttStateMessage(textEncoder.encode("{broken")).kind, "error");
  });
});

describe("Phase 1 Safety Net: Cloudflare Worker Config & API Client", () => {
  it("normalizes trailing slashes, migrates legacy URLs, and toggles enabled status", () => {
    const originalUrl = getCloudflareWorkerUrl();
    try {
      setCloudflareWorkerUrl("https://api.agkalaa.ir/");
      assert.equal(
        getCloudflareWorkerUrl(),
        "https://home-control-db.kamyarahangar157.workers.dev",
      );
      assert.equal(isCloudflareEnabled(), true);

      setCloudflareWorkerUrl("https://custom-worker.example.workers.dev/");
      assert.equal(getCloudflareWorkerUrl(), "https://custom-worker.example.workers.dev");
      assert.equal(isCloudflareEnabled(), true);

      setCloudflareWorkerUrl("");
      assert.equal(isCloudflareEnabled(), false);
    } finally {
      setCloudflareWorkerUrl(originalUrl);
    }
  });

  it("fetches and normalizes Cloudflare config and stamps active worker_url", async () => {
    const originalUrl = getCloudflareWorkerUrl();
    setCloudflareWorkerUrl("https://custom-worker.example.workers.dev");

    try {
      const config = await fetchConfigFromCloudflare({
        circuitBreaker: new CircuitBreaker({ serviceName: "test-fetch" }),
        fetchFn: async (input) => {
          assert.equal(input, "https://custom-worker.example.workers.dev/config");

          return new Response(
            JSON.stringify({
              version: "1.2.0",
              worker_url: "https://api.agkalaa.ir",
              segments: [{ id: "s1", type: "relay", pin: "2", title: "لامپ" }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });

      assert.ok(config);
      assert.equal(config.worker_url, "https://custom-worker.example.workers.dev");
      assert.equal(config.segments.length, 1);
      assert.equal(config.segments[0].pin, "2");
    } finally {
      setCloudflareWorkerUrl(originalUrl);
    }
  });

  it("handles POST ACK success, non-JSON error responses, and empty batch short-circuit", async () => {
    const originalUrl = getCloudflareWorkerUrl();
    setCloudflareWorkerUrl("https://custom-worker.example.workers.dev");
    const breaker = new CircuitBreaker({ serviceName: "test-post" });

    try {
      const okRes = await updatePinOnCloudflare("4", true, {
        circuitBreaker: breaker,
        fetchFn: async (input, init) => {
          assert.equal(input, "https://custom-worker.example.workers.dev/pins/4");
          assert.equal(init?.method, "POST");

          return new Response(JSON.stringify({ ack: true }), { status: 200 });
        },
      });
      assert.deepEqual(okRes, { success: true, message: "وضعیت پین 4 ذخیره شد." });

      const errRes = await saveConfigToCloudflare(
        buildEspConfig({
          isDark: true,
          accent3: "#fff",
          accent4: "#000",
          selectedFont: "dana",
          animationsEnabled: true,
          animationsFps: 60,
          headerTitle: "تست",
          manualSaveMode: false,
          groupsOrder: [],
          groupsCols: 1,
          groupConfigs: {},
          segments: [],
          automations: [],
          macros: [],
          voiceCommands: [],
          wifiNetworks: [],
          wifiNetworksConfigured: false,
          wifiApConfig: null,
          mqttConfig: null,
        }),
        {
          circuitBreaker: breaker,
          fetchFn: async () => new Response("Internal Server Error", { status: 500 }),
        },
      );
      assert.equal(errRes.success, false);
      assert.ok(errRes.message.length > 0);

      const emptyBatch = await updateBatchPinsOnCloudflare([], {
        circuitBreaker: breaker,
        fetchFn: async () => {
          throw new Error("Should not hit network on empty batch");
        },
      });
      assert.equal(emptyBatch.success, true);
    } finally {
      setCloudflareWorkerUrl(originalUrl);
    }
  });
});

describe("Phase 1 Safety Net: LiveDeviceSyncAdapter Multi-Transport Routing", () => {
  it("routes single pin via open Local WebSocket before MQTT fallback and skips CF for push mode", async () => {
    const wsSent = [];
    const mqttSent = [];
    const cfSent = [];

    const adapter = new LiveDeviceSyncAdapter({
      getIsLocal: () => true,
      getLocalWs: () => ({ readyState: 1, send: (data) => wsSent.push(JSON.parse(data)) }),
      getSegments: () => [{ pin: "2", mode: "push" }],
      getShowToast: () => undefined,
      publishPinCommand: (pin, val, timer) => {
        mqttSent.push({ pin, val, timer });
        return true;
      },
      isCloudflareEnabled: () => true,
      updatePinOnCloudflare: async (pin, val) => {
        cfSent.push({ pin, val });
        return { success: true, message: "ok" };
      },
      updateBatchPinsOnCloudflare: async () => ({ success: true, message: "ok" }),
      publishBatchPinCommand: () => true,
    });

    const delivered = await adapter.syncSinglePin("2", true, { autoOff: 3000 });
    assert.equal(delivered, true);
    assert.deepEqual(wsSent, [{ command: "set_state", pin: 2, state: 1, timer: 3000 }]);
    assert.equal(mqttSent.length, 0);
    assert.equal(cfSent.length, 0);
  });

  it("shows offline error toast when neither WS, MQTT, nor Cloudflare succeeds", async () => {
    const toasts = [];
    const adapter = new LiveDeviceSyncAdapter({
      getIsLocal: () => false,
      getLocalWs: () => null,
      getSegments: () => [{ pin: "4", mode: "switch" }],
      getShowToast: () => (msg, type) => toasts.push({ msg, type }),
      publishPinCommand: () => false,
      isCloudflareEnabled: () => false,
      updatePinOnCloudflare: async () => ({ success: false, message: "" }),
      updateBatchPinsOnCloudflare: async () => ({ success: false, message: "" }),
      publishBatchPinCommand: () => false,
    });

    const delivered = await adapter.syncSinglePin("4", true);
    assert.equal(delivered, false);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, "error");
  });

  it("excludes push-mode segments from Cloudflare batch persistence while sending full MQTT batch", async () => {
    const mqttBatches = [];
    const cfBatches = [];
    const adapter = new LiveDeviceSyncAdapter({
      getIsLocal: () => false,
      getLocalWs: () => null,
      getSegments: () => [
        { pin: "2", mode: "switch", auto_off: 1000 },
        { pin: "4", mode: "push" },
      ],
      getShowToast: () => undefined,
      publishPinCommand: () => true,
      publishBatchPinCommand: (actions) => {
        mqttBatches.push(actions);
        return true;
      },
      isCloudflareEnabled: () => true,
      updatePinOnCloudflare: async () => ({ success: true, message: "ok" }),
      updateBatchPinsOnCloudflare: async (actions) => {
        cfBatches.push(actions);
        return { success: true, message: "ok" };
      },
    });

    const delivered = await adapter.syncBatchPins([
      { targetPin: "2", actionOn: true },
      { targetPin: "4", actionOn: false },
    ]);
    assert.equal(delivered, true);
    assert.deepEqual(mqttBatches[0], [
      { pin: "2", state: true, timer: 1000 },
      { pin: "4", state: false, timer: undefined },
    ]);
    assert.deepEqual(cfBatches[0], [{ pin: "2", state: true }]);
  });
});

describe("Phase 1 Safety Net: IoT Store, Local WS Client, Playlist & AP Validation", () => {
  it("hydrates useIoTStore cleanly via applyEspConfig", () => {
    useIoTStore.getState().setPinsState({});
    useIoTStore.getState().applyEspConfig({
      version: "1.2.0",
      device: { name: "ESP32", chip: "ESP32-S3", firmware: "1.0", reboot_count: 0, last_boot: "" },
      preferences: {
        theme_mode: "light",
        accent_color_3: "#112233",
        accent_color_4: "#445566",
        font_family: "vazirmatn",
        animations_enabled: false,
        animations_fps: 30,
        header_title: "خانه تست",
        manual_save_mode: true,
      },
      layout: { groups_order: ["پذیرایی"], groups_cols: 2, group_configs: {} },
      segments: [{ id: "s1", type: "relay", pin: "2", title: "نور", state: true }],
      automations: [],
      macros: [],
      voiceCommands: [],
      worker_url: "https://example.workers.dev",
    });

    const state = useIoTStore.getState();
    assert.equal(state.isDark, false);
    assert.equal(state.selectedFont, "vazirmatn");
    assert.equal(state.headerTitle, "خانه تست");
    assert.equal(state.manualSaveMode, true);
    assert.equal(state.unsavedChangesCount, 0);
    assert.equal(state.pinsState["2"], true);
  });

  it("registers, dispatches, and cleanly unsubscribes Local WS state listeners", () => {
    const seen = [];
    const unsubscribe = onLocalStateUpdate((pin, val) => seen.push({ pin, val }));
    dispatchLocalState("12", true);
    unsubscribe();
    dispatchLocalState("12", false);
    assert.deepEqual(seen, [{ pin: "12", val: true }]);
  });

  it("resolves Archive.org playlist & nested MP3 track URLs with injected fetch", async () => {
    const playlist = await fetchArchivePlaylist(async () => {
      return new Response(JSON.stringify({ response: { docs: [{ identifier: "track_1" }] } }), {
        status: 200,
      });
    });
    assert.equal(playlist.length, 1);

    const trackUrl = await fetchTrackUrl("my album", async () => {
      return new Response(
        JSON.stringify({
          files: [{ name: "folder/song name.mp3", format: "128Kbps MP3" }],
        }),
        { status: 200 },
      );
    });
    assert.equal(trackUrl, "https://archive.org/download/my%20album/folder/song%20name.mp3");
  });

  it("drops invalid Wi-Fi AP credentials (short password) while keeping cleared or valid AP configs", () => {
    const baseSource = {
      isDark: true,
      accent3: "#fff",
      accent4: "#000",
      selectedFont: "dana",
      animationsEnabled: true,
      animationsFps: 60,
      headerTitle: "تست",
      manualSaveMode: false,
      groupsOrder: [],
      groupsCols: 1,
      groupConfigs: {},
      segments: [],
      automations: [],
      macros: [],
      voiceCommands: [],
      wifiNetworks: [],
      wifiNetworksConfigured: false,
      mqttConfig: null,
    };

    const invalidAp = buildEspConfig({
      ...baseSource,
      wifiApConfig: { ssid: "HomeAP", password: "123" },
    });
    assert.equal(invalidAp.wifi, undefined);

    const validAp = buildEspConfig({
      ...baseSource,
      wifiApConfig: { ssid: "HomeAP", password: "password123" },
    });
    assert.deepEqual(validAp.wifi?.access_point, { ssid: "HomeAP", password: "password123" });
  });
});

describe("Phases 2-9 Hardening: Rollback, Circuit Breaker, Retries, Consistency & Sizing", () => {
  it("rolls back optimistic pin updates cleanly on delivery failure or thrown error (single & batch)", async () => {
    useIoTStore.getState().setPinsState({ 2: false, 4: true });

    const okSingle = await executeSinglePinUpdate(
      "2",
      true,
      false,
      undefined,
      useIoTStore.getState().setPinsState,
      () => {},
      () => {},
      () => {},
      {
        syncSinglePin: async () => false,
        syncBatchPins: async () => false,
      },
    );
    assert.equal(okSingle, false);
    assert.equal(useIoTStore.getState().pinsState["2"], false);

    const okBatchThrow = await executeBatchPinUpdate(
      [
        { targetPin: "2", actionOn: true },
        { targetPin: "4", actionOn: false },
      ],
      useIoTStore.getState().setPinsState,
      () => {},
      () => {},
      {
        syncSinglePin: async () => false,
        syncBatchPins: async () => {
          throw new Error("Simulated transport crash");
        },
      },
    );
    assert.equal(okBatchThrow, false);
    assert.equal(useIoTStore.getState().pinsState["2"], false);
    assert.equal(useIoTStore.getState().pinsState["4"], true);
  });

  it("trips CircuitBreaker OPEN after threshold failures and recovers cleanly via HALF_OPEN", async () => {
    let fakeNow = 1000;
    const breaker = new CircuitBreaker({
      serviceName: "unit-breaker",
      failureThreshold: 2,
      resetTimeoutMs: 5000,
      nowFn: () => fakeNow,
    });

    await assert.rejects(
      () =>
        breaker.execute(async () => {
          throw new Error("fail-1");
        }),
      /fail-1/,
    );
    assert.equal(breaker.getState(), "CLOSED");

    await assert.rejects(
      () =>
        breaker.execute(async () => {
          throw new Error("fail-2");
        }),
      /fail-2/,
    );
    assert.equal(breaker.getState(), "OPEN");

    await assert.rejects(() => breaker.execute(async () => "should-not-run"), CircuitOpenError);

    fakeNow += 5001;
    assert.equal(breaker.getState(), "HALF_OPEN");
    const recovered = await breaker.execute(async () => "ok");
    assert.equal(recovered, "ok");
    assert.equal(breaker.getState(), "CLOSED");
  });

  it("applies bounded exponential backoff + full jitter and skips retries on 4xx/CircuitOpen", async () => {
    const observedDelays = [];
    assert.equal(
      computeFullJitterDelayMs(0, 200, 2000, () => 0.5),
      100,
    );
    assert.equal(
      computeFullJitterDelayMs(2, 200, 2000, () => 0.5),
      400,
    );

    let attempts = 0;
    const value = await retryWithBackoff(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("transient");
        return "done";
      },
      {
        maxAttempts: 4,
        baseDelayMs: 100,
        maxDelayMs: 1000,
        randomFn: () => 0.5,
        sleepFn: async (ms) => {
          observedDelays.push(ms);
        },
      },
    );
    assert.equal(value, "done");
    assert.deepEqual(observedDelays, [50, 100]);

    const originalUrl = getCloudflareWorkerUrl();
    setCloudflareWorkerUrl("https://custom-worker.example.workers.dev");
    let fourHundredHits = 0;
    try {
      await assert.rejects(() =>
        fetchConfigFromCloudflare({
          circuitBreaker: new CircuitBreaker({ serviceName: "no-retry-400" }),
          retryAttempts: 3,
          fetchFn: async () => {
            fourHundredHits += 1;
            return new Response("Bad Request", { status: 400 });
          },
        }),
      );
      assert.equal(fourHundredHits, 1);
    } finally {
      setCloudflareWorkerUrl(originalUrl);
    }
  });

  it("aborts timed-out signals and records RED health metrics cleanly", async () => {
    const handle = createTimeoutSignal(25);
    await new Promise((resolve) => setTimeout(resolve, 45));
    assert.equal(handle.signal.aborted, true);
    handle.cleanup();

    const health = getCloudflareReliabilityHealth();
    assert.ok(health.status === "healthy" || health.status === "degraded");
    assert.ok(health.metrics.cloudflare);
  });

  it("preserves fresher live ESP32 RAM pinsState when applyEspConfig hydrates from KV", () => {
    useIoTStore.getState().setPinsState({ 2: true });
    useIoTStore.getState().applyEspConfig({
      version: "1.2.0",
      device: { name: "ESP32", chip: "ESP32-S3", firmware: "1.0", reboot_count: 0, last_boot: "" },
      preferences: {
        theme_mode: "dark",
        accent_color_3: "#fff",
        accent_color_4: "#000",
        font_family: "dana",
        animations_enabled: true,
        header_animation: "fade",
        header_title: "خانه",
      },
      layout: { groups_order: [], groups_cols: 1, group_configs: {} },
      segments: [
        { id: "s2", type: "relay", pin: "2", title: "نور", group: "Test", state: false },
        { id: "s5", type: "relay", pin: "5", title: "پریز", group: "Test", state: true },
      ],
    });

    assert.equal(useIoTStore.getState().pinsState["2"], true);
    assert.equal(useIoTStore.getState().pinsState["5"], true);
  });

  it("serializes overlapping persistStoreConfigToCloudflare writes in causal order", async () => {
    const persistedHeaders = [];
    useIoTStore.getState().setHeaderTitle("عنوان اول");
    useIoTStore.getState().incrementUnsavedChanges();

    const p1 = persistStoreConfigToCloudflare({
      isEnabledFn: () => true,
      saveFn: async (cfg) => {
        await new Promise((r) => setTimeout(r, 25));
        persistedHeaders.push(cfg.preferences.header_title);
        return { success: true, message: "ok1" };
      },
    });

    useIoTStore.getState().setHeaderTitle("عنوان دوم");
    const p2 = persistStoreConfigToCloudflare({
      isEnabledFn: () => true,
      saveFn: async (cfg) => {
        persistedHeaders.push(cfg.preferences.header_title);
        return { success: true, message: "ok2" };
      },
    });

    await Promise.all([p1, p2]);
    assert.deepEqual(persistedHeaders, ["عنوان دوم", "عنوان دوم"]);
    assert.equal(useIoTStore.getState().unsavedChangesCount, 0);
  });

  it("caps InMemoryDeviceSyncAdapter dispatchLog to 500 entries", async () => {
    const sim = new InMemoryDeviceSyncAdapter();

    for (let i = 0; i < 520; i++) {
      await sim.syncSinglePin("2", i % 2 === 0);
    }

    assert.equal(sim.dispatchLog.length, 500);
  });
});
