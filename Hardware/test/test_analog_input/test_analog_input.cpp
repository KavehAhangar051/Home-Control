#include <Arduino.h>
#include <unity.h>

#include <AchaemenidConfigProtocol.h>
#include <AppEvents.h>
#include <ConfigApplier.h>
#include <GpioAdc.h>
#include <GpioPwm.h>
#include <NvsSegmentStorage.h>
#include <PinManager.h>
#include <Preferences.h>
#include <RuleEngine.h>
#include <Timer/Timer.h>
#include <parsers/MqttCommandDispatcher.h>
#include <parsers/RuleParsers.h>
#include <parsers/SegmentParsers.h>
#include <parsers/StateParsers.h>
#include <parsers/WsClientParser.h>
#include <parsers/WsServerParser.h>

#include <cstring>
#include <string>
#include <vector>

namespace {

class RecordingEventDispatcher : public uniuno::IEventDispatcher {
public:
  std::vector<PinStateChangeRequestEvent> pinRequests;
  std::vector<PinStateChangedEvent> pinChanges;
  std::vector<SegmentAddRequestEvent> segmentAdds;
  std::vector<std::string> segmentAddIds;
  std::vector<std::string> segmentAddTypes;
  std::vector<SegmentUpdateRuleRequestEvent> ruleUpdates;
  std::vector<SegmentUpdateAnalogInputConfigRequestEvent> analogConfigUpdates;
  std::vector<AnalogInputReadRequestEvent> analogReadRequests;
  std::vector<CloudSyncRequestEvent> cloudSyncs;
  int configLoadedCount = 0;

  void dispatchByHash(void* event, uint32_t event_hash) override {
    if (event_hash == uniuno::kEventHash<PinStateChangeRequestEvent>) {
      pinRequests.push_back(*static_cast<PinStateChangeRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<PinStateChangedEvent>) {
      pinChanges.push_back(*static_cast<PinStateChangedEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<SegmentAddRequestEvent>) {
      auto* e = static_cast<SegmentAddRequestEvent*>(event);
      segmentAddIds.push_back(e->id ? e->id : "");
      segmentAddTypes.push_back(e->type ? e->type : "");
      SegmentAddRequestEvent copy = *e;
      copy.id = segmentAddIds.back().c_str();
      copy.type = segmentAddTypes.back().c_str();
      segmentAdds.push_back(copy);
    } else if (event_hash == uniuno::kEventHash<SegmentUpdateRuleRequestEvent>) {
      ruleUpdates.push_back(*static_cast<SegmentUpdateRuleRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<SegmentUpdateAnalogInputConfigRequestEvent>) {
      analogConfigUpdates.push_back(*static_cast<SegmentUpdateAnalogInputConfigRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<AnalogInputReadRequestEvent>) {
      analogReadRequests.push_back(*static_cast<AnalogInputReadRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<CloudSyncRequestEvent>) {
      cloudSyncs.push_back(*static_cast<CloudSyncRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<ConfigLoadedEvent>) {
      configLoadedCount++;
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

void pushU16LE(std::vector<uint8_t>& buf, uint16_t v) {
  buf.push_back(static_cast<uint8_t>(v & 0xFF));
  buf.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
}

void pushI16LE(std::vector<uint8_t>& buf, int16_t v) {
  pushU16LE(buf, static_cast<uint16_t>(v));
}

void pushI32LE(std::vector<uint8_t>& buf, int32_t v) {
  const uint32_t u = static_cast<uint32_t>(v);
  buf.push_back(static_cast<uint8_t>(u & 0xFF));
  buf.push_back(static_cast<uint8_t>((u >> 8) & 0xFF));
  buf.push_back(static_cast<uint8_t>((u >> 16) & 0xFF));
  buf.push_back(static_cast<uint8_t>((u >> 24) & 0xFF));
}

void pushCStr(std::vector<uint8_t>& buf, const char* s) {
  while (*s)
    buf.push_back(static_cast<uint8_t>(*s++));
  buf.push_back(0);
}

// ============================================================================
// 1. GpioAdc Pin Validation & Parameter Normalization
// ============================================================================
void test_gpio_adc_pin_validation_and_normalization() {
  // WiFi-safe ADC1 pins MUST be accepted
  TEST_ASSERT_TRUE(GpioAdc::isValidAdcPin(32));
  TEST_ASSERT_TRUE(GpioAdc::isValidAdcPin(33));
  TEST_ASSERT_TRUE(GpioAdc::isValidAdcPin(34));
  TEST_ASSERT_TRUE(GpioAdc::isValidAdcPin(35));
  TEST_ASSERT_TRUE(GpioAdc::isValidAdcPin(36));
  TEST_ASSERT_TRUE(GpioAdc::isValidAdcPin(39));

  // ADC2 WiFi-conflicting pins MUST be rejected
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(0));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(2));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(4));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(12));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(13));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(14));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(15));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(25));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(26));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(27));

