#include <Arduino.h>
#include <unity.h>

#include <AchaemenidConfigProtocol.h>
#include <AppEvents.h>
#include <AuxNodeManager.h>
#include <ConfigApplier.h>
#include <NvsAuxNodeStorage.h>
#include <NvsSegmentStorage.h>
#include <PinManager.h>
#include <Preferences.h>
#include <RuleEngine.h>
#include <Timer/Timer.h>
#include <Core/Async/Executor.h>
#include <Events/EventDispatcher.h>
#include <parsers/MqttCommandDispatcher.h>
#include <parsers/RuleParsers.h>
#include <parsers/SegmentParsers.h>
#include <parsers/StateParsers.h>

#include <cstring>
#include <string>
#include <vector>

namespace {

class VirtualEventRecorder : public uniuno::IEventDispatcher {
public:
  std::vector<AuxNodeUpsertRequestEvent> auxUpserts;
  std::vector<std::string> auxNames;
  std::vector<AuxNodeRemoveRequestEvent> auxRemoves;
  std::vector<VirtualSegmentAddRequestEvent> vSegAdds;
  std::vector<std::string> vSegIds;
  std::vector<std::string> vSegTypes;
  std::vector<PinStateChangeRequestEvent> pinReqs;
  std::vector<PinStateChangedEvent> pinChanges;
  std::vector<SegmentUpdateRuleRequestEvent> ruleUpdates;
  std::vector<SegmentUpdateAnalogInputConfigRequestEvent> adcConfigUpdates;
  std::vector<AnalogInputReadRequestEvent> adcReads;

