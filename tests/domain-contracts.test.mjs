import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  executeVoiceCommand,
  getSimilarity,
  normalizePhonetics,
} from "../components/MasterHeader/VoiceCommandButton/utils.ts";
import { buildEspConfig } from "../features/iot/hooks/achaemenidState/core/buildEspConfig.ts";
import {
  deserializeFromCloudflare,
  serializeToCloudflare,
} from "../features/iot/services/cloudflare/mappers.ts";
import { InMemoryDeviceSyncAdapter } from "../features/iot/services/deviceGatewayAdapter.ts";
import { validateEsp32Pin } from "../features/iot/utils/pinValidation.ts";
import {
  DURATION,
  EASE_IN,
  EASE_OUT,
  ERROR_SHAKE_KEYFRAMES,
  getExitDuration,
  getStaggerDelay,
  TRANSITION_ENTER_QUICK,
  TRANSITION_ENTER_STANDARD,
  TRANSITION_EXIT_QUICK,
  TRANSITION_EXIT_STANDARD,
} from "../lib/ease.ts";

describe("ESP32 Hardware Pin Validation Contracts", () => {
  it("accepts valid general-purpose output pins", () => {
    const res = validateEsp32Pin("2", "relay");
    assert.equal(res.isValid, true);
    assert.equal(res.isWarning, undefined);
  });

  it("rejects out-of-range, empty, or non-integer pins and preserves monomorphic shape", () => {
    const expectedKeys = ["isValid", "message", "isWarning"];
    for (const invalid of ["-1", "40", "abc", "", " ", "02"]) {
      const res = validateEsp32Pin(invalid, "relay");
      assert.equal(res.isValid, false);
      assert.deepEqual(Object.keys(res), expectedKeys);
    }
    assert.deepEqual(Object.keys(validateEsp32Pin("2", "relay")), expectedKeys);
    assert.deepEqual(Object.keys(validateEsp32Pin("8", "relay")), expectedKeys);
    assert.deepEqual(Object.keys(validateEsp32Pin("34", "input")), expectedKeys);
  });

  it("rejects internal SPI flash pins (GPIO 6..11)", () => {
    for (const pin of ["6", "7", "8", "9", "10", "11"]) {
      const res = validateEsp32Pin(pin, "relay");
      assert.equal(res.isValid, false, `Expected GPIO ${pin} to be rejected`);
    }
  });

  it("enforces input-only constraints on GPIO 34, 35, 36, 39", () => {
    for (const pin of ["34", "35", "36", "39"]) {
      const outputRes = validateEsp32Pin(pin, "relay");
      assert.equal(outputRes.isValid, false);

      const inputRes = validateEsp32Pin(pin, "input");
      assert.equal(inputRes.isValid, true);
      assert.equal(inputRes.isWarning, true);
    }
  });
});

describe("Persian Voice Command Engine Contracts", () => {
  it("normalizes Persian homophones and ZWNJ/whitespace consistently", () => {
    assert.equal(normalizePhonetics("اتاق\u200cخواب   روشن"), "اتاق خواب روشن");
    assert.equal(normalizePhonetics("غرفه صبا"), normalizePhonetics("قرفه سبا"));
    assert.equal(normalizePhonetics("حیاط خلوت"), normalizePhonetics("هیات خلوت"));
  });

  it("computes Levenshtein similarity deterministically", () => {
    assert.equal(getSimilarity("روشن", "روشن"), 1);
    assert.equal(getSimilarity("", ""), 1);
    assert.equal(getSimilarity("روشن", ""), 0);
    assert.ok(getSimilarity("چراغ پذیرایی", "چراغ پزیرایی") >= 0.9);
  });

  it("unfolds macros and deduplicates conflicting pin actions in custom voice commands", () => {
    let dispatchedBatch = [];
    const toasts = [];

    executeVoiceCommand("حالت شب!", {
      voiceCommands: [
        {
          phrase: "حالت شب",
          actions: [
            { targetPin: "4", actionOn: true },
            { targetMacro: "macro-sleep" },
          ],
        },
      ],
      macros: [
        {
          id: "macro-sleep",
          actions: [
            { targetPin: "4", actionOn: false },
            { targetPin: "12", actionOn: true },
          ],
        },
      ],
      segments: [],
      handleSetPinState: () => {
        assert.fail("Should dispatch via handleBatchPinState for custom commands");
      },
      handleBatchPinState: (actions) => {
        dispatchedBatch = actions;
      },
      showToast: (msg, type) => {
        toasts.push({ msg, type });
      },
    });

    assert.deepEqual(dispatchedBatch, [
      { targetPin: "4", actionOn: false },
      { targetPin: "12", actionOn: true },
    ]);
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, "success");
  });

  it("matches prefix and suffix segment intents with polite Persian verb endings", () => {
    const singleCalls = [];
    const toasts = [];

    const context = {
      voiceCommands: [],
      macros: [],
      segments: [{ pin: "18", title: "چراغ مطالعه" }],
      handleSetPinState: (pin, state) => {
        singleCalls.push({ pin, state });
      },
      handleBatchPinState: () => {},
      showToast: (msg, type) => {
        toasts.push({ msg, type });
      },
    };

    executeVoiceCommand("چراغ مطالعه را روشن کن", context);
    executeVoiceCommand("خاموش کردن چراغ مطالعه", context);

    assert.deepEqual(singleCalls, [
      { pin: "18", state: true },
      { pin: "18", state: false },
    ]);
    assert.equal(toasts.length, 2);
  });
});