  // Flash / non-ADC / out-of-range pins MUST be rejected
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(-1));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(6));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(18));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(37));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(38));
  TEST_ASSERT_FALSE(GpioAdc::isValidAdcPin(40));

  // Resolution clamping [8..12]
  TEST_ASSERT_EQUAL_UINT8(8, GpioAdc::normalizeResolution(4));
  TEST_ASSERT_EQUAL_UINT8(10, GpioAdc::normalizeResolution(10));
  TEST_ASSERT_EQUAL_UINT8(12, GpioAdc::normalizeResolution(16));

  // Sample interval clamping [50..60000]
  TEST_ASSERT_EQUAL_UINT16(50, GpioAdc::normalizeSampleInterval(10));
  TEST_ASSERT_EQUAL_UINT16(250, GpioAdc::normalizeSampleInterval(250));
  TEST_ASSERT_EQUAL_UINT16(60000, GpioAdc::normalizeSampleInterval(90000));

  // Delta clamping [1..maxValue]
  TEST_ASSERT_EQUAL_UINT16(1, GpioAdc::normalizeDelta(0, 12));
  TEST_ASSERT_EQUAL_UINT16(255, GpioAdc::normalizeDelta(500, 8));
  TEST_ASSERT_EQUAL_UINT16(4095, GpioAdc::normalizeDelta(9999, 12));

  // Threshold normalization & inversion guard
  uint16_t hi = 3000, lo = 3500;
  GpioAdc::normalizeThresholds(hi, lo, 12);
  TEST_ASSERT_EQUAL_UINT16(3000, hi);
  TEST_ASSERT_EQUAL_UINT16(3000, lo);

  hi = 0;
  lo = 500;
  GpioAdc::normalizeThresholds(hi, lo, 12);
  TEST_ASSERT_EQUAL_UINT16(0, hi);
  TEST_ASSERT_EQUAL_UINT16(0, lo);
}

// ============================================================================
// 2. GpioAdc Lifecycle, Oversampling, Resolution Scaling & Deadband
// ============================================================================
void test_gpio_adc_driver_sampling_scaling_and_deadband() {
  mockHw().analogValues[34] = 2048;

  GpioAdc adc(34, 12, 200, 50, 0, 0);
  TEST_ASSERT_TRUE(adc.begin());
  TEST_ASSERT_TRUE(adc.isAttached());
  TEST_ASSERT_EQUAL_UINT8(INPUT, mockHw().pinModes[34]);
  TEST_ASSERT_EQUAL_UINT8(12, mockHw().adcReadResolution);
  TEST_ASSERT_EQUAL_INT(ADC_11db, mockHw().analogAttenuation[34]);
  TEST_ASSERT_EQUAL_UINT16(2048, adc.getValue());
  TEST_ASSERT_EQUAL_INT(4, mockHw().analogReadCalls); // 4x oversampling baseline

  // Before interval elapses -> no sample performed
  mockHw().fakeMillis += 100;
  AdcSampleResult r = adc.sample(mockHw().fakeMillis);
  TEST_ASSERT_FALSE(r.sampled);
  TEST_ASSERT_FALSE(r.valueChanged);
  TEST_ASSERT_EQUAL_INT(4, mockHw().analogReadCalls);

  // Small jitter within deadband -> sampled, valueChanged = false
  mockHw().analogValues[34] = 2070;
  mockHw().fakeMillis += 150; // total +250ms >= 200ms
  r = adc.sample(mockHw().fakeMillis);
  TEST_ASSERT_TRUE(r.sampled);
  TEST_ASSERT_FALSE(r.valueChanged); // EMA = (2048+2070+1)>>1 = 2059; |2059-2048| = 11 < 50

  // Large jump beyond deadband -> valueChanged = true
  mockHw().analogValues[34] = 2500;
  mockHw().fakeMillis += 200;
  r = adc.sample(mockHw().fakeMillis);
  TEST_ASSERT_TRUE(r.sampled);
  TEST_ASSERT_TRUE(r.valueChanged);
  TEST_ASSERT_TRUE(r.value > 2200);
  TEST_ASSERT_EQUAL_UINT16(r.value, adc.getLastReportedValue());

  // Exact 0 rail snap & report even if diff < delta
  GpioAdc adcRail(35, 8, 100, 30, 0, 0);
  mockHw().analogValues[35] = 4095; // 8-bit max = 255
  TEST_ASSERT_TRUE(adcRail.begin());
  TEST_ASSERT_EQUAL_UINT16(255, adcRail.getValue());

  // Drop to 0 and let EMA converge to 0
  mockHw().analogValues[35] = 0;
  for (int i = 0; i < 10; ++i) {
    mockHw().fakeMillis += 100;
    r = adcRail.sample(mockHw().fakeMillis);
  }
  TEST_ASSERT_EQUAL_UINT16(0, adcRail.getValue());
  TEST_ASSERT_EQUAL_UINT16(0, adcRail.getLastReportedValue());

  // On-demand readNow() bypasses interval & EMA lag
  mockHw().analogValues[35] = 2048; // 8-bit = 128
  mockHw().fakeMillis += 10;        // < 100ms interval
  r = adcRail.readNow(mockHw().fakeMillis);
  TEST_ASSERT_TRUE(r.sampled);
  TEST_ASSERT_TRUE(r.valueChanged);
  TEST_ASSERT_EQUAL_UINT16(128, r.value);

  adc.end();
  adcRail.end();
  TEST_ASSERT_FALSE(adc.isAttached());
}

