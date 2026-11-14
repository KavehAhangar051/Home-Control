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
import {
  buildBezierWireGeometry,
  buildDefaultCanvasNodes,
  CANVAS_GRID_STEP,
  canvasGroupNodeId,
  canvasSegmentNodeId,
  clampCanvasNodeSize,
  clampCanvasZoom,
  computeFitCanvasViewport,
  getCanvasGridStyle,
  getPresetDimensions,
  snapNodeRectToGrid,
} from "../features/iot/components/canvas/canvasGeometry.ts";
import {
  canConnectWorkflowPorts,
  clampWorkflowNodeSize,
  createEmptyWorkflow,
  createWorkflowNode,
  evaluateWorkflowGraph,
  getWorkflowGridStyle,
  snapWorkflowNodeToGrid,
} from "../features/iot/components/workflows/workflowEngine.ts";
import {
  computeDragTiltDeg,
  findMagneticInputPort,
} from "../features/iot/components/canvas/nodeMotion.ts";

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

describe("n8n Canvas Sheet Geometry Contracts", () => {
  it("generates group and segment nodes with valid bounds and bezier wires in graph mode", () => {
    const groupsOrder = ["پذیرایی"];
    const segments = [
      { id: "s1", pin: "2", title: "لوستر", type: "relay", group: "پذیرایی" },
      { id: "s2", pin: "4", title: "آباژور", type: "relay", group: "پذیرایی" },
    ];

    const nodes = buildDefaultCanvasNodes("graph", groupsOrder, segments, true);
    const groupNode = nodes[canvasGroupNodeId("پذیرایی")];
    const segNode1 = nodes[canvasSegmentNodeId("s1")];
    const segNode2 = nodes[canvasSegmentNodeId("s2")];

    assert.ok(groupNode);
    assert.ok(segNode1);
    assert.ok(segNode2);
    assert.ok(groupNode.width >= 210 && groupNode.height >= 128);
    assert.ok(segNode1.width >= 165 && segNode1.height >= 120);

    const wire = buildBezierWireGeometry(groupNode, segNode1);
    assert.ok(wire.path.startsWith("M "));
    assert.ok(wire.path.includes(" C "));
  });

  it("clamps zoom and node resize bounds deterministically", () => {
    assert.equal(clampCanvasZoom(0.1), 0.35);
    assert.equal(clampCanvasZoom(5.0), 2.0);

    const clampedSeg = clampCanvasNodeSize("segment", "graph", 80, 60, true);
    assert.ok(clampedSeg.width >= 160);
    assert.ok(clampedSeg.height >= 112);

    const fit = computeFitCanvasViewport(
      {
        "group:پذیرایی": { x: 100, y: 100, width: 260, height: 160, zIndex: 1 },
      },
      ["group:پذیرایی"],
      800,
      600,
      40,
    );
    assert.ok(fit.zoom >= 0.35 && fit.zoom <= 2.0);
    assert.ok(Number.isFinite(fit.x) && Number.isFinite(fit.y));
  });

  it("keeps every default node, preset, clamp bound, and X/Y gap strictly aligned to the 16px grid", () => {
    const groupsOrder = ["پذیرایی", "آشپزخانه", "اتاق"];
    const segments = [
      { id: "s1", pin: "2", title: "چراغ ۱", type: "relay", group: "پذیرایی" },
      { id: "s2", pin: "4", title: "چراغ ۲", type: "relay", group: "پذیرایی" },
      { id: "s3", pin: "5", title: "فر", type: "relay", group: "آشپزخانه" },
      { id: "s4", pin: "12", title: "هود", type: "relay", group: "آشپزخانه" },
      { id: "s5", pin: "13", title: "آباژور", type: "relay", group: "اتاق" },
      { id: "s6", pin: "14", title: "فن", type: "relay", group: "اتاق" },
    ];

    for (const subMode of ["segments", "groups", "graph"]) {
      for (const isMobile of [false, true]) {
        const nodes = buildDefaultCanvasNodes(subMode, groupsOrder, segments, isMobile);

        for (const [id, rect] of Object.entries(nodes)) {
          assert.equal(rect.x % CANVAS_GRID_STEP, 0, `${subMode} ${id} x=${rect.x} not %16`);
          assert.equal(rect.y % CANVAS_GRID_STEP, 0, `${subMode} ${id} y=${rect.y} not %16`);
          assert.equal(
            rect.width % CANVAS_GRID_STEP,
            0,
            `${subMode} ${id} width=${rect.width} not %16`,
          );
          assert.equal(
            rect.height % CANVAS_GRID_STEP,
            0,
            `${subMode} ${id} height=${rect.height} not %16`,
          );
        }
      }
    }

    // Verify uniform equal X and Y gaps in desktop "segments" mode (no 32/16 alternating jitter)
    const desktopSegNodes = buildDefaultCanvasNodes("segments", groupsOrder, segments, false);
    const n1 = desktopSegNodes[canvasSegmentNodeId("s1")];
    const n2 = desktopSegNodes[canvasSegmentNodeId("s2")];
    const n3 = desktopSegNodes[canvasSegmentNodeId("s3")];
    const n4 = desktopSegNodes[canvasSegmentNodeId("s4")];
    const gapCol1 = n2.x - (n1.x + n1.width);
    const gapCol2 = n3.x - (n2.x + n2.width);
    const gapRow = n4.y - (n1.y + n1.height);
    assert.equal(gapCol1, 32);
    assert.equal(gapCol2, 32);
    assert.equal(gapRow, 32);

    // Single-row group container height in "groups" mode is tightened (208px) to match inner card without bottom slack
    const singleGroupNodes = buildDefaultCanvasNodes(
      "groups",
      ["حیاط"],
      [{ id: "s1", pin: "30", title: "در ورودی", type: "relay", group: "حیاط" }],
      false,
    );
    const singleGroupRect = singleGroupNodes[canvasGroupNodeId("حیاط")];
    assert.equal(singleGroupRect.height, 208);
    assert.equal(singleGroupRect.height % CANVAS_GRID_STEP, 0);

    // Verify presets and clamped bounds stay strictly divisible by 16
    for (const preset of ["sm", "md", "lg"]) {
      for (const kind of ["segment", "group"]) {
        for (const subMode of ["segments", "groups", "graph"]) {
          const dims = getPresetDimensions(kind, subMode, preset, 3);
          assert.equal(dims.width % CANVAS_GRID_STEP, 0);
          assert.equal(dims.height % CANVAS_GRID_STEP, 0);
        }
      }
    }

    const normalized = snapNodeRectToGrid(
      { x: 53, y: 101, width: 220, height: 136, zIndex: 2 },
      "segment",
      "segments",
    );
    assert.deepEqual(normalized, { x: 48, y: 96, width: 224, height: 144, zIndex: 2 });
  });

  it("centers background grid dots on snapped world intersections without zoom rounding drift", () => {
    // At zoom=0.92, step must stay exact floating-point 16 * 0.92 = 14.72px (not rounded to 15px)
    const style92 = getCanvasGridStyle(32, 24, 0.92);
    assert.equal(style92.backgroundSize, "14.72px 14.72px");

    // At zoom=1.0 and vp=(32, 24): 32 % 16 = 0 => pos = 0 - 8 = -8px; 24 % 16 = 8 => pos = 8 - 8 = 0px
    const style100 = getCanvasGridStyle(32, 24, 1.0);
    assert.equal(style100.backgroundSize, "16px 16px");
    assert.equal(style100.backgroundPosition, "-8px 0px");

    // Below 8px per grid cell (zoom=0.4 => 6.4px), dot spacing doubles cleanly to 12.8px (2x lattice)
    const style40 = getCanvasGridStyle(0, 0, 0.4);
    assert.equal(style40.backgroundSize, "12.8px 12.8px");
    assert.equal(style40.backgroundPosition, "-6.4px -6.4px");
    assert.deepEqual(getWorkflowGridStyle(32, 24, 0.92), style92);
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
      pinsState: { "34": true, "2": false, "4": false },
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
      pinsState: { "34": true, "2": false, "4": false },
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

  it("creates, clamps, and normalizes all workflow node kinds onto the 16px grid", () => {
    const wf = createEmptyWorkflow("تست گرید");
    assert.equal(wf.viewport.x % CANVAS_GRID_STEP, 0);
    assert.equal(wf.viewport.y % CANVAS_GRID_STEP, 0);

    const kinds = [
      "trigger_manual",
      "trigger_schedule",
      "logic_and",
      "logic_or",
      "logic_not",
      "timer",
      "group",
      "segment",
    ];

    for (const kind of kinds) {
      const node = createWorkflowNode({
        payload: { kind, segmentId: "seg-lamp", groupName: "پذیرایی" },
        x: 52,
        y: 100,
        zIndex: 1,
        segments: sampleSegments,
      });

      assert.equal(node.x % CANVAS_GRID_STEP, 0, `${kind} x not %16`);
      assert.equal(node.y % CANVAS_GRID_STEP, 0, `${kind} y not %16`);
      assert.equal(node.width % CANVAS_GRID_STEP, 0, `${kind} width not %16`);
      assert.equal(node.height % CANVAS_GRID_STEP, 0, `${kind} height not %16`);

      const clamped = clampWorkflowNodeSize(kind, 999, 50, true);
      assert.equal(clamped.width % CANVAS_GRID_STEP, 0);
      assert.equal(clamped.height % CANVAS_GRID_STEP, 0);

      const snapped = snapWorkflowNodeToGrid({ ...node, x: 40, y: 71, width: 244, height: 158 });
      assert.equal(snapped.x % CANVAS_GRID_STEP, 0);
      assert.equal(snapped.y % CANVAS_GRID_STEP, 0);
      assert.equal(snapped.width % CANVAS_GRID_STEP, 0);
      assert.equal(snapped.height % CANVAS_GRID_STEP, 0);
    }
  });

  it("computes bounded drag tilt angles with micro-jitter deadzone and finds closest valid magnetic input port", () => {
    assert.equal(computeDragTiltDeg(0), 0);
    assert.equal(computeDragTiltDeg(1.1), 0);
    assert.equal(computeDragTiltDeg(-1.2), 0);
    assert.equal(computeDragTiltDeg(Number.NaN), 0);
    assert.ok(computeDragTiltDeg(10) > 0 && computeDragTiltDeg(10) <= 2.6);
    assert.equal(computeDragTiltDeg(120, 2.5), 2.5);
    assert.equal(computeDragTiltDeg(-120, 2.5), -2.5);

    const trig = createWorkflowNode({
      payload: { kind: "trigger_manual" },
      x: 0,
      y: 0,
      zIndex: 1,
      segments: sampleSegments,
    });
    const gateAnd = createWorkflowNode({
      payload: { kind: "logic_and" },
      x: 320,
      y: 0,
      zIndex: 2,
      segments: sampleSegments,
    });
    const gateOr = createWorkflowNode({
      payload: { kind: "logic_or" },
      x: 320,
      y: 160,
      zIndex: 3,
      segments: sampleSegments,
    });

    const nodes = [trig, gateAnd, gateOr];
    const edges = [{ id: "e1", sourceId: trig.id, targetId: gateAnd.id }];

    // Already connected target (gateAnd) and trigger targets must be ignored even within radius
    const rejectedMatch = findMagneticInputPort({
      nodes,
      edges,
      sourceId: trig.id,
      pointerWorldX: gateAnd.x + 4,
      pointerWorldY: Math.round(gateAnd.y + gateAnd.height / 2),
      snapRadius: 42,
    });
    assert.equal(rejectedMatch, null);

    // Eligible target (gateOr) snaps cleanly when within radius
    const validMatch = findMagneticInputPort({
      nodes,
      edges,
      sourceId: trig.id,
      pointerWorldX: gateOr.x + 12,
      pointerWorldY: Math.round(gateOr.y + gateOr.height / 2) - 8,
      snapRadius: 42,
    });
    assert.ok(validMatch);
    assert.equal(validMatch.targetId, gateOr.id);
    assert.equal(validMatch.anchorX, gateOr.x);
    assert.equal(validMatch.anchorY, Math.round(gateOr.y + gateOr.height / 2));

    // Outside capture radius returns null
    const farMatch = findMagneticInputPort({
      nodes,
      edges,
      sourceId: trig.id,
      pointerWorldX: gateOr.x - 100,
      pointerWorldY: Math.round(gateOr.y + gateOr.height / 2),
      snapRadius: 42,
    });
    assert.equal(farMatch, null);
  });
});
