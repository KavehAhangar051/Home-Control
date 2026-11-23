import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEspCfgV2Text, buildEspConfig } from "../features/iot/hooks/achaemenidState/core/buildEspConfig.ts";
import {
  createHardwareSegmentId,
  planAddSegment,
} from "../features/iot/hooks/achaemenidState/core/segmentOperations.ts";
import {
  deserializeFromCloudflare,
  serializeToCloudflare,
} from "../features/iot/services/cloudflare/mappers.ts";
import { parseMqttStateMessage } from "../features/iot/services/mqtt/messageParser.ts";
import { MQTT_OPCODES } from "../features/iot/services/mqtt/protocol.ts";
import {
  buildAddVirtualSegmentFrame,
  buildDeleteAuxNodeFrame,
  buildDeleteSegmentFrame,
  buildUpdateRuleFrame,
  buildUpsertAuxNodeFrame,
  encodeUpdateAnalogRangeRulesFrame,
} from "../features/iot/services/mqtt/segmentPublishers.ts";
import {
  allocateNextAuxNodeId,
  allocateNextVirtualPin,
  formatSegmentPinLabel,
  MAX_AUX_NODES,
  MAX_TOTAL_SEGMENTS,
  parseAndValidateMac,
  planCreateAuxNode,
  planRemoveSegmentWithAuxRestore,
  planUpdateAuxNode,
} from "../features/iot/utils/auxNodeUtils.ts";

describe("parseAndValidateMac", () => {
  it("normalizes colon, dash, and compact lowercase MAC formats to XX:XX:XX:XX:XX:XX", () => {
    const colon = parseAndValidateMac("aa:bb:cc:dd:ee:01");
    assert.equal(colon.ok, true);
    if (colon.ok) {
      assert.equal(colon.formatted, "AA:BB:CC:DD:EE:01");
      assert.deepEqual(Array.from(colon.bytes), [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x01]);
    }

    const dash = parseAndValidateMac("24-6f-28-11-22-33");
    assert.equal(dash.ok, true);
    if (dash.ok) {
      assert.equal(dash.formatted, "24:6F:28:11:22:33");
      assert.deepEqual(Array.from(dash.bytes), [0x24, 0x6f, 0x28, 0x11, 0x22, 0x33]);
    }

    const raw = parseAndValidateMac("a4cf12987654");
    assert.equal(raw.ok, true);
    if (raw.ok) {
      assert.equal(raw.formatted, "A4:CF:12:98:76:54");
      assert.deepEqual(Array.from(raw.bytes), [0xa4, 0xcf, 0x12, 0x98, 0x76, 0x54]);
    }
  });

  it("rejects all-zero, broadcast, multicast, wrong-length, and non-hex MAC addresses", () => {
    assert.equal(parseAndValidateMac("00:00:00:00:00:00").ok, false);
    assert.equal(parseAndValidateMac("FF:FF:FF:FF:FF:FF").ok, false);
    assert.equal(parseAndValidateMac("01:11:22:33:44:55").ok, false);
    assert.equal(parseAndValidateMac("AA:BB:CC:DD:EE").ok, false);
    assert.equal(parseAndValidateMac("GG:BB:CC:DD:EE:01").ok, false);
  });
});