// ============================================================================
// 3. GpioAdc Schmitt-Trigger Hysteresis (No Oscillation in Dead-Zone)
// ============================================================================
void test_gpio_adc_schmitt_trigger_hysteresis() {
  mockHw().analogValues[36] = 1000;
  GpioAdc adc(36, 12, 100, 100, 2800, 2200);
  TEST_ASSERT_TRUE(adc.begin());
  TEST_ASSERT_FALSE(adc.getThresholdState());

  // Move into hysteresis band (2500) -> still LOW
  mockHw().analogValues[36] = 2500;
  for (int i = 0; i < 6; ++i) {
    mockHw().fakeMillis += 100;
    AdcSampleResult r = adc.sample(mockHw().fakeMillis);
    TEST_ASSERT_FALSE(r.thresholdChanged);
    TEST_ASSERT_FALSE(r.thresholdState);
  }

  // Cross above highThreshold (2800) -> flips to HIGH exactly once
  mockHw().analogValues[36] = 3500;
  bool flippedHigh = false;
  for (int i = 0; i < 4; ++i) {
    mockHw().fakeMillis += 100;
    AdcSampleResult r = adc.sample(mockHw().fakeMillis);
    if (r.thresholdChanged) {
      TEST_ASSERT_FALSE(flippedHigh); // Must fire only once
      TEST_ASSERT_TRUE(r.thresholdState);
      TEST_ASSERT_TRUE(r.valueChanged);
      flippedHigh = true;
    }
  }
  TEST_ASSERT_TRUE(flippedHigh);
  TEST_ASSERT_TRUE(adc.getThresholdState());

  // Drop back into hysteresis band (2400) -> MUST remain HIGH (no chatter!)
  mockHw().analogValues[36] = 2400;
  for (int i = 0; i < 6; ++i) {
    mockHw().fakeMillis += 100;
    AdcSampleResult r = adc.sample(mockHw().fakeMillis);
    TEST_ASSERT_FALSE(r.thresholdChanged);
    TEST_ASSERT_TRUE(r.thresholdState);
  }

  // Drop below lowThreshold (2200) -> flips to LOW exactly once
  mockHw().analogValues[36] = 1500;
  bool flippedLow = false;
  for (int i = 0; i < 4; ++i) {
    mockHw().fakeMillis += 100;
    AdcSampleResult r = adc.sample(mockHw().fakeMillis);
    if (r.thresholdChanged) {
      TEST_ASSERT_FALSE(flippedLow);
      TEST_ASSERT_FALSE(r.thresholdState);
      TEST_ASSERT_TRUE(r.valueChanged);
      flippedLow = true;
    }
  }
  TEST_ASSERT_TRUE(flippedLow);
  TEST_ASSERT_FALSE(adc.getThresholdState());
}

// ============================================================================
// 4. ESP_CFG_V2 Protocol + ConfigApplier + PinManager Export / State JSON
// ============================================================================
void test_config_protocol_applier_and_state_export_analog_input() {
  mockHw().analogValues[34] = 3000;
  mockHw().analogValues[35] = 1024; // 10-bit = 256

  const char* cfgPayload = "ESP_CFG_V2\n"
                           "C n=4\n"
                           "S id=relay_1 type=gpio_toggle pin=2 val=0\n"
                           "S id=dimmer_1 type=analog_output pin=18 val=128 res=8 freq=5000\n"
                           "S id=ldr_porch type=analog_input pin=34 res=12 sint=300 delta=50 ath=2800 atl=2200\n"
                           "RH tgt=18 hld=0 ast=1 atp=0 dly=0 aval=200\n"
                           "RL tgt=18 hld=0 ast=0 atp=0 dly=0\n"
                           "S id=pot_knob type=adc_input pin=35 res=10 sint=150 delta=12\n";

  uniuno::AchaemenidConfigProtocol parser;
  ParseResult parsed;
  TEST_ASSERT_TRUE(parser.parse(cfgPayload, parsed));
  TEST_ASSERT_TRUE(parsed.success);
  TEST_ASSERT_EQUAL_INT(4, parsed.count);

  // Verify LDR segment parsed fields
  TEST_ASSERT_EQUAL_STRING("ldr_porch", parsed.segments[2].id);
  TEST_ASSERT_EQUAL_STRING("analog_input", parsed.segments[2].type);
  TEST_ASSERT_EQUAL_INT(34, parsed.segments[2].pin);
  TEST_ASSERT_EQUAL_UINT8(12, parsed.segments[2].adcResolution);
  TEST_ASSERT_EQUAL_UINT16(300, parsed.segments[2].adcSampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT16(50, parsed.segments[2].adcDeltaThreshold);
  TEST_ASSERT_EQUAL_UINT16(2800, parsed.segments[2].adcHighThreshold);
  TEST_ASSERT_EQUAL_UINT16(2200, parsed.segments[2].adcLowThreshold);
  TEST_ASSERT_TRUE(parsed.segments[2].rule.active);
  TEST_ASSERT_EQUAL_INT(1, parsed.segments[2].rule.highActionCount);
  TEST_ASSERT_EQUAL_INT16(200, parsed.segments[2].rule.highActions[0].targetValue);

  // Verify adc_input alias & 10-bit resolution
  TEST_ASSERT_EQUAL_STRING("pot_knob", parsed.segments[3].id);
  TEST_ASSERT_EQUAL_UINT8(10, parsed.segments[3].adcResolution);
  TEST_ASSERT_EQUAL_UINT16(150, parsed.segments[3].adcSampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT16(12, parsed.segments[3].adcDeltaThreshold);

  // Apply via ConfigApplier
  PinManager pm;
  TEST_ASSERT_EQUAL_INT(4, ConfigApplier::apply(parsed, &pm));
  TEST_ASSERT_TRUE(pm.isAnalogInputPin(34));
  TEST_ASSERT_TRUE(pm.isAnalogInputPin(35));
  TEST_ASSERT_EQUAL_INT16(3000, pm.getPinAnalogValue(34));
  TEST_ASSERT_EQUAL_UINT8(12, pm.getPinAdcResolution(34));
  TEST_ASSERT_TRUE(pm.getPinState(34)); // 3000 >= 2800 initial baseline
  TEST_ASSERT_EQUAL_INT16(256, pm.getPinAnalogValue(35));
  TEST_ASSERT_EQUAL_UINT8(10, pm.getPinAdcResolution(35));
  TEST_ASSERT_FALSE(pm.getPinState(35)); // ath=0 -> state false

  // AnalogInput pins MUST be read-only (reject write attempts)
  TEST_ASSERT_FALSE(pm.setPinState(34, false));
  TEST_ASSERT_FALSE(pm.setPinAnalogValue(34, 100));

  // Invalid ADC2 pin MUST be rejected by PinManager::addSegment
  TEST_ASSERT_FALSE(pm.addSegment("bad_adc2", SegmentType::AnalogInput, 25));

  // Verify exportStateJson includes both analog_output (18) and analog_input (34, 35)
  String json = pm.exportStateJson();
  TEST_ASSERT_TRUE(json.indexOf("\"34\":true") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"35\":false") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"34\":3000") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"35\":256") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"18\":128") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"resolutions\":{") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"34\":12") >= 0);
  TEST_ASSERT_TRUE(json.indexOf("\"35\":10") >= 0);

  // Verify timers section does NOT include analog_input pins
  const int timersIdx = json.indexOf("\"timers\":{");
  TEST_ASSERT_TRUE(timersIdx >= 0);
  String timersPart = json.substring(static_cast<size_t>(timersIdx));
  TEST_ASSERT_TRUE(timersPart.indexOf("\"18\":0") >= 0);
  TEST_ASSERT_TRUE(timersPart.indexOf("\"34\":") < 0);
  TEST_ASSERT_TRUE(timersPart.indexOf("\"35\":") < 0);
}