  void dispatchByHash(void* event, uint32_t event_hash) override {
    if (event_hash == uniuno::kEventHash<AuxNodeUpsertRequestEvent>) {
      auto* e = static_cast<AuxNodeUpsertRequestEvent*>(event);
      auxNames.push_back(e->name ? e->name : "");
      AuxNodeUpsertRequestEvent copy = *e;
      copy.name = auxNames.back().c_str();
      auxUpserts.push_back(copy);
    } else if (event_hash == uniuno::kEventHash<AuxNodeRemoveRequestEvent>) {
      auxRemoves.push_back(*static_cast<AuxNodeRemoveRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<VirtualSegmentAddRequestEvent>) {
      auto* e = static_cast<VirtualSegmentAddRequestEvent*>(event);
      vSegIds.push_back(e->id ? e->id : "");
      vSegTypes.push_back(e->type ? e->type : "");
      VirtualSegmentAddRequestEvent copy = *e;
      copy.id = vSegIds.back().c_str();
      copy.type = vSegTypes.back().c_str();
      vSegAdds.push_back(copy);
    } else if (event_hash == uniuno::kEventHash<PinStateChangeRequestEvent>) {
      pinReqs.push_back(*static_cast<PinStateChangeRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<PinStateChangedEvent>) {
      pinChanges.push_back(*static_cast<PinStateChangedEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<SegmentUpdateRuleRequestEvent>) {
      ruleUpdates.push_back(*static_cast<SegmentUpdateRuleRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<SegmentUpdateAnalogInputConfigRequestEvent>) {
      adcConfigUpdates.push_back(*static_cast<SegmentUpdateAnalogInputConfigRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<AnalogInputReadRequestEvent>) {
      adcReads.push_back(*static_cast<AnalogInputReadRequestEvent*>(event));
    }
  }

  void dispatch(void* event, const char* event_name) override {
    if (!event_name) return;
    dispatchByHash(event, uniuno::hash_event_name(event_name));
  }

  uint32_t registerListener(const char*, void (*)(void*), bool = false) override { return 0; }
  bool removeListenerById(const char*, uint32_t) override { return false; }
  size_t removeListener(const char*) override { return 0; }
};

void resetAllState() {
  mockHw().reset();
  Preferences::resetAll();
}

} // namespace

void setUp() {
  resetAllState();
}

void tearDown() {}

// ============================================================================
// 1. MAC Address Parsing, Formatting & Unicast Validation
// ============================================================================
void test_mac_address_parsing_and_validation() {
  uint8_t mac[6] = {};
  char formatted[18] = {};

  TEST_ASSERT_TRUE(parseMacAddress("aa:bb:cc:dd:ee:01", mac));
  formatMacAddress(mac, formatted, sizeof(formatted));
  TEST_ASSERT_EQUAL_STRING("AA:BB:CC:DD:EE:01", formatted);

  // Hyphenated and bare hex formats
  TEST_ASSERT_TRUE(parseMacAddress("24-6F-28-11-22-33", mac));
  formatMacAddress(mac, formatted, sizeof(formatted));
  TEST_ASSERT_EQUAL_STRING("24:6F:28:11:22:33", formatted);

  TEST_ASSERT_TRUE(parseMacAddress("a4cf12987654", mac));
  formatMacAddress(mac, formatted, sizeof(formatted));
  TEST_ASSERT_EQUAL_STRING("A4:CF:12:98:76:54", formatted);

  // Reject invalid MACs: all-zero, broadcast FF, multicast (LSB of first byte = 1), malformed
  TEST_ASSERT_FALSE(parseMacAddress("00:00:00:00:00:00", mac));
  TEST_ASSERT_FALSE(parseMacAddress("FF:FF:FF:FF:FF:FF", mac));
  TEST_ASSERT_FALSE(parseMacAddress("01:11:22:33:44:55", mac)); // Multicast
  TEST_ASSERT_FALSE(parseMacAddress("AA:BB:CC:DD:EE", mac));    // Too short
  TEST_ASSERT_FALSE(parseMacAddress("AA:BB:CC:DD:EE:GG", mac)); // Non-hex
}

// ============================================================================
// 2. AuxNodeManager CRUD, MAC Deduplication & NVS Dual-Bank Persistence
// ============================================================================
void test_aux_node_manager_crud_and_nvs_persistence() {
  AuxNodeManager mgr;
  const uint8_t mac1[6] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01};
  const uint8_t mac2[6] = {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x02};
  const uint8_t badMac[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

  TEST_ASSERT_TRUE(mgr.upsertNode(1, mac1, 4, AUX_CHIP_ESP8266_01, "Garden ESP"));
  TEST_ASSERT_TRUE(mgr.upsertNode(2, mac2, 8, AUX_CHIP_ESP8266_12, "Yard Node"));
  TEST_ASSERT_FALSE(mgr.upsertNode(3, badMac, 4, AUX_CHIP_ESP32, "Bad"));
  TEST_ASSERT_FALSE(mgr.upsertNode(0, mac1, 4, AUX_CHIP_ESP32, "LocalInvalid"));
  TEST_ASSERT_EQUAL_INT(2, mgr.getActiveCount());

  // Duplicate MAC on a different nodeId must deduplicate (move MAC to new ID)
  TEST_ASSERT_TRUE(mgr.upsertNode(5, mac1, 2, AUX_CHIP_ESP8266_01, "Moved Garden"));
  TEST_ASSERT_FALSE(mgr.hasNodeId(1));
  TEST_ASSERT_TRUE(mgr.hasNodeId(5));
  TEST_ASSERT_EQUAL_UINT8(5, mgr.findNodeIdByMac(mac1));
  TEST_ASSERT_EQUAL_INT(2, mgr.getActiveCount());

  // Persist to NVS and simulate reboot into a fresh AuxNodeManager
  uniuno::NvsAuxNodeStorage storage;
  ParseResult exported;
  mgr.exportConfig(exported);
  TEST_ASSERT_EQUAL_INT(2, exported.auxNodeCount);
  storage.saveAuxNodes(exported);

  ParseResult loaded;
  TEST_ASSERT_TRUE(storage.loadAuxNodes(loaded));
  TEST_ASSERT_TRUE(loaded.auxNodesProvided);
  TEST_ASSERT_EQUAL_INT(2, loaded.auxNodeCount);

  AuxNodeManager rebooted;
  for (int i = 0; i < loaded.auxNodeCount; ++i) {
    const AuxNodeConfig& n = loaded.auxNodes[i];
    TEST_ASSERT_TRUE(rebooted.upsertNode(n.nodeId, n.mac, n.pinCapacity, n.chipType, n.name));
  }
  TEST_ASSERT_EQUAL_INT(2, rebooted.getActiveCount());
  const AuxNodeConfig* n5 = rebooted.getNodeById(5);
  TEST_ASSERT_NOT_NULL(n5);
  TEST_ASSERT_TRUE(macEquals(n5->mac, mac1));
  TEST_ASSERT_EQUAL_UINT8(2, n5->pinCapacity);
  TEST_ASSERT_EQUAL_UINT8(AUX_CHIP_ESP8266_01, n5->chipType);
  TEST_ASSERT_EQUAL_STRING("Moved Garden", n5->name);

  // Delete by MAC fallback
  uint8_t removedId = 0;
  TEST_ASSERT_TRUE(rebooted.removeNodeByIdOrMac(0, mac2, &removedId));
  TEST_ASSERT_EQUAL_UINT8(2, removedId);
  TEST_ASSERT_EQUAL_INT(1, rebooted.getActiveCount());
}

// ============================================================================
// 3. PinManager Virtual Segments: Zero Local Hardware Touch, Shadow State & Scale (>16)
// ============================================================================
void test_pin_manager_virtual_segments_and_scale() {
  PinManager pm;
  AuxNodeManager aux;
  const uint8_t mac1[6] = {0x24, 0x6F, 0x28, 0xAA, 0xBB, 0x01};
  const uint8_t mac2[6] = {0x24, 0x6F, 0x28, 0xAA, 0xBB, 0x02};
  TEST_ASSERT_TRUE(aux.upsertNode(1, mac1, 4, AUX_CHIP_ESP8266_01, "LampNode"));
  TEST_ASSERT_TRUE(aux.upsertNode(2, mac2, 12, AUX_CHIP_ESP32, "SensorNode"));

  // Add 8 local segments + 16 virtual segments = 24 total (> legacy MAX_SEGMENTS=16)
  const int localPins[8] = {2, 4, 5, 12, 13, 14, 15, 16};
  for (int i = 0; i < 8; ++i) {
    char id[16];
    snprintf(id, sizeof(id), "gpio_%d", localPins[i]);
    TEST_ASSERT_TRUE(pm.addSegment(id, SegmentType::Output, localPins[i]));
  }

  // Record mock hardware pin state before adding virtual segments
  const int hwModePin2Before = mockHw().pinModes[2];
  const int hwModePin4Before = mockHw().pinModes[4];

  for (int i = 0; i < 16; ++i) {
    const int vpin = 40 + i;
    const uint8_t nodeId = (i < 4) ? 1 : 2;
    const uint8_t rpin = static_cast<uint8_t>(i < 4 ? i : (i - 4));
    char id[16];
    snprintf(id, sizeof(id), "vpin_%d", vpin);
    const SegmentType st = (i == 1)   ? SegmentType::AnalogOutput
                           : (i == 2) ? SegmentType::Input
                           : (i == 3) ? SegmentType::AnalogInput
                                      : SegmentType::Output;
    TEST_ASSERT_TRUE(pm.addVirtualSegment(id, st, vpin, nodeId, rpin));
  }
  TEST_ASSERT_EQUAL_INT(24, pm.getActiveCount());

  // Confirm local hardware was NOT disturbed by adding virtual segments with rpin=2,4
  TEST_ASSERT_EQUAL_INT(hwModePin2Before, mockHw().pinModes[2]);
  TEST_ASSERT_EQUAL_INT(hwModePin4Before, mockHw().pinModes[4]);

  // Virtual output shadow toggle works without touching local GPIO
  TEST_ASSERT_TRUE(pm.isVirtualPinRegistered(40));
  uint8_t boundNode = 0, boundRpin = 0;
  TEST_ASSERT_TRUE(pm.getVirtualBinding(40, boundNode, boundRpin));
  TEST_ASSERT_EQUAL_UINT8(1, boundNode);
  TEST_ASSERT_EQUAL_UINT8(0, boundRpin);

  TEST_ASSERT_FALSE(pm.getPinState(40));
  TEST_ASSERT_TRUE(pm.setPinState(40, true));
  TEST_ASSERT_TRUE(pm.getPinState(40));

  // Virtual PWM shadow value works without attaching ESP32 LEDC channel
  TEST_ASSERT_TRUE(pm.isAnalogOutputPin(41));
  TEST_ASSERT_TRUE(pm.setPinAnalogValue(41, 180));
  TEST_ASSERT_EQUAL_INT16(180, pm.getPinAnalogValue(41));
  TEST_ASSERT_TRUE(pm.getPinState(41));
  TEST_ASSERT_TRUE(pm.setPinState(41, false));
  TEST_ASSERT_EQUAL_INT16(0, pm.getPinAnalogValue(41));
  TEST_ASSERT_TRUE(pm.setPinState(41, true)); // Restore last non-zero PWM
  TEST_ASSERT_EQUAL_INT16(180, pm.getPinAnalogValue(41));

  // Upsert replacing duplicate (nodeId=1, remotePin=0) on new vpin 90 removes old vpin 40
  TEST_ASSERT_TRUE(pm.upsertVirtualSegment("vpin_90", SegmentType::Output, 90, 1, 0));
  TEST_ASSERT_FALSE(pm.hasPin(40));
  TEST_ASSERT_TRUE(pm.hasPin(90));
  TEST_ASSERT_EQUAL_INT(24, pm.getActiveCount());

  // Canonical vpin_<N> extraction
  TEST_ASSERT_EQUAL_INT(90, PinManager::extractPinFromCanonicalId("vpin_90"));
  TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("vpin_39"));
  TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("vpin_128"));

  // exportStateJson includes "virtual" and "nodes" sections before "timers"
  String json = pm.exportStateJson(&aux);
  const int virtIdx = json.indexOf("\"virtual\":{");
  const int nodesIdx = json.indexOf("\"nodes\":[");
  const int timersIdx = json.indexOf("\"timers\":{");
  TEST_ASSERT_TRUE(virtIdx >= 0);
  TEST_ASSERT_TRUE(nodesIdx > virtIdx);
  TEST_ASSERT_TRUE(timersIdx > nodesIdx);
  TEST_ASSERT_TRUE(json.indexOf("\"90\":{\"node\":1,\"rpin\":0}") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("24:6F:28:AA:BB:01") >= 0);

  // Cascade delete all segments bound to Node #1 (4 segments: vpin 90, 41, 42, 43)
  const int removed = pm.removeSegmentsByNodeId(1);
  TEST_ASSERT_EQUAL_INT(4, removed);
  TEST_ASSERT_EQUAL_INT(20, pm.getActiveCount());
  TEST_ASSERT_FALSE(pm.hasPin(90));
  TEST_ASSERT_TRUE(pm.hasPin(44)); // Node #2 unaffected
  TEST_ASSERT_TRUE(pm.hasPin(5));  // Local GPIO unaffected
}

// ============================================================================
// 4. Virtual Input Injection + Cross-Node RuleEngine Automation (Virtual <-> Local)
// ============================================================================
void test_virtual_input_injection_and_rule_engine_cross_trigger() {
  PinManager pm;
  TEST_ASSERT_TRUE(pm.addSegment("gpio_5", SegmentType::Output, 5));
  TEST_ASSERT_TRUE(pm.addVirtualSegment("vpin_40", SegmentType::Output, 40, 1, 2));
  TEST_ASSERT_TRUE(pm.addVirtualSegment("vpin_41", SegmentType::Input, 41, 1, 0));

  // Rule on virtual digital input vpin_41: HIGH turns ON local GPIO 5 AND virtual output vpin_40
  RuleConfig rule;
  rule.active = true;
  rule.highActionCount = 2;
  rule.highActions[0].targetPin = 5;
  rule.highActions[0].requiredHoldTime = 0;
  rule.highActions[0].actionState = true;
  rule.highActions[0].actionType = ACTION_IMMEDIATE;
  rule.highActions[0].delay = 0;
  rule.highActions[1].targetPin = 40;
  rule.highActions[1].requiredHoldTime = 0;
  rule.highActions[1].actionState = true;
  rule.highActions[1].actionType = ACTION_IMMEDIATE;
  rule.highActions[1].delay = 0;
  TEST_ASSERT_TRUE(pm.updateSegmentRuleByPin(41, rule));

  uniuno::TimerFeatures tf;
  tf.timeout = true;
  tf.clear = true;
  uniuno::Timer timer(tf, millis);
  uniuno::Executor executor;
  uniuno::EventDispatcher bus;
  static std::vector<PinStateChangedEvent> capturedChanges;
  capturedChanges.clear();
  bus.on<PinStateChangedEvent>([](PinStateChangedEvent* e) {
    if (e != nullptr) capturedChanges.push_back(*e);
  });
  bool dashboardOnline = true;
  RuleContext ctx{nullptr, &timer, &executor, &bus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);

  unsigned long durSec = 0;
  RuleConfig outRule;
  TEST_ASSERT_TRUE(pm.injectVirtualInputState(41, true, durSec, outRule));
  TEST_ASSERT_TRUE(pm.getPinState(41));
  engine.handleInput(41, true, durSec, outRule);

  TEST_ASSERT_TRUE(pm.getPinState(5));
  TEST_ASSERT_TRUE(pm.getPinState(40));
  TEST_ASSERT_EQUAL_UINT32(2, capturedChanges.size());

  // Virtual analog input injection + hysteresis + range rule
  TEST_ASSERT_TRUE(pm.addVirtualSegment("vpin_42", SegmentType::AnalogInput, 42, 1, 17, 0, RuleConfig(),
                                        DEFAULT_PWM_RESOLUTION, DEFAULT_PWM_FREQUENCY, 12, 500, 10, 2000, 1500));
  AnalogInputChange change;
  RuleConfig analogRule;
  TEST_ASSERT_TRUE(pm.injectVirtualAnalogInput(42, 2400, change, analogRule));
  TEST_ASSERT_EQUAL_UINT16(2400, change.value);
  TEST_ASSERT_TRUE(change.thresholdChanged);
  TEST_ASSERT_TRUE(change.thresholdState);

  AdcSampleResult onDemand;
  TEST_ASSERT_TRUE(pm.readAnalogInputNow(42, onDemand));
  TEST_ASSERT_EQUAL_UINT16(2400, onDemand.value);
  TEST_ASSERT_TRUE(onDemand.thresholdState);
}

// ============================================================================
// 5. Binary MQTT Parsers: 0x0F, 0x10, 0x11 and Virtual Pins on 0x01/0x05/0x0C/0x0D/0x0E
// ============================================================================
void test_binary_mqtt_parsers_aux_nodes_and_virtual_segments() {
  uniuno::MqttCommandDispatcher dispatcher;
  uniuno::SegmentParsers segParser;
  uniuno::StateParsers stateParser;
  uniuno::RuleParsers ruleParser;
  dispatcher.registerHandler(&segParser);
  dispatcher.registerHandler(&stateParser);
  dispatcher.registerHandler(&ruleParser);
  VirtualEventRecorder rec;

  // 0x0F UPSERT_AUX_NODE: nodeId=1, mac=AA:BB:CC:DD:EE:01, cap=4, chip=1(ESP8266-01), name="Roof"
  const uint8_t upsertNodeFrame[] = {0x0F, 0x01, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01,
                                     0x04, 0x01, 'R',  'o',  'o',  'f',  0x00};
  dispatcher.handlePayload(upsertNodeFrame, sizeof(upsertNodeFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.auxUpserts.size());
  TEST_ASSERT_EQUAL_UINT8(1, rec.auxUpserts[0].nodeId);
  TEST_ASSERT_EQUAL_UINT8(4, rec.auxUpserts[0].pinCapacity);
  TEST_ASSERT_EQUAL_UINT8(AUX_CHIP_ESP8266_01, rec.auxUpserts[0].chipType);
  TEST_ASSERT_EQUAL_STRING("Roof", rec.auxNames[0].c_str());

  // 0x10 DELETE_AUX_NODE: nodeId=1, flags=0x01 (cascade), mac=AA:BB:CC:DD:EE:01
  const uint8_t deleteNodeFrame[] = {0x10, 0x01, 0x01, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01};
  dispatcher.handlePayload(deleteNodeFrame, sizeof(deleteNodeFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.auxRemoves.size());
  TEST_ASSERT_EQUAL_UINT8(1, rec.auxRemoves[0].nodeId);
  TEST_ASSERT_TRUE(rec.auxRemoves[0].hasMac);
  TEST_ASSERT_TRUE(rec.auxRemoves[0].cascadeSegments);

  // 0x11 ADD_VIRTUAL_SEGMENT: vpin=40, nodeId=1, rpin=2, init=0, id="vpin_40", type="analog_output", res=10, freq=2000,
  // initVal=512
  const uint8_t addVsegFrame[] = {0x11,
                                  40,
                                  1,
                                  2,
                                  0,
                                  'v',
                                  'p',
                                  'i',
                                  'n',
                                  '_',
                                  '4',
                                  '0',
                                  0x00,
                                  'a',
                                  'n',
                                  'a',
                                  'l',
                                  'o',
                                  'g',
                                  '_',
                                  'o',
                                  'u',
                                  't',
                                  'p',
                                  'u',
                                  't',
                                  0x00,
                                  10,
                                  static_cast<uint8_t>(2000 & 0xFF),
                                  static_cast<uint8_t>((2000 >> 8) & 0xFF),
                                  static_cast<uint8_t>(512 & 0xFF),
                                  static_cast<uint8_t>((512 >> 8) & 0xFF)};
  dispatcher.handlePayload(addVsegFrame, sizeof(addVsegFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.vSegAdds.size());
  TEST_ASSERT_EQUAL_INT(40, rec.vSegAdds[0].virtualPin);
  TEST_ASSERT_EQUAL_UINT8(1, rec.vSegAdds[0].nodeId);
  TEST_ASSERT_EQUAL_UINT8(2, rec.vSegAdds[0].remotePin);
  TEST_ASSERT_EQUAL_STRING("vpin_40", rec.vSegIds[0].c_str());
  TEST_ASSERT_EQUAL_STRING("analog_output", rec.vSegTypes[0].c_str());
  TEST_ASSERT_EQUAL_UINT8(10, rec.vSegAdds[0].pwmResolution);
  TEST_ASSERT_EQUAL_UINT16(2000, rec.vSegAdds[0].pwmFrequency);
  TEST_ASSERT_EQUAL_UINT16(512, rec.vSegAdds[0].initialValue);

  // Reject 0x11 with non-virtual pin 12
  const uint8_t badVsegFrame[] = {0x11, 12, 1, 2, 0, 'x', 0x00, 'o', 'u', 't', 'p', 'u', 't', 0x00};
  dispatcher.handlePayload(badVsegFrame, sizeof(badVsegFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.vSegAdds.size());

  // 0x0D READ_ANALOG_INPUT on virtual pin 45
  const uint8_t readAdcFrame[] = {0x0D, 45};
  dispatcher.handlePayload(readAdcFrame, sizeof(readAdcFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.adcReads.size());
  TEST_ASSERT_EQUAL_INT(45, rec.adcReads[0].pin);

  // 0x0C UPDATE_ANALOG_INPUT_CONFIG on virtual pin 45
  const uint8_t updAdcFrame[] = {0x0C, 45, 0xF4, 0x01, 0x14, 0x00, 0xE8, 0x03, 0xBC, 0x02, 10};
  dispatcher.handlePayload(updAdcFrame, sizeof(updAdcFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.adcConfigUpdates.size());
  TEST_ASSERT_EQUAL_INT(45, rec.adcConfigUpdates[0].pin);
  TEST_ASSERT_EQUAL_UINT8(10, rec.adcConfigUpdates[0].resolution);

  // 0x05 UPDATE_RULE from virtual input pin 42 targeting virtual output pin 40
  const uint8_t updRuleFrame[] = {
      0x05, 42,
      1,                                   // 1 HIGH action
      40,   0,  0, 0, 0, 1, 0, 0, 0, 0, 0, // targetPin=40, hold=0, state=1, type=0, delay=0
      0                                    // 0 LOW actions
  };
  dispatcher.handlePayload(updRuleFrame, sizeof(updRuleFrame), &rec);
  TEST_ASSERT_EQUAL_UINT32(1, rec.ruleUpdates.size());
  TEST_ASSERT_EQUAL_INT(42, rec.ruleUpdates[0].pin);
  TEST_ASSERT_EQUAL_INT(40, rec.ruleUpdates[0].rule.highActions[0].targetPin);
}

// ============================================================================
// 6. ACP ESP_CFG_V2 Parsing + ConfigApplier + NVS V6 Round-Trip
// ============================================================================
void test_acp_virtual_config_and_nvs_v6_round_trip() {
  const char* cfgText = "ESP_CFG_V2\n"
                        "E n=1\n"
                        "E id=1 mac=AA:BB:CC:DD:EE:01 cap=4 chip=1 name=Garden_Lamp\n"
                        "C n=3\n"
                        "S id=gpio_5 type=output pin=5 val=0 ao=0\n"
                        "S id=vpin_40 type=output pin=40 val=0 ao=0 virt=1 node=1 rpin=2\n"
                        "S id=vpin_41 type=input pin=41 val=0 ao=0 virt=1 node=1 rpin=0\n"
                        "RH id=vpin_41 tgt=40 hold=0 st=1 act=0 dly=0\n";

  uniuno::AchaemenidConfigProtocol parser;
  ParseResult parsed;
  TEST_ASSERT_TRUE(parser.parse(cfgText, parsed));
  TEST_ASSERT_TRUE(parsed.auxNodesProvided);
  TEST_ASSERT_EQUAL_INT(1, parsed.auxNodeCount);
  TEST_ASSERT_EQUAL_UINT8(1, parsed.auxNodes[0].nodeId);
  TEST_ASSERT_EQUAL_UINT8(4, parsed.auxNodes[0].pinCapacity);
  TEST_ASSERT_EQUAL_UINT8(AUX_CHIP_ESP8266_01, parsed.auxNodes[0].chipType);
  TEST_ASSERT_EQUAL_STRING("Garden_Lamp", parsed.auxNodes[0].name);

  TEST_ASSERT_TRUE(parsed.segmentsProvided);
  TEST_ASSERT_EQUAL_INT(3, parsed.count);
  TEST_ASSERT_FALSE(parsed.segments[0].isVirtual);
  TEST_ASSERT_TRUE(parsed.segments[1].isVirtual);
  TEST_ASSERT_EQUAL_INT(40, parsed.segments[1].pin);
  TEST_ASSERT_EQUAL_UINT8(1, parsed.segments[1].nodeId);
  TEST_ASSERT_EQUAL_UINT8(2, parsed.segments[1].remotePin);
  TEST_ASSERT_TRUE(parsed.segments[2].isVirtual);
  TEST_ASSERT_EQUAL_INT(1, parsed.segments[2].rule.highActionCount);
  TEST_ASSERT_EQUAL_INT(40, parsed.segments[2].rule.highActions[0].targetPin);

  PinManager pm;
  AuxNodeManager aux;
  TEST_ASSERT_EQUAL_INT(3, ConfigApplier::apply(parsed, &pm, &aux));
  TEST_ASSERT_EQUAL_INT(1, aux.getActiveCount());
  TEST_ASSERT_EQUAL_INT(3, pm.getActiveCount());
  TEST_ASSERT_TRUE(pm.isVirtualPinRegistered(40));
  TEST_ASSERT_TRUE(pm.isVirtualPinRegistered(41));

  // Save both segments (NVS V6) and aux nodes, then reboot into fresh managers
  uniuno::NvsSegmentStorage segStorage;
  uniuno::NvsAuxNodeStorage auxStorage;
  ParseResult segSnap;
  ParseResult auxSnap;
  pm.exportConfig(segSnap);
  aux.exportConfig(auxSnap);
  segStorage.saveSegmentConfig(segSnap);
  auxStorage.saveAuxNodes(auxSnap);

  PinManager rebootPm;
  AuxNodeManager rebootAux;
  ParseResult loadedAux;
  ParseResult loadedSegs;
  TEST_ASSERT_TRUE(auxStorage.loadAuxNodes(loadedAux));
  for (int i = 0; i < loadedAux.auxNodeCount; ++i) {
    const AuxNodeConfig& n = loadedAux.auxNodes[i];
    TEST_ASSERT_TRUE(rebootAux.upsertNode(n.nodeId, n.mac, n.pinCapacity, n.chipType, n.name));
  }
  TEST_ASSERT_TRUE(segStorage.loadSegmentConfig(loadedSegs));
  TEST_ASSERT_EQUAL_INT(3, ConfigApplier::apply(loadedSegs, &rebootPm, &rebootAux));

  TEST_ASSERT_EQUAL_INT(1, rebootAux.getActiveCount());
  TEST_ASSERT_EQUAL_INT(3, rebootPm.getActiveCount());
  uint8_t nId = 0, rPin = 0;
  TEST_ASSERT_TRUE(rebootPm.getVirtualBinding(40, nId, rPin));
  TEST_ASSERT_EQUAL_UINT8(1, nId);
  TEST_ASSERT_EQUAL_UINT8(2, rPin);
  RuleConfig restoredRule = rebootPm.getRuleByPin(41);
  TEST_ASSERT_TRUE(restoredRule.active);
  TEST_ASSERT_EQUAL_INT(1, restoredRule.highActionCount);
  TEST_ASSERT_EQUAL_INT(40, restoredRule.highActions[0].targetPin);
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_mac_address_parsing_and_validation);
  RUN_TEST(test_aux_node_manager_crud_and_nvs_persistence);
  RUN_TEST(test_pin_manager_virtual_segments_and_scale);
  RUN_TEST(test_virtual_input_injection_and_rule_engine_cross_trigger);
  RUN_TEST(test_binary_mqtt_parsers_aux_nodes_and_virtual_segments);
  RUN_TEST(test_acp_virtual_config_and_nvs_v6_round_trip);
  return UNITY_END();
}