describe("MQTT binary frames for Auxiliary ESP Nodes & Virtual Segments", () => {
  it("encodes 0x0F UPSERT_AUX_NODE byte-for-byte with UTF-8 Persian truncation <= 31B", () => {
    const frame = buildUpsertAuxNodeFrame({
      nodeId: 1,
      mac: "aa:bb:cc:dd:ee:01",
      pinCapacity: 4,
      chipType: "esp8266_01",
      name: "Parking",
    });

    const expectedName = Array.from(new TextEncoder().encode("Parking"));
    assert.equal(frame.length, 10 + expectedName.length + 1);
    assert.deepEqual(Array.from(frame), [
      MQTT_OPCODES.UPSERT_AUX_NODE,
      1,
      0xaa,
      0xbb,
      0xcc,
      0xdd,
      0xee,
      0x01,
      4,
      1,
      ...expectedName,
      0x00,
    ]);

    const longPersian = "روشنایی محوطه و پارکینگ شمالی ساختمان مرکزی";
    const truncatedFrame = buildUpsertAuxNodeFrame({
      nodeId: 2,
      mac: "24:6F:28:11:22:33",
      pinCapacity: 8,
      chipType: "esp32_s3",
      name: longPersian,
    });
    const encodedNameSlice = truncatedFrame.slice(10, truncatedFrame.length - 1);
    assert.ok(encodedNameSlice.length <= 31);
    assert.equal(truncatedFrame[truncatedFrame.length - 1], 0x00);
    assert.equal(truncatedFrame[9], 5);
    assert.doesNotThrow(() => new TextDecoder("utf-8", { fatal: true }).decode(encodedNameSlice));
  });

  it("encodes 0x10 DELETE_AUX_NODE with and without MAC fallback and cascade flag", () => {
    const withMac = buildDeleteAuxNodeFrame(1, {
      cascadeSegments: true,
      mac: "AA:BB:CC:DD:EE:01",
    });
    assert.equal(withMac.length, 9);
    assert.deepEqual(Array.from(withMac), [
      0x10,
      1,
      0x01,
      0xaa,
      0xbb,
      0xcc,
      0xdd,
      0xee,
      0x01,
    ]);

    const withoutMac = buildDeleteAuxNodeFrame(3, { cascadeSegments: false });
    assert.equal(withoutMac.length, 3);
    assert.deepEqual(Array.from(withoutMac), [0x10, 3, 0x00]);
  });

  it("encodes 0x11 ADD_VIRTUAL_SEGMENT for digital, PWM (5B trailing), and ADC (9B trailing)", () => {
    const digital = buildAddVirtualSegmentFrame({
      virtualPin: 40,
      nodeId: 1,
      remotePin: 2,
      id: "vpin_40",
      type: "gpio_toggle",
      initState: false,
    });
    const enc = new TextEncoder();
    assert.deepEqual(Array.from(digital), [
      0x11,
      40,
      1,
      2,
      0,
      ...enc.encode("vpin_40"),
      0x00,
      ...enc.encode("gpio_toggle"),
      0x00,
    ]);

    const pwm = buildAddVirtualSegmentFrame({
      virtualPin: 41,
      nodeId: 1,
      remotePin: 4,
      id: "vpin_41",
      type: "analog_output",
      initState: true,
      analogOptions: { pwmResolution: 10, pwmFrequency: 5000, initialValue: 512 },
    });
    const pwmTail = pwm.slice(pwm.length - 5);
    assert.deepEqual(Array.from(pwmTail), [10, 0x88, 0x13, 0x00, 0x02]);

    const adc = buildAddVirtualSegmentFrame({
      virtualPin: 42,
      nodeId: 2,
      remotePin: 17,
      id: "vpin_42",
      type: "analog_input",
      analogInputOptions: {
        adcResolution: 12,
        adcSampleIntervalMs: 500,
        adcDeltaThreshold: 25,
        adcHighThreshold: 3000,
        adcLowThreshold: 1200,
      },
    });
    const adcTail = adc.slice(adc.length - 9);
    const dv = new DataView(adcTail.buffer, adcTail.byteOffset, adcTail.byteLength);
    assert.equal(dv.getUint8(0), 12);
    assert.equal(dv.getUint16(1, true), 500);
    assert.equal(dv.getUint16(3, true), 25);
    assert.equal(dv.getUint16(5, true), 3000);
    assert.equal(dv.getUint16(7, true), 1200);
  });

  it("widens 0x03 DELETE_SEGMENT and rule builders to virtual pin space 40..127 and rejects 128", () => {
    const del40 = buildDeleteSegmentFrame("vpin_40", 40);
    assert.equal(del40[del40.length - 1], 40);

    const del127 = buildDeleteSegmentFrame("vpin_127", "127");
    assert.equal(del127[del127.length - 1], 127);

    const del128 = buildDeleteSegmentFrame("vpin_128", 128);
    // Out-of-range pin 128 must NOT be appended as fallback byte; frame ends with 0x00 terminator
    assert.equal(del128[del128.length - 1], 0x00);

    const ruleFrame = buildUpdateRuleFrame(40, [
      { reqHold: 0, targetPin: "41", actionOn: true, actionType: 0, delay: 0 },
    ]);
    assert.equal(ruleFrame[0], 0x05);
    assert.equal(ruleFrame[1], 40);
    assert.equal(ruleFrame[3], 41);

    const rangeFrame = encodeUpdateAnalogRangeRulesFrame(45, [
      {
        minValue: 100,
        maxValue: 900,
        hysteresis: 20,
        triggerMode: 0,
        targetPin: "46",
        actionState: true,
        actionType: 0,
        delay: 0,
        enabled: true,
      },
    ]);
    assert.equal(rangeFrame[0], 0x0e);
    assert.equal(rangeFrame[1], 45);
    assert.equal(rangeFrame[2], 1);
  });
});