// ============================================================================
// 5. NVS Storage v4 Roundtrip & v3 Backward Migration
// ============================================================================
void test_nvs_storage_v4_roundtrip_and_v3_migration() {
  mockHw().analogValues[32] = 1500;
  PinManager pm;
  RuleConfig rule;
  rule.active = true;
  rule.highActionCount = 1;
  rule.highActions[0].targetPin = 18;
  rule.highActions[0].requiredHoldTime = 3;
  rule.highActions[0].actionState = true;
  rule.highActions[0].actionType = ACTION_IMMEDIATE;
  rule.highActions[0].delay = 0;
  rule.highActions[0].targetValue = 220;

  TEST_ASSERT_TRUE(pm.addSegment("dimmer_a", SegmentType::AnalogOutput, 18, 0, RuleConfig(), 10, 8000));
  TEST_ASSERT_TRUE(pm.addSegment("soil_1", SegmentType::AnalogInput, 32, 0, rule, DEFAULT_PWM_RESOLUTION,
                                 DEFAULT_PWM_FREQUENCY, 12, 750, 60, 2600, 2100));

  ParseResult exported;
  pm.exportConfig(exported);

  uniuno::NvsSegmentStorage storage;
  storage.saveSegmentConfig(exported);

  ParseResult loaded;
  TEST_ASSERT_TRUE(storage.loadSegmentConfig(loaded));
  TEST_ASSERT_EQUAL_INT(2, loaded.count);

  TEST_ASSERT_EQUAL_STRING("soil_1", loaded.segments[1].id);
  TEST_ASSERT_EQUAL_STRING("analog_input", loaded.segments[1].type);
  TEST_ASSERT_EQUAL_INT(32, loaded.segments[1].pin);
  TEST_ASSERT_EQUAL_UINT8(12, loaded.segments[1].adcResolution);
  TEST_ASSERT_EQUAL_UINT16(750, loaded.segments[1].adcSampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT16(60, loaded.segments[1].adcDeltaThreshold);
  TEST_ASSERT_EQUAL_UINT16(2600, loaded.segments[1].adcHighThreshold);
  TEST_ASSERT_EQUAL_UINT16(2100, loaded.segments[1].adcLowThreshold);
  TEST_ASSERT_TRUE(loaded.segments[1].rule.active);
  TEST_ASSERT_EQUAL_INT16(220, loaded.segments[1].rule.highActions[0].targetValue);

  // Now test seamless migration from legacy NVS v3 record
  Preferences::resetAll();
#pragma pack(push, 1)
  struct TestRuleActionV3 {
    int32_t requiredHoldTime;
    int8_t targetPin;
    uint8_t actionState;
    uint8_t actionType;
    int32_t delay;
    int16_t targetValue;
  };
  struct TestSegmentV3 {
    char id[32];
    char type[16];
    int16_t pin;
    uint16_t autoOffDelay;
    uint8_t pwmResolution;
    uint16_t pwmFrequency;
    uint8_t highActionCount;
    uint8_t lowActionCount;
    uint8_t ruleActive;
    TestRuleActionV3 highActions[4];
    TestRuleActionV3 lowActions[4];
  };
#pragma pack(pop)

  TestSegmentV3 v3Rec{};
  strlcpy(v3Rec.id, "legacy_pwm", sizeof(v3Rec.id));
  strlcpy(v3Rec.type, "analog_output", sizeof(v3Rec.type));
  v3Rec.pin = 19;
  v3Rec.autoOffDelay = 15;
  v3Rec.pwmResolution = 12;
  v3Rec.pwmFrequency = 5000;

  Preferences prefs;
  TEST_ASSERT_TRUE(prefs.begin("AchaemenidSeg", false));
  prefs.putBytes("a0", &v3Rec, sizeof(v3Rec));
  prefs.putInt("aCount", 1);
  prefs.putUChar("aVer", 3);
  prefs.putString("active", "a");
  prefs.end();

  ParseResult migrated;
  TEST_ASSERT_TRUE(storage.loadSegmentConfig(migrated));
  TEST_ASSERT_EQUAL_INT(1, migrated.count);
  TEST_ASSERT_EQUAL_STRING("legacy_pwm", migrated.segments[0].id);
  TEST_ASSERT_EQUAL_UINT8(12, migrated.segments[0].pwmResolution);
  TEST_ASSERT_EQUAL_UINT8(DEFAULT_ADC_RESOLUTION, migrated.segments[0].adcResolution);
  TEST_ASSERT_EQUAL_UINT16(DEFAULT_ADC_SAMPLE_INTERVAL_MS, migrated.segments[0].adcSampleIntervalMs);
}

// ============================================================================
// 6. PinManager::processAnalogInputs + RuleEngine End-to-End Automation
// ============================================================================
void test_analog_input_polling_and_rule_engine_automation() {
  mockHw().analogValues[34] = 1000;

  PinManager pm;
  uniuno::EventDispatcher realBus;
  static std::vector<CloudSyncRequestEvent> recordedCloudSyncs;
  recordedCloudSyncs.clear();
  realBus.on<CloudSyncRequestEvent>([](CloudSyncRequestEvent* e) {
    if (e) recordedCloudSyncs.push_back(*e);
  });
  uniuno::Timer timer(uniuno::TimerFeatures(), millis, &realBus);
  bool dashboardOnline = true;

  TEST_ASSERT_TRUE(pm.addSegment("lamp_pwm", SegmentType::AnalogOutput, 18, 0, RuleConfig(), 8, 5000));

  RuleConfig ldrRule;
  ldrRule.active = true;
  ldrRule.highActionCount = 1;
  ldrRule.highActions[0].targetPin = 18;
  ldrRule.highActions[0].requiredHoldTime = 0;
  ldrRule.highActions[0].actionState = true;
  ldrRule.highActions[0].actionType = ACTION_IMMEDIATE;
  ldrRule.highActions[0].delay = 0;
  ldrRule.highActions[0].targetValue = 210;

  ldrRule.lowActionCount = 1;
  ldrRule.lowActions[0].targetPin = 18;
  ldrRule.lowActions[0].requiredHoldTime = 0;
  ldrRule.lowActions[0].actionState = false;
  ldrRule.lowActions[0].actionType = ACTION_IMMEDIATE;
  ldrRule.lowActions[0].delay = 0;
  ldrRule.lowActions[0].targetValue = 0;

  TEST_ASSERT_TRUE(pm.addSegment("ldr_1", SegmentType::AnalogInput, 34, 0, ldrRule, DEFAULT_PWM_RESOLUTION,
                                 DEFAULT_PWM_FREQUENCY, 12, 100, 50, 2800, 2200));

  RuleContext ctx{nullptr, &timer, nullptr, &realBus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);

  int callbackCount = 0;
  auto onAnalog = [&](const AnalogInputChange& ch, const RuleConfig& r) {
    callbackCount++;
    if (ch.thresholdChanged) {
      engine.handleInput(ch.pin, ch.thresholdState, ch.durationSec, r);
    } else if (ch.valueChanged) {
      engine.scheduleCloudSync(ch.pin);
    }
  };

  // 1. Value rises above delta (1000 -> 1800) without crossing threshold (2800)
  mockHw().analogValues[34] = 1800;
  mockHw().fakeMillis += 100;
  pm.processAnalogInputs(onAnalog);
  TEST_ASSERT_EQUAL_INT(1, callbackCount);
  TEST_ASSERT_EQUAL_INT16(0, pm.getPinAnalogValue(18)); // PWM still OFF

  // Advance 1000ms -> debounced cloudSync fires with analog value & resolution
  mockHw().fakeMillis += 1000;
  timer.tick();
  TEST_ASSERT_EQUAL_UINT32(1, recordedCloudSyncs.size());
  TEST_ASSERT_EQUAL_INT(34, recordedCloudSyncs[0].pin);
  TEST_ASSERT_FALSE(recordedCloudSyncs[0].state);
  TEST_ASSERT_EQUAL_INT16(pm.getPinAnalogValue(34), recordedCloudSyncs[0].analogValue);
  TEST_ASSERT_EQUAL_UINT8(12, recordedCloudSyncs[0].resolution);

  // 2. Value surges to 3600 -> crosses ath=2800 -> RuleEngine sets PWM pin 18 to 210!
  mockHw().analogValues[34] = 3600;
  for (int i = 0; i < 3; ++i) {
    mockHw().fakeMillis += 100;
    pm.processAnalogInputs(onAnalog);
  }
  TEST_ASSERT_TRUE(pm.getPinState(34));
  TEST_ASSERT_EQUAL_INT16(210, pm.getPinAnalogValue(18));
  TEST_ASSERT_TRUE(pm.getPinState(18));

  // 3. Value drops to 1000 -> crosses atl=2200 -> RuleEngine turns PWM pin 18 to 0!
  mockHw().analogValues[34] = 1000;
  for (int i = 0; i < 4; ++i) {
    mockHw().fakeMillis += 100;
    pm.processAnalogInputs(onAnalog);
  }
  TEST_ASSERT_FALSE(pm.getPinState(34));
  TEST_ASSERT_EQUAL_INT16(0, pm.getPinAnalogValue(18));
  TEST_ASSERT_FALSE(pm.getPinState(18));
}

// ============================================================================
// 7. MQTT Binary Parsers: 0x02 (analog_input), 0x0B (rule), 0x0C (config), 0x0D (read)
// ============================================================================
void test_mqtt_binary_parsers_analog_input_opcodes() {
  RecordingEventDispatcher bus;
  uniuno::MqttCommandDispatcher dispatcher;
  uniuno::StateParsers stateParsers;
  uniuno::SegmentParsers segmentParsers;
  uniuno::RuleParsers ruleParsers;
  dispatcher.registerHandler(&stateParsers);
  dispatcher.registerHandler(&segmentParsers);
  dispatcher.registerHandler(&ruleParsers);

  // 1. Opcode 0x02: ADD_SEGMENT for analog_input with full 9B trailing metadata
  std::vector<uint8_t> addFrame;
  addFrame.push_back(0x02);
  addFrame.push_back(34); // GPIO34
  addFrame.push_back(0);  // legacyVal
  pushCStr(addFrame, "ldr_garden");
  pushCStr(addFrame, "analog_input");
  addFrame.push_back(12);    // res = 12-bit
  pushU16LE(addFrame, 400);  // sint = 400ms
  pushU16LE(addFrame, 35);   // delta = 35
  pushU16LE(addFrame, 3000); // ath = 3000
  pushU16LE(addFrame, 2400); // atl = 2400

  dispatcher.handlePayload(addFrame.data(), addFrame.size(), &bus);
  TEST_ASSERT_EQUAL_UINT32(1, bus.segmentAdds.size());
  TEST_ASSERT_EQUAL_STRING("ldr_garden", bus.segmentAddIds[0].c_str());
  TEST_ASSERT_EQUAL_STRING("analog_input", bus.segmentAddTypes[0].c_str());
  TEST_ASSERT_EQUAL_INT(34, bus.segmentAdds[0].pin);
  TEST_ASSERT_EQUAL_UINT8(12, bus.segmentAdds[0].adcResolution);
  TEST_ASSERT_EQUAL_UINT16(400, bus.segmentAdds[0].adcSampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT16(35, bus.segmentAdds[0].adcDeltaThreshold);
  TEST_ASSERT_EQUAL_UINT16(3000, bus.segmentAdds[0].adcHighThreshold);
  TEST_ASSERT_EQUAL_UINT16(2400, bus.segmentAdds[0].adcLowThreshold);

  // 2. Opcode 0x0C: UPDATE_ANALOG_INPUT_CONFIG (11 bytes with resolution)
  std::vector<uint8_t> cfgFrame;
  cfgFrame.push_back(0x0C);
  cfgFrame.push_back(34);
  pushU16LE(cfgFrame, 250); // sint
  pushU16LE(cfgFrame, 20);  // delta
  pushU16LE(cfgFrame, 800); // ath
  pushU16LE(cfgFrame, 600); // atl
  cfgFrame.push_back(10);   // res = 10-bit

  dispatcher.handlePayload(cfgFrame.data(), cfgFrame.size(), &bus);
  TEST_ASSERT_EQUAL_UINT32(1, bus.analogConfigUpdates.size());
  TEST_ASSERT_EQUAL_INT(34, bus.analogConfigUpdates[0].pin);
  TEST_ASSERT_EQUAL_UINT16(250, bus.analogConfigUpdates[0].sampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT16(20, bus.analogConfigUpdates[0].deltaThreshold);
  TEST_ASSERT_EQUAL_UINT16(800, bus.analogConfigUpdates[0].highThreshold);
  TEST_ASSERT_EQUAL_UINT16(600, bus.analogConfigUpdates[0].lowThreshold);
  TEST_ASSERT_EQUAL_UINT8(10, bus.analogConfigUpdates[0].resolution);

  // Malformed 0x0C (invalid resolution 15) MUST be rejected
  cfgFrame[10] = 15;
  dispatcher.handlePayload(cfgFrame.data(), cfgFrame.size(), &bus);
  TEST_ASSERT_EQUAL_UINT32(1, bus.analogConfigUpdates.size());

  // 3. Opcode 0x0D: READ_ANALOG_INPUT
  const uint8_t readFrame[2] = {0x0D, 34};
  dispatcher.handlePayload(readFrame, sizeof(readFrame), &bus);
  TEST_ASSERT_EQUAL_UINT32(1, bus.analogReadRequests.size());
  TEST_ASSERT_EQUAL_INT(34, bus.analogReadRequests[0].pin);

  // 4. Opcode 0x0B: UPDATE_RULE_ANALOG targeting analog_input GPIO34
  std::vector<uint8_t> ruleFrame;
  ruleFrame.push_back(0x0B);
  ruleFrame.push_back(34);   // analog_input GPIO34
  ruleFrame.push_back(1);    // 1 HIGH action
  ruleFrame.push_back(18);   // targetPin = 18
  pushI32LE(ruleFrame, 0);   // hold = 0
  ruleFrame.push_back(1);    // actionState = true
  ruleFrame.push_back(0);    // IMMEDIATE
  pushI32LE(ruleFrame, 0);   // delay = 0
  pushI16LE(ruleFrame, 180); // targetValue = 180
  ruleFrame.push_back(0);    // 0 LOW actions

  dispatcher.handlePayload(ruleFrame.data(), ruleFrame.size(), &bus);
  TEST_ASSERT_EQUAL_UINT32(1, bus.ruleUpdates.size());
  TEST_ASSERT_EQUAL_INT(34, bus.ruleUpdates[0].pin);

  // Apply rule & config update directly on PinManager
  PinManager pm;
  TEST_ASSERT_TRUE(pm.addSegment("ldr_garden", SegmentType::AnalogInput, 34));
  TEST_ASSERT_TRUE(pm.updateSegmentRuleByPin(34, bus.ruleUpdates[0].rule));
  TEST_ASSERT_TRUE(pm.updateAnalogInputConfigByPin(34, 250, 20, 800, 600, 10));
  TEST_ASSERT_EQUAL_UINT8(10, pm.getPinAdcResolution(34));
  TEST_ASSERT_EQUAL_UINT16(250, pm.getPinAdcSampleInterval(34));
  TEST_ASSERT_EQUAL_UINT16(20, pm.getPinAdcDeltaThreshold(34));
  TEST_ASSERT_EQUAL_UINT16(800, pm.getPinAdcHighThreshold(34));
  TEST_ASSERT_EQUAL_UINT16(600, pm.getPinAdcLowThreshold(34));
}

// ============================================================================
// 8. WebSocket Parsers (Local WS & Cloudflare WS) for Analog Input Commands
// ============================================================================
void test_websocket_parsers_analog_input_commands() {
  RecordingEventDispatcher bus;

  // Local WS Server commands
  uniuno::WsServerParser serverParser(&bus, []() { return String("{\"type\":\"state_sync\"}"); });
  websockets::WebsocketsClient mockClient;

  serverParser.parseMessage("{\"command\":\"read_analog\",\"pin\":35}", mockClient);
  TEST_ASSERT_EQUAL_UINT32(1, bus.analogReadRequests.size());
  TEST_ASSERT_EQUAL_INT(35, bus.analogReadRequests[0].pin);

  serverParser.parseMessage(
      "{\"command\":\"config_analog_input\",\"pin\":35,\"sint\":300,\"delta\":25,\"ath\":2600,\"atl\":2000,\"res\":12}",
      mockClient);
  TEST_ASSERT_EQUAL_UINT32(1, bus.analogConfigUpdates.size());
  TEST_ASSERT_EQUAL_INT(35, bus.analogConfigUpdates[0].pin);
  TEST_ASSERT_EQUAL_UINT16(300, bus.analogConfigUpdates[0].sampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT16(25, bus.analogConfigUpdates[0].deltaThreshold);
  TEST_ASSERT_EQUAL_UINT16(2600, bus.analogConfigUpdates[0].highThreshold);
  TEST_ASSERT_EQUAL_UINT16(2000, bus.analogConfigUpdates[0].lowThreshold);
  TEST_ASSERT_EQUAL_UINT8(12, bus.analogConfigUpdates[0].resolution);

  // Cloudflare WS Client binary commands (0x0C and 0x0D)
  uniuno::WsClientParser clientParser(&bus);

  std::vector<uint8_t> cfCfg;
  cfCfg.push_back(0x0C);
  cfCfg.push_back(39);
  pushU16LE(cfCfg, 1000);
  pushU16LE(cfCfg, 80);
  pushU16LE(cfCfg, 3200);
  pushU16LE(cfCfg, 2800);
  clientParser.parseMessage(
      websockets::WebsocketsMessage(std::string(reinterpret_cast<const char*>(cfCfg.data()), cfCfg.size()), true));
  TEST_ASSERT_EQUAL_UINT32(2, bus.analogConfigUpdates.size());
  TEST_ASSERT_EQUAL_INT(39, bus.analogConfigUpdates[1].pin);
  TEST_ASSERT_EQUAL_UINT16(1000, bus.analogConfigUpdates[1].sampleIntervalMs);
  TEST_ASSERT_EQUAL_UINT8(0, bus.analogConfigUpdates[1].resolution);

  const uint8_t cfRead[2] = {0x0D, 39};
  clientParser.parseMessage(
      websockets::WebsocketsMessage(std::string(reinterpret_cast<const char*>(cfRead), sizeof(cfRead)), true));
  TEST_ASSERT_EQUAL_UINT32(2, bus.analogReadRequests.size());
  TEST_ASSERT_EQUAL_INT(39, bus.analogReadRequests[1].pin);
}

// ============================================================================
// 9. O(1) ADC1 Channel LUT, Async SAR1 Burst API & XtensaAnalogAsm DSP Helpers
// ============================================================================
void test_gpio_adc_lut_async_burst_and_xtensa_dsp() {
  // 1. Verify O(1) GPIO -> ADC1 hardware channel LUT
  TEST_ASSERT_EQUAL_INT8(4, GpioAdc::pinToAdc1Channel(32));
  TEST_ASSERT_EQUAL_INT8(5, GpioAdc::pinToAdc1Channel(33));
  TEST_ASSERT_EQUAL_INT8(6, GpioAdc::pinToAdc1Channel(34));
  TEST_ASSERT_EQUAL_INT8(7, GpioAdc::pinToAdc1Channel(35));
  TEST_ASSERT_EQUAL_INT8(0, GpioAdc::pinToAdc1Channel(36));
  TEST_ASSERT_EQUAL_INT8(3, GpioAdc::pinToAdc1Channel(39));
  TEST_ASSERT_EQUAL_INT8(-1, GpioAdc::pinToAdc1Channel(37));
  TEST_ASSERT_EQUAL_INT8(-1, GpioAdc::pinToAdc1Channel(38));
  TEST_ASSERT_EQUAL_INT8(-1, GpioAdc::pinToAdc1Channel(25)); // ADC2 rejected
  TEST_ASSERT_EQUAL_INT8(-1, GpioAdc::pinToAdc1Channel(-1));

  // 2. Verify non-blocking async burst API lifecycle
  mockHw().analogValues[36] = 1000;
  GpioAdc adc(36, 12, 100, 40, 2800, 2200);
  TEST_ASSERT_TRUE(adc.begin());
  TEST_ASSERT_EQUAL_INT8(0, adc.getAdc1Channel());
  TEST_ASSERT_FALSE(adc.isAsyncBurstActive());

  mockHw().analogValues[36] = 3400;
  TEST_ASSERT_TRUE(adc.startAsyncBurst());
  TEST_ASSERT_TRUE(adc.isAsyncBurstActive());

  // Abort burst cleanly
  adc.abortAsyncBurst();
  TEST_ASSERT_FALSE(adc.isAsyncBurstActive());

  // Restart and complete async burst
  TEST_ASSERT_TRUE(adc.startAsyncBurst());
  AdcSampleResult res;
  TEST_ASSERT_TRUE(adc.pollAsyncBurst(mockHw().fakeMillis + 100, res));
  TEST_ASSERT_FALSE(adc.isAsyncBurstActive());
  TEST_ASSERT_TRUE(res.sampled);
  TEST_ASSERT_TRUE(res.valueChanged);
  TEST_ASSERT_EQUAL_UINT16(2200, res.value); // EMA(1000, 3400) = 2200

  // 3. Verify XtensaAnalogAsm DSP helpers across boundary values
  TEST_ASSERT_EQUAL_UINT16(0, uniuno::xtensa_asm::asm_clamp_u16(-50, 0, 4095));
  TEST_ASSERT_EQUAL_UINT16(4095, uniuno::xtensa_asm::asm_clamp_u16(9999, 0, 4095));
  TEST_ASSERT_EQUAL_UINT16(1234, uniuno::xtensa_asm::asm_clamp_u16(1234, 0, 4095));
  TEST_ASSERT_EQUAL_UINT16(500, uniuno::xtensa_asm::asm_abs_diff_u16(1500, 1000));
  TEST_ASSERT_EQUAL_UINT16(500, uniuno::xtensa_asm::asm_abs_diff_u16(1000, 1500));
  TEST_ASSERT_EQUAL_UINT16(0, uniuno::xtensa_asm::asm_ema50_rail_snap(1, 0, 4095));
  TEST_ASSERT_EQUAL_UINT16(4095, uniuno::xtensa_asm::asm_ema50_rail_snap(4094, 4095, 4095));
  TEST_ASSERT_TRUE(uniuno::xtensa_asm::asm_schmitt_eval(2800, 2800, 2200, false));
  TEST_ASSERT_TRUE(uniuno::xtensa_asm::asm_schmitt_eval(2500, 2800, 2200, true));
  TEST_ASSERT_FALSE(uniuno::xtensa_asm::asm_schmitt_eval(2200, 2800, 2200, true));
  TEST_ASSERT_FALSE(uniuno::xtensa_asm::asm_schmitt_eval(4095, 0, 0, true));
  TEST_ASSERT_EQUAL_UINT32(0UL, uniuno::xtensa_asm::asm_div1000_u32(999UL));
  TEST_ASSERT_EQUAL_UINT32(1UL, uniuno::xtensa_asm::asm_div1000_u32(1000UL));
  TEST_ASSERT_EQUAL_UINT32(10UL, uniuno::xtensa_asm::asm_div1000_u32(10999UL));
  TEST_ASSERT_EQUAL_UINT32(4294967UL, uniuno::xtensa_asm::asm_div1000_u32(4294967295UL));
}

} // namespace

void setUp() {
  mockHw().reset();
  Preferences::resetAll();
}

void tearDown() {}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_gpio_adc_pin_validation_and_normalization);
  RUN_TEST(test_gpio_adc_driver_sampling_scaling_and_deadband);
  RUN_TEST(test_gpio_adc_schmitt_trigger_hysteresis);
  RUN_TEST(test_config_protocol_applier_and_state_export_analog_input);
  RUN_TEST(test_nvs_storage_v4_roundtrip_and_v3_migration);
  RUN_TEST(test_analog_input_polling_and_rule_engine_automation);
  RUN_TEST(test_mqtt_binary_parsers_analog_input_opcodes);
  RUN_TEST(test_websocket_parsers_analog_input_commands);
  RUN_TEST(test_gpio_adc_lut_async_burst_and_xtensa_dsp);
  return UNITY_END();
}
