#include <Arduino.h>
#include <unity.h>

#include <AchaemenidConfigProtocol.h>
#include <AppEvents.h>
#include <ConfigApplier.h>
#include <GpioAdc.h>
#include <GpioPwm.h>
#include <NvsSegmentStorage.h>
#include <Optimization/XtensaAnalogAsm.h>
#include <PinManager.h>
#include <Preferences.h>
#include <RuleEngine.h>
#include <Timer/Timer.h>
#include <parsers/MqttCommandDispatcher.h>
#include <parsers/RuleParsers.h>
#include <parsers/WsClientParser.h>

#include <cstring>
#include <string>
#include <vector>

namespace {

class RecordingEventDispatcher : public uniuno::IEventDispatcher {
public:
  std::vector<SegmentUpdateRuleRequestEvent> ruleUpdates;
  std::vector<PinStateChangedEvent> pinChanges;
  std::vector<CloudSyncRequestEvent> cloudSyncs;

  void dispatchByHash(void* event, uint32_t event_hash) override {
    if (event_hash == uniuno::kEventHash<SegmentUpdateRuleRequestEvent>) {
      ruleUpdates.push_back(*static_cast<SegmentUpdateRuleRequestEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<PinStateChangedEvent>) {
      pinChanges.push_back(*static_cast<PinStateChangedEvent*>(event));
    } else if (event_hash == uniuno::kEventHash<CloudSyncRequestEvent>) {
      cloudSyncs.push_back(*static_cast<CloudSyncRequestEvent*>(event));
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

void pushRangeEntry(std::vector<uint8_t>& buf, uint16_t minVal, uint16_t maxVal, uint16_t hyst, int8_t targetPin,
                    bool actionState, uint8_t actionType, uint8_t triggerMode, uint8_t delaySec, int16_t targetValue) {
  pushU16LE(buf, minVal);
  pushU16LE(buf, maxVal);
  pushU16LE(buf, hyst);
  buf.push_back(static_cast<uint8_t>(targetPin));
  const uint8_t flags =
      static_cast<uint8_t>((actionState ? 0x01U : 0x00U) | ((actionType & 0x03U) << 1) | ((triggerMode & 0x01U) << 3));
  buf.push_back(flags);
  buf.push_back(delaySec);
  pushI16LE(buf, targetValue);
  buf.push_back(0); // reserved
}

// ============================================================================
// 1. Branchless asm_range_eval Boundaries, Hysteresis & Underflow/Overflow
// ============================================================================
void test_asm_range_eval_boundaries_and_hysteresis() {
  using uniuno::xtensa_asm::asm_range_eval;

  // Entering [1000..2000] with hyst=50 (wasInRange = false)
  TEST_ASSERT_FALSE(asm_range_eval(999, 1000, 2000, 50, 4095, false));
  TEST_ASSERT_TRUE(asm_range_eval(1000, 1000, 2000, 50, 4095, false));
  TEST_ASSERT_TRUE(asm_range_eval(1500, 1000, 2000, 50, 4095, false));
  TEST_ASSERT_TRUE(asm_range_eval(2000, 1000, 2000, 50, 4095, false));
  TEST_ASSERT_FALSE(asm_range_eval(2001, 1000, 2000, 50, 4095, false));

  // Staying inside [1000..2000] with hyst=50 (wasInRange = true) -> expanded [950..2050]
  TEST_ASSERT_TRUE(asm_range_eval(950, 1000, 2000, 50, 4095, true));
  TEST_ASSERT_FALSE(asm_range_eval(949, 1000, 2000, 50, 4095, true));
  TEST_ASSERT_TRUE(asm_range_eval(2050, 1000, 2000, 50, 4095, true));
  TEST_ASSERT_FALSE(asm_range_eval(2051, 1000, 2000, 50, 4095, true));

  // Clamping near 0 and maxScale (no unsigned underflow / overflow!)
  TEST_ASSERT_TRUE(asm_range_eval(0, 20, 100, 50, 4095, true));
  TEST_ASSERT_FALSE(asm_range_eval(151, 20, 100, 50, 4095, true));
  TEST_ASSERT_TRUE(asm_range_eval(4095, 4050, 4090, 50, 4095, true));
  TEST_ASSERT_FALSE(asm_range_eval(3999, 4050, 4090, 50, 4095, true));
}

// ============================================================================
// 2. ACP Parser: RR (Multi-Range) + RH/RL Double-Click (hld=-1 / dc / double_click)
// ============================================================================
void test_acp_parses_multi_range_rr_and_double_click() {
  const char* cfg = "ESP_CFG_V2\n"
                    "S id=relay_1 type=output pin=2\n"
                    "S id=fan_pwm type=analog_output pin=18 res=8 freq=5000\n"
                    "S id=btn_wall type=input pin=4\n"
                    "RH tgt=2 hld=0 ast=1 atp=0 dly=0\n"
                    "RH tgt=18 hld=dc aval=200 atp=0 dly=0\n"
                    "RL tgt=2 hld=-1 ast=0 atp=0 dly=0\n"
                    "S id=temp_adc type=analog_input pin=34 res=12 sint=100 delta=50\n"
                    "RR min=0 max=1000 hyst=40 tgt=18 aval=64 trg=enter atp=0 dly=0\n"
                    "RR min=1500 max=2500 hyst=50 tgt=18 aval=160 trg=0 atp=0 dly=0\n"
                    "RR min=3500 max=2800 hyst=30 tgt=2 ast=1 trg=exit atp=1 dly=2\n"
                    "END\n";

  uniuno::AchaemenidConfigProtocol parser;
  ParseResult parsed;
  TEST_ASSERT_TRUE(parser.parse(cfg, parsed));
  TEST_ASSERT_EQUAL_INT(4, parsed.count);

  // Digital button rules (single + double-click on HIGH, double-click on LOW)
  const SegmentConfig& btn = parsed.segments[2];
  TEST_ASSERT_EQUAL_STRING("btn_wall", btn.id);
  TEST_ASSERT_TRUE(btn.rule.active);
  TEST_ASSERT_EQUAL_INT(2, btn.rule.highActionCount);
  TEST_ASSERT_EQUAL_INT(0, btn.rule.highActions[0].requiredHoldTime);
  TEST_ASSERT_EQUAL_INT(RULE_TRIGGER_DOUBLE_CLICK, btn.rule.highActions[1].requiredHoldTime);
  TEST_ASSERT_EQUAL_INT16(200, btn.rule.highActions[1].targetValue);
  TEST_ASSERT_EQUAL_INT(1, btn.rule.lowActionCount);
  TEST_ASSERT_EQUAL_INT(RULE_TRIGGER_DOUBLE_CLICK, btn.rule.lowActions[0].requiredHoldTime);

  // Analog multi-range rules
  const SegmentConfig& adc = parsed.segments[3];
  TEST_ASSERT_EQUAL_STRING("temp_adc", adc.id);
  TEST_ASSERT_TRUE(adc.rule.active);
  TEST_ASSERT_EQUAL_UINT8(3, adc.rule.analogRangeCount);

  TEST_ASSERT_EQUAL_UINT16(0, adc.rule.analogRanges[0].minValue);
  TEST_ASSERT_EQUAL_UINT16(1000, adc.rule.analogRanges[0].maxValue);
  TEST_ASSERT_EQUAL_UINT16(40, adc.rule.analogRanges[0].hysteresis);
  TEST_ASSERT_EQUAL_INT8(18, adc.rule.analogRanges[0].targetPin);
  TEST_ASSERT_EQUAL_INT16(64, adc.rule.analogRanges[0].targetValue);
  TEST_ASSERT_EQUAL_UINT8(RANGE_ON_ENTER, adc.rule.analogRanges[0].triggerMode);

  TEST_ASSERT_EQUAL_UINT16(1500, adc.rule.analogRanges[1].minValue);
  TEST_ASSERT_EQUAL_UINT16(2500, adc.rule.analogRanges[1].maxValue);
  TEST_ASSERT_EQUAL_INT16(160, adc.rule.analogRanges[1].targetValue);

  // Swapped min=3500 max=2800 MUST auto-normalize to [2800..3500]
  TEST_ASSERT_EQUAL_UINT16(2800, adc.rule.analogRanges[2].minValue);
  TEST_ASSERT_EQUAL_UINT16(3500, adc.rule.analogRanges[2].maxValue);
  TEST_ASSERT_EQUAL_UINT8(RANGE_ON_EXIT, adc.rule.analogRanges[2].triggerMode);
  TEST_ASSERT_EQUAL_UINT8(ACTION_AFTER_DELAY, adc.rule.analogRanges[2].actionType);
  TEST_ASSERT_EQUAL_UINT8(2, adc.rule.analogRanges[2].delay);
}

// ============================================================================
// 3. Multi-Range Analog Rule Engine: Independent Zones, Boot Baseline & Hysteresis
// ============================================================================
void test_analog_multi_range_independent_zones_and_hysteresis() {
  // Boot ADC reading starts inside Zone 0 [0..1000] -> must NOT false-trigger at boot
  mockHw().analogValues[34] = 500;

  PinManager pm;
  uniuno::EventDispatcher bus;
  uniuno::Timer timer(uniuno::TimerFeatures(), millis, &bus);
  bool dashboardOnline = true;

  TEST_ASSERT_TRUE(pm.addSegment("fan_pwm", SegmentType::AnalogOutput, 18, 0, RuleConfig(), 8, 5000));
  TEST_ASSERT_TRUE(pm.addSegment("alarm_relay", SegmentType::Output, 2));

  RuleConfig rangeRule;
  rangeRule.active = true;
  rangeRule.analogRangeCount = 3;

  // Range 0: [0..1000] hyst=50 -> PWM 60
  rangeRule.analogRanges[0].minValue = 0;
  rangeRule.analogRanges[0].maxValue = 1000;
  rangeRule.analogRanges[0].hysteresis = 50;
  rangeRule.analogRanges[0].targetPin = 18;
  rangeRule.analogRanges[0].targetValue = 60;
  rangeRule.analogRanges[0].actionState = true;
  rangeRule.analogRanges[0].triggerMode = RANGE_ON_ENTER;
  rangeRule.analogRanges[0].enabled = true;

  // Range 1: [1500..2500] hyst=50 -> PWM 150
  rangeRule.analogRanges[1].minValue = 1500;
  rangeRule.analogRanges[1].maxValue = 2500;
  rangeRule.analogRanges[1].hysteresis = 50;
  rangeRule.analogRanges[1].targetPin = 18;
  rangeRule.analogRanges[1].targetValue = 150;
  rangeRule.analogRanges[1].actionState = true;
  rangeRule.analogRanges[1].triggerMode = RANGE_ON_ENTER;
  rangeRule.analogRanges[1].enabled = true;

  // Range 2: [3000..4095] hyst=60 -> digital alarm ON
  rangeRule.analogRanges[2].minValue = 3000;
  rangeRule.analogRanges[2].maxValue = 4095;
  rangeRule.analogRanges[2].hysteresis = 60;
  rangeRule.analogRanges[2].targetPin = 2;
  rangeRule.analogRanges[2].targetValue = RULE_ANALOG_VALUE_UNSET;
  rangeRule.analogRanges[2].actionState = true;
  rangeRule.analogRanges[2].triggerMode = RANGE_ON_ENTER;
  rangeRule.analogRanges[2].enabled = true;

  // Large deltaThreshold (500) proves range crossing fires EVEN when delta isn't met!
  TEST_ASSERT_TRUE(pm.addSegment("sensor_temp", SegmentType::AnalogInput, 34, 0, rangeRule, DEFAULT_PWM_RESOLUTION,
                                 DEFAULT_PWM_FREQUENCY, 12, 100, 500, 0, 0));

  // Boot mask should already mark bit 0 active (500 is inside [0..1000])
  TEST_ASSERT_EQUAL_UINT8(0x01, pm.getAnalogRangeMaskByPin(34));
  TEST_ASSERT_EQUAL_INT16(0, pm.getPinAnalogValue(18)); // Did NOT false-trigger at boot

  RuleContext ctx{nullptr, &timer, nullptr, &bus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);

  auto onAnalog = [&](const AnalogInputChange& ch, const RuleConfig& r) {
    if (ch.rangeMaskChanged) {
      engine.handleAnalogInput(ch, r);
    }
  };

  auto sampleAdc = [&](int pin, int rawVal, int steps = 10) {
    mockHw().analogValues[pin] = rawVal;
    for (int s = 0; s < steps; ++s) {
      mockHw().fakeMillis += 100;
      pm.processAnalogInputs(onAnalog);
    }
  };

  // Move to 1040 (within hysteresis 1000+50=1050) -> still in Range 0, no transition
  sampleAdc(34, 1040);
  TEST_ASSERT_EQUAL_UINT8(0x01, pm.getAnalogRangeMaskByPin(34));
  TEST_ASSERT_EQUAL_INT16(0, pm.getPinAnalogValue(18));

  // Move to 1060 -> exits Range 0 cleanly (mask becomes 0)
  sampleAdc(34, 1060);
  TEST_ASSERT_EQUAL_UINT8(0x00, pm.getAnalogRangeMaskByPin(34));

  // Move to 1500 -> enters Range 1 -> sets PWM to 150
  sampleAdc(34, 1500);
  TEST_ASSERT_EQUAL_UINT8(0x02, pm.getAnalogRangeMaskByPin(34));
  TEST_ASSERT_EQUAL_INT16(150, pm.getPinAnalogValue(18));
  TEST_ASSERT_FALSE(pm.getPinState(2));

  // Small step from 2900 -> 3010 (step=110 < deltaThreshold=500!) MUST STILL trigger Range 2!
  sampleAdc(34, 2900);
  TEST_ASSERT_EQUAL_UINT8(0x00, pm.getAnalogRangeMaskByPin(34));

  sampleAdc(34, 3010);
  TEST_ASSERT_EQUAL_UINT8(0x04, pm.getAnalogRangeMaskByPin(34));
  TEST_ASSERT_TRUE(pm.getPinState(2));

  // Drop back into Range 0 [0..1000] -> sets PWM to 60
  sampleAdc(34, 800);
  TEST_ASSERT_EQUAL_UINT8(0x01, pm.getAnalogRangeMaskByPin(34));
  TEST_ASSERT_EQUAL_INT16(60, pm.getPinAnalogValue(18));
}

// ============================================================================
// 4. Overlapping Ranges, RANGE_ON_EXIT & Delayed / For-Duration Actions
// ============================================================================
void test_analog_range_overlapping_and_on_exit_trigger() {
  mockHw().analogValues[35] = 200;

  PinManager pm;
  uniuno::EventDispatcher bus;
  uniuno::Timer timer(uniuno::TimerFeatures(), millis, &bus);
  bool dashboardOnline = true;

  TEST_ASSERT_TRUE(pm.addSegment("led_a", SegmentType::Output, 2));
  TEST_ASSERT_TRUE(pm.addSegment("led_b", SegmentType::Output, 4));

  RuleConfig rule;
  rule.active = true;
  rule.analogRangeCount = 2;

  // Range 0: [1000..3000] ON_ENTER -> led_a ON for 2 seconds (ACTION_FOR_DURATION)
  rule.analogRanges[0].minValue = 1000;
  rule.analogRanges[0].maxValue = 3000;
  rule.analogRanges[0].hysteresis = 20;
  rule.analogRanges[0].targetPin = 2;
  rule.analogRanges[0].actionState = true;
  rule.analogRanges[0].actionType = ACTION_FOR_DURATION;
  rule.analogRanges[0].delay = 2;
  rule.analogRanges[0].triggerMode = RANGE_ON_ENTER;
  rule.analogRanges[0].enabled = true;

  // Range 1: [2000..4000] ON_EXIT -> led_b ON immediately
  rule.analogRanges[1].minValue = 2000;
  rule.analogRanges[1].maxValue = 4000;
  rule.analogRanges[1].hysteresis = 20;
  rule.analogRanges[1].targetPin = 4;
  rule.analogRanges[1].actionState = true;
  rule.analogRanges[1].actionType = ACTION_IMMEDIATE;
  rule.analogRanges[1].delay = 0;
  rule.analogRanges[1].triggerMode = RANGE_ON_EXIT;
  rule.analogRanges[1].enabled = true;

  TEST_ASSERT_TRUE(pm.addSegment("ldr_2", SegmentType::AnalogInput, 35, 0, rule, DEFAULT_PWM_RESOLUTION,
                                 DEFAULT_PWM_FREQUENCY, 12, 100, 10, 0, 0));

  RuleContext ctx{nullptr, &timer, nullptr, &bus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);
  auto onAnalog = [&](const AnalogInputChange& ch, const RuleConfig& r) {
    if (ch.rangeMaskChanged) engine.handleAnalogInput(ch, r);
  };

  auto sampleAdc = [&](int pin, int rawVal, int steps = 10) {
    mockHw().analogValues[pin] = rawVal;
    for (int s = 0; s < steps; ++s) {
      mockHw().fakeMillis += 100;
      pm.processAnalogInputs(onAnalog);
    }
  };

  // Jump to 2500 -> enters BOTH Range 0 and Range 1; only Range 0 (ON_ENTER) fires led_a ON
  sampleAdc(35, 2500, 6);
  TEST_ASSERT_EQUAL_UINT8(0x03, pm.getAnalogRangeMaskByPin(35));
  TEST_ASSERT_TRUE(pm.getPinState(2));
  TEST_ASSERT_FALSE(pm.getPinState(4));

  // Wait 2000ms -> ACTION_FOR_DURATION reverts led_a to OFF
  mockHw().fakeMillis += 2000;
  timer.tick();
  TEST_ASSERT_FALSE(pm.getPinState(2));

  // Drop to 1500 -> exits Range 1 (still in Range 0) -> Range 1 ON_EXIT fires led_b ON!
  sampleAdc(35, 1500, 10);
  TEST_ASSERT_EQUAL_UINT8(0x01, pm.getAnalogRangeMaskByPin(35));
  TEST_ASSERT_TRUE(pm.getPinState(4));
}

// ============================================================================
// 5. Digital Double-Click: Standalone & Window Timeout
// ============================================================================
void test_digital_double_click_standalone_and_timeout() {
  PinManager pm;
  uniuno::EventDispatcher bus;
  uniuno::Timer timer(uniuno::TimerFeatures(), millis, &bus);
  bool dashboardOnline = true;

  TEST_ASSERT_TRUE(pm.addSegment("lamp", SegmentType::Output, 2));

  RuleConfig rule;
  rule.active = true;
  rule.highActionCount = 1;
  rule.highActions[0].targetPin = 2;
  rule.highActions[0].requiredHoldTime = RULE_TRIGGER_DOUBLE_CLICK;
  rule.highActions[0].actionState = true;
  rule.highActions[0].actionType = ACTION_IMMEDIATE;
  rule.highActions[0].delay = 0;

  TEST_ASSERT_TRUE(pm.addSegment("btn", SegmentType::Input, 4, 0, rule));
  RuleContext ctx{nullptr, &timer, nullptr, &bus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);

  // Single tap: press + release, then wait 450ms -> lamp stays OFF
  engine.handleInput(4, true, 0, rule);
  mockHw().fakeMillis += 80;
  engine.handleInput(4, false, 0, rule);
  TEST_ASSERT_FALSE(pm.getPinState(2));

  mockHw().fakeMillis += 450;
  timer.tick();
  TEST_ASSERT_FALSE(pm.getPinState(2));
  TEST_ASSERT_EQUAL_UINT8(0, pm.getClickCountByPin(4));

  // Double tap within 400ms: press1 -> release1 (80ms) -> press2 (150ms later) -> lamp turns ON!
  engine.handleInput(4, true, 0, rule);
  mockHw().fakeMillis += 80;
  engine.handleInput(4, false, 0, rule);
  TEST_ASSERT_FALSE(pm.getPinState(2));

  mockHw().fakeMillis += 150;
  engine.handleInput(4, true, 0, rule);
  TEST_ASSERT_TRUE(pm.getPinState(2));

  // Release of 2nd tap must NOT re-arm clickCount
  mockHw().fakeMillis += 80;
  engine.handleInput(4, false, 0, rule);
  TEST_ASSERT_EQUAL_UINT8(0, pm.getClickCountByPin(4));
}

// ============================================================================
// 6. Digital Double-Click + Single-Click Coexistence (Disambiguation)
// ============================================================================
void test_digital_double_click_coexists_with_single_click() {
  PinManager pm;
  uniuno::EventDispatcher bus;
  uniuno::Timer timer(uniuno::TimerFeatures(), millis, &bus);
  bool dashboardOnline = true;

  TEST_ASSERT_TRUE(pm.addSegment("lamp_single", SegmentType::Output, 2));
  TEST_ASSERT_TRUE(pm.addSegment("lamp_double", SegmentType::Output, 5));

  RuleConfig rule;
  rule.active = true;
  rule.highActionCount = 2;
  // Action 0: single-click -> lamp_single ON
  rule.highActions[0].targetPin = 2;
  rule.highActions[0].requiredHoldTime = 0;
  rule.highActions[0].actionState = true;
  rule.highActions[0].actionType = ACTION_IMMEDIATE;
  // Action 1: double-click -> lamp_double ON
  rule.highActions[1].targetPin = 5;
  rule.highActions[1].requiredHoldTime = RULE_TRIGGER_DOUBLE_CLICK;
  rule.highActions[1].actionState = true;
  rule.highActions[1].actionType = ACTION_IMMEDIATE;

  TEST_ASSERT_TRUE(pm.addSegment("btn", SegmentType::Input, 4, 0, rule));
  RuleContext ctx{nullptr, &timer, nullptr, &bus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);

  // Case A: Single quick tap -> deferred during 400ms window, then fires lamp_single ONLY
  engine.handleInput(4, true, 0, rule);
  TEST_ASSERT_FALSE(pm.getPinState(2)); // Deferred!
  mockHw().fakeMillis += 70;
  engine.handleInput(4, false, 0, rule);
  TEST_ASSERT_FALSE(pm.getPinState(2));

  mockHw().fakeMillis += DEFAULT_DOUBLE_CLICK_WINDOW_MS;
  timer.tick();
  TEST_ASSERT_TRUE(pm.getPinState(2));
  TEST_ASSERT_FALSE(pm.getPinState(5));

  // Reset outputs
  pm.setPinState(2, false);
  pm.setPinState(5, false);

  // Case B: Double quick tap -> cancels deferred single-click, fires lamp_double ONLY!
  engine.handleInput(4, true, 0, rule);
  mockHw().fakeMillis += 60;
  engine.handleInput(4, false, 0, rule);
  mockHw().fakeMillis += 120;
  engine.handleInput(4, true, 0, rule);
  mockHw().fakeMillis += 60;
  engine.handleInput(4, false, 0, rule);

  // Even after waiting past the 400ms window, single-click MUST NOT fire
  mockHw().fakeMillis += 500;
  timer.tick();
  TEST_ASSERT_FALSE(pm.getPinState(2));
  TEST_ASSERT_TRUE(pm.getPinState(5));
}

// ============================================================================
// 7. Digital Double-Click + Hold-Time (3s) Coexistence & Zero-Latency Single Click
// ============================================================================
void test_digital_double_click_coexists_with_hold_time_and_zero_latency_single() {
  PinManager pm;
  uniuno::EventDispatcher bus;
  uniuno::Timer timer(uniuno::TimerFeatures(), millis, &bus);
  bool dashboardOnline = true;

  TEST_ASSERT_TRUE(pm.addSegment("out_dc", SegmentType::Output, 2));
  TEST_ASSERT_TRUE(pm.addSegment("out_hold", SegmentType::Output, 5));
  TEST_ASSERT_TRUE(pm.addSegment("out_fast", SegmentType::Output, 16));

  // Button 1: double-click + 3s hold
  RuleConfig comboRule;
  comboRule.active = true;
  comboRule.highActionCount = 2;
  comboRule.highActions[0].targetPin = 2;
  comboRule.highActions[0].requiredHoldTime = RULE_TRIGGER_DOUBLE_CLICK;
  comboRule.highActions[0].actionState = true;
  comboRule.highActions[0].actionType = ACTION_IMMEDIATE;
  comboRule.highActions[1].targetPin = 5;
  comboRule.highActions[1].requiredHoldTime = 3;
  comboRule.highActions[1].actionState = true;
  comboRule.highActions[1].actionType = ACTION_IMMEDIATE;
  TEST_ASSERT_TRUE(pm.addSegment("btn_combo", SegmentType::Input, 4, 0, comboRule));

  // Button 2: single-click ONLY (no double-click -> MUST fire immediately with 0ms latency)
  RuleConfig fastRule;
  fastRule.active = true;
  fastRule.highActionCount = 1;
  fastRule.highActions[0].targetPin = 16;
  fastRule.highActions[0].requiredHoldTime = 0;
  fastRule.highActions[0].actionState = true;
  fastRule.highActions[0].actionType = ACTION_IMMEDIATE;
  TEST_ASSERT_TRUE(pm.addSegment("btn_fast", SegmentType::Input, 17, 0, fastRule));

  RuleContext ctx{nullptr, &timer, nullptr, &bus, &pm, &dashboardOnline};
  RuleEngine engine(ctx);

  // Hold Button 1 for 3 seconds -> fires out_hold, NOT out_dc
  engine.handleInput(4, true, 0, comboRule);
  mockHw().fakeMillis += 3100;
  engine.handleInput(4, false, 3, comboRule);
  TEST_ASSERT_TRUE(pm.getPinState(5));
  TEST_ASSERT_FALSE(pm.getPinState(2));
  TEST_ASSERT_EQUAL_UINT8(0, pm.getClickCountByPin(4));

  // Press Button 2 -> fires out_fast IMMEDIATELY on press (zero latency)
  engine.handleInput(17, true, 0, fastRule);
  TEST_ASSERT_TRUE(pm.getPinState(16));
}

// ============================================================================
// 8. NVS v5 Round-Trip (Multi-Range + Double-Click) & v4 -> v5 Migration
// ============================================================================
void test_nvs_v5_roundtrip_and_v4_migration() {
  Preferences::resetAll();
  PinManager pm;

  RuleConfig btnRule;
  btnRule.active = true;
  btnRule.highActionCount = 2;
  btnRule.highActions[0].targetPin = 2;
  btnRule.highActions[0].requiredHoldTime = 0;
  btnRule.highActions[0].actionState = true;
  btnRule.highActions[1].targetPin = 18;
  btnRule.highActions[1].requiredHoldTime = RULE_TRIGGER_DOUBLE_CLICK;
  btnRule.highActions[1].actionState = true;
  btnRule.highActions[1].targetValue = 190;

  RuleConfig adcRule;
  adcRule.active = true;
  adcRule.analogRangeCount = 2;
  adcRule.analogRanges[0].minValue = 100;
  adcRule.analogRanges[0].maxValue = 900;
  adcRule.analogRanges[0].hysteresis = 25;
  adcRule.analogRanges[0].targetPin = 18;
  adcRule.analogRanges[0].targetValue = 80;
  adcRule.analogRanges[0].actionState = true;
  adcRule.analogRanges[0].triggerMode = RANGE_ON_ENTER;
  adcRule.analogRanges[0].enabled = true;

  adcRule.analogRanges[1].minValue = 2500;
  adcRule.analogRanges[1].maxValue = 4095;
  adcRule.analogRanges[1].hysteresis = 40;
  adcRule.analogRanges[1].targetPin = 2;
  adcRule.analogRanges[1].targetValue = RULE_ANALOG_VALUE_UNSET;
  adcRule.analogRanges[1].actionState = true;
  adcRule.analogRanges[1].actionType = ACTION_AFTER_DELAY;
  adcRule.analogRanges[1].delay = 5;
  adcRule.analogRanges[1].triggerMode = RANGE_ON_EXIT;
  adcRule.analogRanges[1].enabled = true;

  TEST_ASSERT_TRUE(pm.addSegment("relay_1", SegmentType::Output, 2));
  TEST_ASSERT_TRUE(pm.addSegment("pwm_1", SegmentType::AnalogOutput, 18, 0, RuleConfig(), 8, 5000));
  TEST_ASSERT_TRUE(pm.addSegment("btn_1", SegmentType::Input, 4, 0, btnRule));
  TEST_ASSERT_TRUE(pm.addSegment("adc_1", SegmentType::AnalogInput, 34, 0, adcRule, DEFAULT_PWM_RESOLUTION,
                                 DEFAULT_PWM_FREQUENCY, 12, 200, 30, 0, 0));

  ParseResult exported;
  pm.exportConfig(exported);

  uniuno::NvsSegmentStorage storage;
  storage.saveSegmentConfig(exported);

  ParseResult loaded;
  TEST_ASSERT_TRUE(storage.loadSegmentConfig(loaded));
  TEST_ASSERT_EQUAL_INT(4, loaded.count);

  TEST_ASSERT_EQUAL_STRING("btn_1", loaded.segments[2].id);
  TEST_ASSERT_EQUAL_INT(RULE_TRIGGER_DOUBLE_CLICK, loaded.segments[2].rule.highActions[1].requiredHoldTime);
  TEST_ASSERT_EQUAL_INT16(190, loaded.segments[2].rule.highActions[1].targetValue);

  TEST_ASSERT_EQUAL_STRING("adc_1", loaded.segments[3].id);
  TEST_ASSERT_TRUE(loaded.segments[3].rule.active);
  TEST_ASSERT_EQUAL_UINT8(2, loaded.segments[3].rule.analogRangeCount);
  TEST_ASSERT_EQUAL_UINT16(100, loaded.segments[3].rule.analogRanges[0].minValue);
  TEST_ASSERT_EQUAL_UINT16(900, loaded.segments[3].rule.analogRanges[0].maxValue);
  TEST_ASSERT_EQUAL_UINT16(25, loaded.segments[3].rule.analogRanges[0].hysteresis);
  TEST_ASSERT_EQUAL_INT16(80, loaded.segments[3].rule.analogRanges[0].targetValue);
  TEST_ASSERT_EQUAL_UINT8(RANGE_ON_EXIT, loaded.segments[3].rule.analogRanges[1].triggerMode);
  TEST_ASSERT_EQUAL_UINT8(ACTION_AFTER_DELAY, loaded.segments[3].rule.analogRanges[1].actionType);
  TEST_ASSERT_EQUAL_UINT8(5, loaded.segments[3].rule.analogRanges[1].delay);

  // Seamless backward-compatibility test: load a legacy NVS v4 record
  Preferences::resetAll();
#pragma pack(push, 1)
  struct TestRuleActionV4 {
    int32_t requiredHoldTime;
    int8_t targetPin;
    uint8_t actionState;
    uint8_t actionType;
    int32_t delay;
    int16_t targetValue;
  };
  struct TestSegmentV4 {
    char id[32];
    char type[16];
    int16_t pin;
    uint16_t autoOffDelay;
    uint8_t pwmResolution;
    uint16_t pwmFrequency;
    uint8_t adcResolution;
    uint16_t adcSampleIntervalMs;
    uint16_t adcDeltaThreshold;
    uint16_t adcHighThreshold;
    uint16_t adcLowThreshold;
    uint8_t highActionCount;
    uint8_t lowActionCount;
    uint8_t ruleActive;
    TestRuleActionV4 highActions[4];
    TestRuleActionV4 lowActions[4];
  };
#pragma pack(pop)

  TestSegmentV4 v4Rec{};
  strlcpy(v4Rec.id, "legacy_v4_adc", sizeof(v4Rec.id));
  strlcpy(v4Rec.type, "analog_input", sizeof(v4Rec.type));
  v4Rec.pin = 35;
  v4Rec.pwmResolution = 8;
  v4Rec.pwmFrequency = 5000;
  v4Rec.adcResolution = 12;
  v4Rec.adcSampleIntervalMs = 300;
  v4Rec.adcDeltaThreshold = 45;
  v4Rec.adcHighThreshold = 2500;
  v4Rec.adcLowThreshold = 2000;

  Preferences prefs;
  TEST_ASSERT_TRUE(prefs.begin("AchaemenidSeg", false));
  prefs.putBytes("a0", &v4Rec, sizeof(v4Rec));
  prefs.putInt("aCount", 1);
  prefs.putUChar("aVer", 4);
  prefs.putString("active", "a");
  prefs.end();

  ParseResult migrated;
  TEST_ASSERT_TRUE(storage.loadSegmentConfig(migrated));
  TEST_ASSERT_EQUAL_INT(1, migrated.count);
  TEST_ASSERT_EQUAL_STRING("legacy_v4_adc", migrated.segments[0].id);
  TEST_ASSERT_EQUAL_UINT16(2500, migrated.segments[0].adcHighThreshold);
  TEST_ASSERT_EQUAL_UINT8(0, migrated.segments[0].rule.analogRangeCount);
}

// ============================================================================
// 9. MQTT & WebSocket Binary Parsers: 0x05/0x0B Double-Click & 0x0E Multi-Range
// ============================================================================
void test_mqtt_and_ws_binary_0x0E_and_double_click() {
  RecordingEventDispatcher bus;
  uniuno::MqttCommandDispatcher mqttDisp;
  uniuno::RuleParsers ruleParser;
  mqttDisp.registerHandler(&ruleParser);

  // 1. MQTT 0x0B with Double-Click (holdTime = -1)
  std::vector<uint8_t> dcFrame;
  dcFrame.push_back(0x0B);
  dcFrame.push_back(4);                          // input GPIO4
  dcFrame.push_back(1);                          // 1 HIGH action
  dcFrame.push_back(18);                         // targetPin = 18
  pushI32LE(dcFrame, RULE_TRIGGER_DOUBLE_CLICK); // -1 = double click
  dcFrame.push_back(1);                          // actionState = true
  dcFrame.push_back(0);                          // ACTION_IMMEDIATE
  pushI32LE(dcFrame, 0);                         // delay = 0
  pushI16LE(dcFrame, 175);                       // targetValue = 175
  dcFrame.push_back(0);                          // 0 LOW actions

  mqttDisp.handlePayload(dcFrame.data(), dcFrame.size(), &bus);
  TEST_ASSERT_EQUAL_UINT32(1, bus.ruleUpdates.size());
  TEST_ASSERT_EQUAL_INT(4, bus.ruleUpdates[0].pin);
  TEST_ASSERT_EQUAL_INT(RULE_TRIGGER_DOUBLE_CLICK, bus.ruleUpdates[0].rule.highActions[0].requiredHoldTime);
  TEST_ASSERT_EQUAL_INT16(175, bus.ruleUpdates[0].rule.highActions[0].targetValue);

  // 2. MQTT 0x0E: UPDATE_ANALOG_RANGE_RULES with 2 ranges
  std::vector<uint8_t> rangeFrame;
  rangeFrame.push_back(0x0E);
  rangeFrame.push_back(34); // analog_input GPIO34
  rangeFrame.push_back(2);  // 2 ranges
  pushRangeEntry(rangeFrame, 0, 1200, 30, 18, true, ACTION_IMMEDIATE, RANGE_ON_ENTER, 0, 70);
  pushRangeEntry(rangeFrame, 2800, 4095, 50, 2, true, ACTION_FOR_DURATION, RANGE_ON_EXIT, 4, RULE_ANALOG_VALUE_UNSET);

  mqttDisp.handlePayload(rangeFrame.data(), rangeFrame.size(), &bus);
  TEST_ASSERT_EQUAL_UINT32(2, bus.ruleUpdates.size());
  const RuleConfig& parsedRangeRule = bus.ruleUpdates[1].rule;
  TEST_ASSERT_TRUE(parsedRangeRule.active);
  TEST_ASSERT_EQUAL_UINT8(2, parsedRangeRule.analogRangeCount);
  TEST_ASSERT_EQUAL_UINT16(0, parsedRangeRule.analogRanges[0].minValue);
  TEST_ASSERT_EQUAL_UINT16(1200, parsedRangeRule.analogRanges[0].maxValue);
  TEST_ASSERT_EQUAL_INT16(70, parsedRangeRule.analogRanges[0].targetValue);
  TEST_ASSERT_EQUAL_UINT8(RANGE_ON_EXIT, parsedRangeRule.analogRanges[1].triggerMode);
  TEST_ASSERT_EQUAL_UINT8(ACTION_FOR_DURATION, parsedRangeRule.analogRanges[1].actionType);
  TEST_ASSERT_EQUAL_UINT8(4, parsedRangeRule.analogRanges[1].delay);

  // Truncated 0x0E MUST be rejected
  mqttDisp.handlePayload(rangeFrame.data(), rangeFrame.size() - 1, &bus);
  TEST_ASSERT_EQUAL_UINT32(2, bus.ruleUpdates.size());

  // 3. WebSocket Client Parser 0x0E binary frame
  uniuno::WsClientParser wsParser(&bus);
  std::string wsBin(reinterpret_cast<const char*>(rangeFrame.data()), rangeFrame.size());
  websockets::WebsocketsMessage wsMsg(wsBin, true);
  wsParser.parseMessage(wsMsg);
  TEST_ASSERT_EQUAL_UINT32(3, bus.ruleUpdates.size());
  TEST_ASSERT_EQUAL_INT(34, bus.ruleUpdates[2].pin);
  TEST_ASSERT_EQUAL_UINT8(2, bus.ruleUpdates[2].rule.analogRangeCount);
}

} // namespace

void setUp() {
  mockHw().reset();
  Preferences::resetAll();
}

void tearDown() {}

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;
  UNITY_BEGIN();
  RUN_TEST(test_asm_range_eval_boundaries_and_hysteresis);
  RUN_TEST(test_acp_parses_multi_range_rr_and_double_click);
  RUN_TEST(test_analog_multi_range_independent_zones_and_hysteresis);
  RUN_TEST(test_analog_range_overlapping_and_on_exit_trigger);
  RUN_TEST(test_digital_double_click_standalone_and_timeout);
  RUN_TEST(test_digital_double_click_coexists_with_single_click);
  RUN_TEST(test_digital_double_click_coexists_with_hold_time_and_zero_latency_single);
  RUN_TEST(test_nvs_v5_roundtrip_and_v4_migration);
  RUN_TEST(test_mqtt_and_ws_binary_0x0E_and_double_click);
  return UNITY_END();
}