describe("Auxiliary ESP Node & Virtual Segment lifecycle planners", () => {
  it("creates node + group + N virtual placeholders, converts placeholder to vpin_40, and restores placeholder on delete", () => {
    let seq = 0;
    const createId = () => `ph_${++seq}`;

    const created = planCreateAuxNode({
      input: {
        name: "باغچه",
        mac: "aa:bb:cc:dd:ee:01",
        pinCapacity: 4,
        chipType: "esp8266_01",
      },
      auxNodes: [],
      groupsOrder: ["پذیرایی"],
      groupConfigs: {},
      segments: [],
      createId,
    });

    assert.equal(created.ok, true);
    if (!created.ok) return;

    assert.equal(created.node.nodeId, 1);
    assert.equal(created.node.mac, "AA:BB:CC:DD:EE:01");
    assert.equal(created.placeholdersCreated, 4);
    assert.ok(created.nextGroupsOrder.includes("باغچه"));
    assert.equal(created.nextSegments.length, 4);
    for (const ph of created.nextSegments) {
      assert.equal(ph.type, "placeholder");
      assert.equal(ph.isVirtual, true);
      assert.equal(ph.nodeId, 1);
      assert.equal(ph.group, "باغچه");
    }

    // Convert first placeholder into virtual gpio_toggle on Remote GPIO 2
    const targetPlaceholder = created.nextSegments[0];
    const addResult = planAddSegment({
      input: {
        type: "gpio_toggle",
        pin: "",
        title: "چراغ باغچه",
        group: "باغچه",
        isVirtual: true,
        nodeId: 1,
        remotePin: 2,
      },
      segments: created.nextSegments,
      auxNodes: created.nextAuxNodes,
      targetPlaceholderId: targetPlaceholder.id,
    });

    assert.ok("newSegment" in addResult);
    if (!("newSegment" in addResult)) return;

    assert.equal(addResult.newSegment.id, "vpin_40");
    assert.equal(addResult.newSegment.pin, "40");
    assert.equal(addResult.newSegment.isVirtual, true);
    assert.equal(addResult.newSegment.nodeId, 1);
    assert.equal(addResult.newSegment.remotePin, 2);
    assert.equal(formatSegmentPinLabel(addResult.newSegment), "Remote GPIO 2 · vPin 40");

    const remainingPlaceholders = addResult.nextSegments.filter((s) => s.type === "placeholder");
    assert.equal(remainingPlaceholders.length, 3);
    assert.equal(addResult.nextSegments.length, 4);

    // Reject duplicate (nodeId, remotePin) on same board
    const dupRemote = planAddSegment({
      input: {
        type: "gpio_toggle",
        pin: "",
        group: "باغچه",
        isVirtual: true,
        nodeId: 1,
        remotePin: 2,
      },
      segments: addResult.nextSegments,
      auxNodes: created.nextAuxNodes,
    });
    assert.ok("errorMessage" in dupRemote);

    // Delete vpin_40 -> restores virtual placeholder in place
    const removed = planRemoveSegmentWithAuxRestore({
      id: "vpin_40",
      segments: addResult.nextSegments,
      auxNodes: created.nextAuxNodes,
      createId,
    });

    assert.equal(removed.removed?.id, "vpin_40");
    assert.ok(removed.restoredPlaceholder !== null);
    assert.equal(removed.restoredPlaceholder?.type, "placeholder");
    assert.equal(removed.restoredPlaceholder?.isVirtual, true);
    assert.equal(removed.restoredPlaceholder?.nodeId, 1);
    assert.equal(removed.nextSegments.length, 4);
    assert.equal(
      removed.nextSegments.filter((s) => s.type === "placeholder").length,
      4,
    );
  });

  it("enforces deterministic IDs, 16-node cap, pinCapacity cap, and 48 total segments cap", () => {
    assert.equal(createHardwareSegmentId(2), "gpio_2");
    assert.equal(createHardwareSegmentId(39), "gpio_39");
    assert.equal(createHardwareSegmentId(40), "vpin_40");
    assert.equal(createHardwareSegmentId(127), "vpin_127");

    const fullNodes = Array.from({ length: MAX_AUX_NODES }, (_, i) => ({
      nodeId: i + 1,
      name: `Node ${i + 1}`,
      mac: `AA:BB:CC:DD:EE:${String(i + 1).padStart(2, "0")}`,
      pinCapacity: 2,
      chipType: "esp8266_01",
      groupName: `Node ${i + 1}`,
    }));
    assert.equal(allocateNextAuxNodeId(fullNodes), null);

    const fullSegments = Array.from({ length: MAX_TOTAL_SEGMENTS }, (_, i) => ({
      id: `vpin_${40 + i}`,
      type: "gpio_toggle",
      pin: String(40 + i),
      title: `S${i}`,
      group: "G",
      isVirtual: true,
      nodeId: 1,
      remotePin: i % 30,
    }));
    assert.equal(allocateNextVirtualPin(fullSegments), 40 + MAX_TOTAL_SEGMENTS);

    const capped = planAddSegment({
      input: {
        type: "gpio_toggle",
        pin: "",
        isVirtual: true,
        nodeId: 1,
        remotePin: 35,
      },
      segments: fullSegments,
      auxNodes: [
        {
          nodeId: 1,
          name: "Big",
          mac: "AA:BB:CC:DD:EE:01",
          pinCapacity: 32,
          chipType: "esp32",
          groupName: "Big",
        },
      ],
    });
    assert.ok("errorMessage" in capped);

    // Editing node cannot lower pinCapacity below active segment count
    const updateReject = planUpdateAuxNode({
      nodeId: 1,
      input: {
        name: "باغچه جدید",
        mac: "AA:BB:CC:DD:EE:01",
        pinCapacity: 1,
        chipType: "esp8266_01",
      },
      auxNodes: [
        {
          nodeId: 1,
          name: "باغچه",
          mac: "AA:BB:CC:DD:EE:01",
          pinCapacity: 4,
          chipType: "esp8266_01",
          groupName: "باغچه",
        },
      ],
      groupsOrder: ["باغچه"],
      groupConfigs: { باغچه: { maxCols: 2 } },
      segments: [
        { id: "vpin_40", type: "gpio_toggle", pin: "40", title: "A", group: "باغچه", isVirtual: true, nodeId: 1, remotePin: 0 },
        { id: "vpin_41", type: "gpio_toggle", pin: "41", title: "B", group: "باغچه", isVirtual: true, nodeId: 1, remotePin: 2 },
      ],
      createId: () => "ph_edit",
    });
    assert.equal(updateReject.ok, false);
  });
});

