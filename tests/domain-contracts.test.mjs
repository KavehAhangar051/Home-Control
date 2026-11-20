import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  executeVoiceCommand,
  getSimilarity,
  normalizePhonetics,
} from "../components/MasterHeader/VoiceCommandButton/utils.ts";
import {
  buildValidatedAutomationDraft,
  inferAutomationEditType,
} from "../features/iot/components/AutomationsDrawer/hooks/useAutomationForm.ts";
import {
  canConnectWorkflowPorts,
  collectGroupMemberSegmentIds,
  createEmptyWorkflow,
  createWorkflowNode,
  evaluateWorkflowGraph,
  isTriggerWorkflowNodeKind,
} from "../features/iot/components/workflows/workflowEngine.ts";
import { buildEspConfig } from "../features/iot/hooks/achaemenidState/core/buildEspConfig.ts";
import {
  deserializeFromCloudflare,
  normalizeSegmentRule,
  resolveSegmentGroup,
  serializeToCloudflare,
} from "../features/iot/services/cloudflare/mappers.ts";
import { InMemoryDeviceSyncAdapter } from "../features/iot/services/deviceGatewayAdapter.ts";
import { validateEsp32Pin } from "../features/iot/utils/pinValidation.ts";

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

  it("enforces ADC1-only constraints (GPIO 32, 33, 34, 35, 36, 39) for analog_input", () => {
    const expectedKeys = ["isValid", "message", "isWarning"];

    for (const pin of ["32", "33", "34", "35", "36", "39"]) {
      const res = validateEsp32Pin(pin, "analog_input");
      assert.equal(res.isValid, true, `Expected ADC1 GPIO ${pin} to be valid`);
      assert.equal(res.isWarning, undefined);
      assert.deepEqual(Object.keys(res), expectedKeys);
    }

    for (const badPin of ["0", "2", "4", "5", "6", "12", "13", "14", "15", "18", "25", "26", "27"]) {
      const res = validateEsp32Pin(badPin, "analog_input");
      assert.equal(res.isValid, false, `Expected non-ADC1 GPIO ${badPin} to be rejected`);
      assert.deepEqual(Object.keys(res), expectedKeys);
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
          actions: [{ targetPin: "4", actionOn: true }, { targetMacro: "macro-sleep" }],
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

  it("blocks input-only/invalid pins and input/placeholder segments from voice actuation", () => {
    const singleCalls = [];
    const batchCalls = [];
    const toasts = [];

    const context = {
      voiceCommands: [
        {
          phrase: "تست پین نامعتبر",
          actions: [
            { targetPin: "34", actionOn: true },
            { targetPin: "6", actionOn: true },
            { targetPin: "12", actionOn: true },
          ],
        },
        {
          phrase: "فرمان خالی",
          actions: [{ targetPin: "34", actionOn: true }],
        },
      ],
      macros: [],
      segments: [
        { pin: "34", title: "سنسور حرکت", type: "input" },
        { pin: "12", title: "روشنایی", type: "relay" },
        { pin: "13", title: "جایگاه خالی", type: "placeholder" },
      ],
      handleSetPinState: (pin, state) => {
        singleCalls.push({ pin, state });
      },
      handleBatchPinState: (actions) => {
        batchCalls.push(actions);
      },
      showToast: (msg, type) => {
        toasts.push({ msg, type });
      },
    };

    const partial = executeVoiceCommand("تست پین نامعتبر", context);
    assert.equal(partial.matched, true);
    assert.equal(partial.kind, "custom");
    assert.equal(partial.dispatchedCount, 1);
    assert.deepEqual(partial.skippedPins, ["34", "6"]);
    assert.deepEqual(batchCalls, [[{ targetPin: "12", actionOn: true }]]);

    const emptyCmd = executeVoiceCommand("فرمان خالی", context);
    assert.equal(emptyCmd.matched, true);
    assert.equal(emptyCmd.kind, "custom");
    assert.equal(emptyCmd.dispatchedCount, 0);
    assert.equal(toasts[toasts.length - 1].type, "error");

    const sensorRes = executeVoiceCommand("سنسور حرکت را روشن کن", context);
    assert.equal(sensorRes.matched, false);
    assert.equal(sensorRes.dispatchedCount, 0);

    const placeholderRes = executeVoiceCommand("جایگاه خالی را روشن کن", context);
    assert.equal(placeholderRes.matched, false);
    assert.equal(singleCalls.length, 0);

    const adcRes = executeVoiceCommand("سنسور نور را روشن کن", {
      ...context,
      segments: [{ pin: "32", title: "سنسور نور", type: "analog_input" }],
    });
    assert.equal(adcRes.matched, false);
    assert.equal(adcRes.dispatchedCount, 0);
  });

  it("withholds false success toast when async pin dispatch resolves to false", async () => {
    const toasts = [];

    executeVoiceCommand("چراغ تست را روشن کن", {
      voiceCommands: [],
      macros: [],
      segments: [{ pin: "18", title: "چراغ تست", type: "relay" }],
      handleSetPinState: async () => false,
      handleBatchPinState: async () => false,
      showToast: (msg, type) => {
        toasts.push({ msg, type });
      },
    });

    await Promise.resolve();
    assert.equal(toasts.length, 0);

    executeVoiceCommand("چراغ تست را خاموش کن", {
      voiceCommands: [],
      macros: [],
      segments: [{ pin: "18", title: "چراغ تست", type: "relay" }],
      handleSetPinState: async () => true,
      handleBatchPinState: async () => true,
      showToast: (msg, type) => {
        toasts.push({ msg, type });
      },
    });

    await Promise.resolve();
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].type, "success");
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
      voiceCommands: [
        { id: "vc1", phrase: "نور مخفی", actions: [{ targetPin: "5", actionOn: true }] },
      ],
      wifiNetworks: [{ ssid: "HomeNet", password: "secret" }],
      wifiNetworksConfigured: true,
      wifiApConfig: null,
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

  it("normalizes segment groups and legacy single-target/dual-target segment rules at the boundary", () => {
    assert.equal(resolveSegmentGroup(""), "Test");
    assert.equal(resolveSegmentGroup("   "), "Test");
    assert.equal(resolveSegmentGroup(undefined), "Test");
    assert.equal(resolveSegmentGroup(null), "Test");
    assert.equal(resolveSegmentGroup("آشپزخانه"), "آشپزخانه");

    assert.deepEqual(
      normalizeSegmentRule({
        targetPinHigh: "12",
        reqHoldHigh: 2,
        actionOnHigh: false,
        targetPinLow: "14",
        actionOnLow: true,
      }),
      {
        highActions: [
          { reqHold: 2, targetPin: "12", actionOn: false, actionType: 0, delay: 0 },
        ],
        lowActions: [
          { reqHold: 0, targetPin: "14", actionOn: true, actionType: 0, delay: 0 },
        ],
      },
    );

    const deserialized = deserializeFromCloudflare({
      segments_definition: [
        {
          id: "s-legacy",
          pin: "34",
          title: "سنسور در",
          type: "input",
          group: "",
          rule: {
            triggerState: true,
            targetPin: "5",
            actionState: true,
          },
        },
      ],
    });

    assert.equal(deserialized.segments[0].group, "Test");
    assert.deepEqual(deserialized.segments[0].rule, {
      highActions: [
        { reqHold: 0, targetPin: "5", actionOn: true, actionType: 0, delay: 0 },
      ],
      lowActions: [],
    });
  });

  it("round-trips and normalizes analog_input ADC1 fields across Cloudflare serialization", () => {
    const deserialized = deserializeFromCloudflare({
      segments_definition: [
        {
          id: "seg-adc-1",
          pin: "34",
          title: "سنسور نور LDR",
          type: "analog_input",
          group: "حیاط",
          adcResolution: 10,
          adcSampleIntervalMs: 250,
          adcDeltaThreshold: 20,
          adcHighThreshold: 800,
          adcLowThreshold: 900, // > ath, must clamp to ath (800)
          analogValue: 1500, // > maxVal (1023), must clamp to 1023
        },
      ],
    });

    const seg = deserialized.segments[0];
    assert.equal(seg.type, "analog_input");
    assert.equal(seg.adcResolution, 10);
    assert.equal(seg.adcSampleIntervalMs, 250);
    assert.equal(seg.adcDeltaThreshold, 20);
    assert.equal(seg.adcHighThreshold, 800);
    assert.equal(seg.adcLowThreshold, 800);
    assert.equal(seg.analogValue, 1023);
  });
});

describe("IDeviceSyncPort In-Memory Boundary Contract", () => {
  it("records single and batch pin synchronization without network side effects", async () => {
    const adapter = new InMemoryDeviceSyncAdapter();
    const notifications = [];

    const singleOk = await adapter.syncSinglePin("14", true, {
      showToast: (msg, type) => notifications.push({ msg, type }),
    });
    assert.equal(singleOk, true);
    assert.equal(adapter.pinsState.get("14"), true);
    assert.equal(adapter.dispatchLog.length, 1);

    const batchOk = await adapter.syncBatchPins(
      [
        { targetPin: "14", actionOn: false },
        { targetPin: "27", actionOn: true },
      ],
      {
        showToast: (msg, type) => notifications.push({ msg, type }),
      },
    );

    assert.equal(batchOk, true);
    assert.equal(adapter.pinsState.get("14"), false);
    assert.equal(adapter.pinsState.get("27"), true);
    assert.equal(adapter.dispatchLog.length, 2);
    assert.equal(notifications.length, 2);

    adapter.reset();
    assert.equal(adapter.pinsState.size, 0);
    assert.equal(adapter.dispatchLog.length, 0);

    const readOk = await adapter.readAnalogInput("34");
    assert.equal(readOk, true);

    const cfgOk = await adapter.updateAnalogInputConfig("34", {
      adcResolution: 12,
      adcSampleIntervalMs: 500,
      adcDeltaThreshold: 40,
      adcHighThreshold: 2800,
      adcLowThreshold: 2200,
    });
    assert.equal(cfgOk, true);
    assert.equal(adapter.dispatchLog.length, 2);
  });
});

describe("n8n Workflow Studio Evaluation & Wiring Contracts", () => {
  const sampleSegments = [
    { id: "seg-sensor", pin: "34", title: "سنسور حرکت", type: "input", group: "ورودی" },
    { id: "seg-lamp", pin: "2", title: "چراغ هال", type: "relay", group: "پذیرایی" },
    { id: "seg-fan", pin: "4", title: "پنکه", type: "relay", group: "پذیرایی" },
    { id: "seg-ph", pin: "", title: "جایگاه خالی", type: "placeholder", group: "پذیرایی" },
  ];

  it("creates empty custom groups and pre-filled module groups accurately", () => {
    const emptyGroup = createWorkflowNode({
      payload: { kind: "group", isCustomGroup: true },
      x: 40,
      y: 40,
      zIndex: 1,
      segments: sampleSegments,
    });
    assert.deepEqual(emptyGroup.memberSegmentIds, []);
    assert.equal(emptyGroup.isCustomGroup, true);

    const prefilledGroup = createWorkflowNode({
      payload: { kind: "group", groupName: "پذیرایی", isCustomGroup: false },
      x: 120,
      y: 80,
      zIndex: 2,
      segments: sampleSegments,
    });
    assert.deepEqual(prefilledGroup.memberSegmentIds, ["seg-lamp", "seg-fan"]);
    assert.equal(prefilledGroup.isCustomGroup, false);
  });

  it("rejects self-loops, duplicate wires, trigger targets, and directed cycles", () => {
    const wf = createEmptyWorkflow("تست اتصال");
    const trig = createWorkflowNode({
      payload: { kind: "trigger_manual" },
      x: 0,
      y: 0,
      zIndex: 1,
      segments: sampleSegments,
    });
    const gateAnd = createWorkflowNode({
      payload: { kind: "logic_and" },
      x: 300,
      y: 0,
      zIndex: 2,
      segments: sampleSegments,
    });
    const gateNot = createWorkflowNode({
      payload: { kind: "logic_not" },
      x: 600,
      y: 0,
      zIndex: 3,
      segments: sampleSegments,
    });
    const nodes = [trig, gateAnd, gateNot];
    const edges = [
      { id: "e1", sourceId: trig.id, targetId: gateAnd.id },
      { id: "e2", sourceId: gateAnd.id, targetId: gateNot.id },
    ];

    assert.equal(canConnectWorkflowPorts(edges, nodes, gateAnd.id, gateAnd.id), false);
    assert.equal(canConnectWorkflowPorts(edges, nodes, trig.id, gateAnd.id), false);
    assert.equal(canConnectWorkflowPorts(edges, nodes, gateAnd.id, trig.id), false);
    assert.equal(canConnectWorkflowPorts(edges, nodes, gateNot.id, gateAnd.id), false);
    assert.equal(canConnectWorkflowPorts(edges, nodes, trig.id, gateNot.id), true);
  });

  it("evaluates AND / OR / NOT logic, group modes, timers, and target pin actions deterministically", () => {
    const wf = createEmptyWorkflow("سناریوی کامل");
    const sensorNode = createWorkflowNode({
      payload: { kind: "segment", segmentId: "seg-sensor" },
      x: 0,
      y: 0,
      zIndex: 1,
      segments: sampleSegments,
    });
    const manualNode = createWorkflowNode({
      payload: { kind: "trigger_manual" },
      x: 0,
      y: 180,
      zIndex: 2,
      segments: sampleSegments,
    });
    const andNode = createWorkflowNode({
      payload: { kind: "logic_and" },
      x: 280,
      y: 80,
      zIndex: 3,
      segments: sampleSegments,
    });
    const notNode = createWorkflowNode({
      payload: { kind: "logic_not" },
      x: 280,
      y: 260,
      zIndex: 4,
      segments: sampleSegments,
    });
    const timerNode = createWorkflowNode({
      payload: { kind: "timer" },
      x: 520,
      y: 80,
      zIndex: 5,
      segments: sampleSegments,
    });
    const groupTarget = createWorkflowNode({
      payload: { kind: "group", groupName: "پذیرایی", isCustomGroup: false },
      x: 780,
      y: 80,
      zIndex: 6,
      segments: sampleSegments,
    });

    wf.nodes = [sensorNode, manualNode, andNode, notNode, timerNode, groupTarget];
    wf.edges = [
      { id: "e1", sourceId: sensorNode.id, targetId: andNode.id },
      { id: "e2", sourceId: manualNode.id, targetId: andNode.id },
      { id: "e3", sourceId: sensorNode.id, targetId: notNode.id },
      { id: "e4", sourceId: andNode.id, targetId: timerNode.id },
      { id: "e5", sourceId: timerNode.id, targetId: groupTarget.id },
    ];

    const step1 = evaluateWorkflowGraph({
      workflow: wf,
      segments: sampleSegments,
      pinsState: { 34: true, 2: false, 4: false },
      manualPulseNodeIds: new Set([manualNode.id]),
      timerOutputs: new Map(),
    });

    assert.equal(step1.nodeOutputs.get(andNode.id), true);
    assert.equal(step1.nodeOutputs.get(notNode.id), false);
    assert.deepEqual(step1.triggeredTimerIds, [timerNode.id]);
    assert.equal(step1.pendingActions.length, 0);

    const step2 = evaluateWorkflowGraph({
      workflow: wf,
      segments: sampleSegments,
      pinsState: { 34: true, 2: false, 4: false },
      manualPulseNodeIds: new Set([manualNode.id]),
      timerOutputs: new Map([[timerNode.id, true]]),
    });

    assert.equal(step2.nodeOutputs.get(groupTarget.id), true);
    assert.deepEqual(
      step2.pendingActions.map((a) => ({ targetPin: a.targetPin, actionOn: a.actionOn })),
      [
        { targetPin: "2", actionOn: true },
        { targetPin: "4", actionOn: true },
      ],
    );
  });

  it("treats analog_input as read-only source in workflow evaluation without dispatching writes", () => {
    const segmentsWithAdc = [
      ...sampleSegments,
      { id: "seg-adc", pin: "32", title: "سنسور نور", type: "analog_input", group: "پذیرایی" },
    ];
    const wf = createEmptyWorkflow("تست ورودی آنالوگ");
    const manualNode = createWorkflowNode({
      payload: { kind: "trigger_manual" },
      x: 0,
      y: 0,
      zIndex: 1,
      segments: segmentsWithAdc,
    });
    const adcNode = createWorkflowNode({
      payload: { kind: "segment", segmentId: "seg-adc" },
      x: 240,
      y: 0,
      zIndex: 2,
      segments: segmentsWithAdc,
    });
    const lampNode = createWorkflowNode({
      payload: { kind: "segment", segmentId: "seg-lamp" },
      x: 480,
      y: 0,
      zIndex: 3,
      segments: segmentsWithAdc,
    });

    wf.nodes = [manualNode, adcNode, lampNode];
    wf.edges = [
      { id: "e1", sourceId: manualNode.id, targetId: adcNode.id },
      { id: "e2", sourceId: adcNode.id, targetId: lampNode.id },
    ];

    const evalRes = evaluateWorkflowGraph({
      workflow: wf,
      segments: segmentsWithAdc,
      pinsState: { 32: true, 2: false },
      manualPulseNodeIds: new Set([manualNode.id]),
    });

    // adcNode outputs its live Schmitt-trigger boolean state (true), driving lampNode,
    // while never receiving a write dispatch itself.
    assert.equal(evalRes.nodeOutputs.get(adcNode.id), true);
    assert.deepEqual(
      evalRes.pendingActions.map((a) => ({ targetPin: a.targetPin, actionOn: a.actionOn })),
      [{ targetPin: "2", actionOn: true }],
    );
  });

  it("evaluates schedule triggers accurately with indexOf/slice parsing and rejects malformed times", () => {
    const wf = createEmptyWorkflow("تست زمان‌بندی");
    const schedNode = createWorkflowNode({
      payload: { kind: "trigger_schedule" },
      x: 0,
      y: 0,
      zIndex: 1,
      segments: sampleSegments,
    });
    schedNode.scheduleTime = "08:30";
    schedNode.scheduleDays = [1, 3];
    wf.nodes = [schedNode];

    // Monday (day 1) at 08:30 -> true
    const matchRes = evaluateWorkflowGraph({
      workflow: wf,
      segments: sampleSegments,
      pinsState: {},
      nowDate: new Date(2026, 10, 16, 8, 30, 0),
    });
    assert.equal(matchRes.nodeOutputs.get(schedNode.id), true);

    // Malformed times ("08:30:00", ":30", "08:") -> false
    for (const invalidTime of ["08:30:00", ":30", "08:", "invalid"]) {
      schedNode.scheduleTime = invalidTime;
      const badRes = evaluateWorkflowGraph({
        workflow: wf,
        segments: sampleSegments,
        pinsState: {},
        nowDate: new Date(2026, 10, 16, 8, 30, 0),
      });
      assert.equal(badRes.nodeOutputs.get(schedNode.id), false);
    }
  });

  it("validates automation form drafts and identifies trigger node kinds & group member segments", () => {
    const invalidSchedule = buildValidatedAutomationDraft({
      editingId: null,
      title: "روشنایی شب",
      autoType: "schedule",
      time: "",
      days: [],
      repeatCount: "",
      delayHours: "",
      delayMinutes: "",
      city: "",
      temperatureThreshold: "",
      temperatureCondition: "greater",
      intervalMinutes: "",
      hasWeatherCondition: false,
      actions: [{ targetPin: "2", actionOn: true }],
    });
    assert.equal(invalidSchedule.ok, false);

    const validSchedule = buildValidatedAutomationDraft({
      editingId: "auto_1",
      title: "روشنایی شب",
      autoType: "schedule",
      time: "21:00",
      days: [6, 0],
      repeatCount: 3,
      delayHours: "",
      delayMinutes: "",
      city: "",
      temperatureThreshold: "",
      temperatureCondition: "greater",
      intervalMinutes: "",
      hasWeatherCondition: false,
      actions: [{ targetPin: "2", actionOn: true }],
    });
    assert.equal(validSchedule.ok, true);
    if (validSchedule.ok) {
      assert.equal(validSchedule.automation.id, "auto_1");
      assert.equal(validSchedule.automation.conditionType, "time");
      assert.equal(validSchedule.automation.repeatCount, 3);
    }

    assert.equal(isTriggerWorkflowNodeKind("trigger_manual"), true);
    assert.equal(isTriggerWorkflowNodeKind("trigger_schedule"), true);
    assert.equal(isTriggerWorkflowNodeKind("logic_and"), false);
    assert.equal(isTriggerWorkflowNodeKind("segment"), false);

    assert.deepEqual(collectGroupMemberSegmentIds(sampleSegments, "پذیرایی"), [
      "seg-lamp",
      "seg-fan",
    ]);
    assert.deepEqual(collectGroupMemberSegmentIds(sampleSegments, undefined), []);

    assert.equal(inferAutomationEditType({ id: "1", title: "a", intervalMinutes: 15 }), "weather");
    assert.equal(inferAutomationEditType({ id: "2", title: "b", repeatCount: 1 }), "timer");
    assert.equal(inferAutomationEditType({ id: "3", title: "c" }), "schedule");
  });
});