describe("Cloudflare & ESP32 Config Boundary Serialization Contracts", () => {
  it("preserves all fields across buildEspConfig -> serializeToCloudflare -> deserializeFromCloudflare", () => {
    const built = buildEspConfig({
      isDark: false,
      accent3: "#112233",
      accent4: "#445566",
      selectedFont: "vazirmatn",
      animationsEnabled: false,
      animationsFps: 30,
      headerTitle: "داشبورد تست",
      manualSaveMode: true,
      groupsOrder: ["LivingRoom"],
      groupsCols: 2,
      groupConfigs: { LivingRoom: { maxCols: 2, icon: "Home01Icon" } },
      segments: [{ id: "seg-1", pin: "5", title: "نور مخفی", type: "relay", group: "LivingRoom" }],
      automations: [],
      macros: [{ id: "m1", title: "ورود", actions: [{ targetPin: "5", actionOn: true }] }],
      voiceCommands: [{ id: "vc1", phrase: "نور مخفی", actions: [{ targetPin: "5", actionOn: true }] }],
      wifiNetworks: [{ ssid: "HomeNet", password: "secret" }],
      mqttConfig: { broker_ws_url: "wss://broker.example/mqtt", base_topic: "home/esp32", qos: 1 },
      headerAnimationType: "chase",
      headerPosition: "left",
      dashboardBgColor: "#0a0a0a",
      dashboardBgOpacity: 0.75,
    });

    const serialized = serializeToCloudflare(built);
    assert.equal(serialized.segments_definition.length, 1);
    assert.equal(serialized.preferences.header_animation, "chase");
    assert.equal(serialized.preferences.header_position, "left");
    assert.equal(serialized.preferences.dashboard_bg_color, "#0a0a0a");
    assert.equal(serialized.preferences.dashboard_bg_opacity, 0.75);

    const deserialized = deserializeFromCloudflare(serialized);
    assert.equal(deserialized.segments.length, 1);
    assert.equal(deserialized.segments[0].id, "seg-1");
    assert.equal(deserialized.preferences.theme_mode, "light");
    assert.equal(deserialized.preferences.manual_save_mode, true);
    assert.deepEqual(deserialized.mqtt, built.mqtt);
  });

  it("migrates legacy single-target automation schema during Cloudflare deserialization", () => {
    const deserialized = deserializeFromCloudflare({
      automations: [
        {
          id: "legacy-auto-1",
          title: "روشن شدن خودکار",
          enabled: true,
          triggerType: "time",
          executionTime: "08:00",
          targetPin: "23",
          actionOn: true,
        },
      ],
    });

    assert.equal(deserialized.automations?.length, 1);
    assert.deepEqual(deserialized.automations?.[0].actions, [{ targetPin: "23", actionOn: true }]);
  });
});

describe("IDeviceSyncPort In-Memory Boundary Contract", () => {
  it("records single and batch pin synchronization without network side effects", async () => {
    const adapter = new InMemoryDeviceSyncAdapter();
    const notifications = [];

    await adapter.syncSinglePin("14", true, {
      showToast: (msg, type) => notifications.push({ msg, type }),
    });
    assert.equal(adapter.pinsState.get("14"), true);
    assert.equal(adapter.dispatchLog.length, 1);

    await adapter.syncBatchPins(
      [
        { targetPin: "14", actionOn: false },
        { targetPin: "27", actionOn: true },
      ],
      {
        showToast: (msg, type) => notifications.push({ msg, type }),
      },
    );

    assert.equal(adapter.pinsState.get("14"), false);
    assert.equal(adapter.pinsState.get("27"), true);
    assert.equal(adapter.dispatchLog.length, 2);
    assert.equal(notifications.length, 2);

    adapter.reset();
    assert.equal(adapter.pinsState.size, 0);
    assert.equal(adapter.dispatchLog.length, 0);
  });
});

describe("Motion Design System Contracts (lib/ease)", () => {
  it("enforces exits faster than entrances (65-75% exitRatio rule) with directional curves", () => {
    assert.equal(DURATION.exitRatio, 0.7);
    assert.ok(TRANSITION_EXIT_QUICK.duration < TRANSITION_ENTER_QUICK.duration);
    assert.ok(TRANSITION_EXIT_STANDARD.duration < TRANSITION_ENTER_STANDARD.duration);
    assert.equal(TRANSITION_EXIT_STANDARD.duration, getExitDuration(DURATION.standard));
    assert.deepEqual(TRANSITION_ENTER_STANDARD.ease, EASE_OUT);
    assert.deepEqual(TRANSITION_EXIT_STANDARD.ease, EASE_IN);
  });

  it("caps multi-element stagger budget strictly below 500ms", () => {
    assert.equal(getStaggerDelay(0), 0);
    assert.equal(getStaggerDelay(-3), 0);
    assert.ok(getStaggerDelay(2) > 0);
    assert.ok(getStaggerDelay(50) <= 0.4);
    assert.ok(getStaggerDelay(100, 0.1, 0.9) <= 0.45);
  });

  it("provides zero-sum error shake oscillation keyframes", () => {
    assert.equal(ERROR_SHAKE_KEYFRAMES[0], 0);
    assert.equal(ERROR_SHAKE_KEYFRAMES[ERROR_SHAKE_KEYFRAMES.length - 1], 0);
    const sum = ERROR_SHAKE_KEYFRAMES.reduce((acc, v) => acc + v, 0);
    assert.equal(sum, 0);
  });
});