describe("state_sync / aux_node_ack parsing, Cloudflare round-trip, and ESP_CFG_V2 text output", () => {
  it("parses state_sync with virtual & nodes, parses aux_node_ack, and keeps legacy state_sync compatible", () => {
    const enc = (obj) => new TextEncoder().encode(JSON.stringify(obj));

    const syncWithAux = parseMqttStateMessage(
      enc({
        type: "state_sync",
        states: { "2": 1, "40": 0 },
        virtual: { "40": { node: 1, rpin: 2 } },
        nodes: [
          {
            id: 1,
            mac: "AA:BB:CC:DD:EE:01",
            cap: 4,
            chip: 1,
            name: "باغچه",
            online: true,
          },
        ],
      }),
    );

    assert.equal(syncWithAux?.kind, "state_sync");
    if (syncWithAux?.kind === "state_sync") {
      assert.deepEqual(syncWithAux.virtual, { "40": { node: 1, rpin: 2 } });
      assert.equal(syncWithAux.nodes?.length, 1);
      assert.equal(syncWithAux.nodes?.[0].online, true);
      assert.equal(syncWithAux.nodes?.[0].chip, 1);
    }

    const ack = parseMqttStateMessage(
      enc({
        type: "aux_node_ack",
        action: "upsert",
        id: 1,
        mac: "AA:BB:CC:DD:EE:01",
        cap: 4,
        chip: 1,
      }),
    );
    assert.equal(ack?.kind, "aux_node_ack");
    if (ack?.kind === "aux_node_ack") {
      assert.equal(ack.action, "upsert");
      assert.equal(ack.id, 1);
      assert.equal(ack.mac, "AA:BB:CC:DD:EE:01");
    }

    const legacy = parseMqttStateMessage(
      enc({
        type: "state_sync",
        states: { "2": 1 },
      }),
    );
    assert.equal(legacy?.kind, "state_sync");
    if (legacy?.kind === "state_sync") {
      assert.equal(legacy.virtual, undefined);
      assert.equal(legacy.nodes, undefined);
    }
  });

  it("preserves auxNodes and virtual segments across Cloudflare serialization and generates valid ESP_CFG_V2", () => {
    const config = buildEspConfig({
      isDark: true,
      accent3: "#E5E7EB",
      accent4: "#3B82F6",
      selectedFont: "dana",
      animationsEnabled: true,
      animationsFps: 60,
      headerTitle: "تست",
      manualSaveMode: false,
      groupsOrder: ["پذیرایی", "باغچه"],
      groupsCols: 2,
      groupConfigs: {},
      segments: [
        { id: "gpio_2", type: "gpio_toggle", pin: "2", title: "لامپ حال", group: "پذیرایی", state: true },
        {
          id: "vpin_40",
          type: "gpio_toggle",
          pin: "40",
          title: "لامپ باغچه",
          group: "باغچه",
          state: false,
          isVirtual: true,
          nodeId: 1,
          remotePin: 2,
        },
        {
          id: "ph_1",
          type: "placeholder",
          pin: "",
          title: "پایه خالی 2",
          group: "باغچه",
          isVirtual: true,
          nodeId: 1,
        },
      ],
      auxNodes: [
        {
          nodeId: 1,
          name: "Parking North",
          mac: "AA:BB:CC:DD:EE:01",
          pinCapacity: 4,
          chipType: "esp8266_01",
          groupName: "باغچه",
        },
      ],
      automations: [],
      macros: [],
      voiceCommands: [],
      wifiNetworks: [],
      wifiNetworksConfigured: false,
      wifiApConfig: null,
      mqttConfig: null,
    });

    const serialized = serializeToCloudflare(config);
    assert.equal(serialized.auxNodes?.length, 1);
    assert.equal(serialized.segments_definition[1].isVirtual, true);
    assert.equal(serialized.segments_definition[1].nodeId, 1);
    assert.equal(serialized.segments_definition[1].remotePin, 2);

    const restored = deserializeFromCloudflare(serialized);
    assert.equal(restored.auxNodes?.length, 1);
    assert.equal(restored.auxNodes?.[0].mac, "AA:BB:CC:DD:EE:01");
    assert.equal(restored.segments[1].isVirtual, true);
    assert.equal(restored.segments[1].nodeId, 1);
    assert.equal(restored.segments[1].remotePin, 2);

    const cfgText = buildEspCfgV2Text(restored);
    const lines = cfgText.split("\n");
    assert.equal(lines[0], "ESP_CFG_V2");
    assert.equal(lines[1], "E n=1");
    assert.equal(lines[2], "E id=1 mac=AA:BB:CC:DD:EE:01 cap=4 chip=1 name=Parking_North");
    assert.equal(lines[3], "C n=2");
    assert.equal(lines[4], "S id=gpio_2 type=gpio_toggle pin=2 state=1");
    assert.equal(lines[5], "S id=vpin_40 type=gpio_toggle pin=40 state=0 virt=1 node=1 rpin=2");
  });
});
