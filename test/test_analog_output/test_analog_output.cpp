#include <Arduino.h>
#include <unity.h>

#include <AchaemenidConfigProtocol.h>
#include <AppEvents.h>
#include <ConfigApplier.h>
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
    std::vector<std::string> segmentRemoves;
    std::vector<SegmentUpdateRuleRequestEvent> ruleUpdates;
    std::vector<CloudSyncRequestEvent> cloudSyncs;
    int stateSyncRequests = 0;
    int configLoadedCount = 0;
    int lastConfigPinCount = 0;

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
        } else if (event_hash == uniuno::kEventHash<SegmentRemoveRequestEvent>) {
            auto* e = static_cast<SegmentRemoveRequestEvent*>(event);
            segmentRemoves.push_back(e->id ? e->id : "");
        } else if (event_hash == uniuno::kEventHash<SegmentUpdateRuleRequestEvent>) {
            ruleUpdates.push_back(*static_cast<SegmentUpdateRuleRequestEvent*>(event));
        } else if (event_hash == uniuno::kEventHash<CloudSyncRequestEvent>) {
            cloudSyncs.push_back(*static_cast<CloudSyncRequestEvent*>(event));
        } else if (event_hash == uniuno::kEventHash<StateSyncRequestEvent>) {
            stateSyncRequests++;
        } else if (event_hash == uniuno::kEventHash<ConfigLoadedEvent>) {
            auto* e = static_cast<ConfigLoadedEvent*>(event);
            configLoadedCount++;
            lastConfigPinCount = e->pinCount;
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

void pushI32LE(std::vector<uint8_t>& buf, int32_t v) {
    const uint32_t u = static_cast<uint32_t>(v);
    buf.push_back(static_cast<uint8_t>(u & 0xFF));
    buf.push_back(static_cast<uint8_t>((u >> 8) & 0xFF));
    buf.push_back(static_cast<uint8_t>((u >> 16) & 0xFF));
    buf.push_back(static_cast<uint8_t>((u >> 24) & 0xFF));
}

void pushCString(std::vector<uint8_t>& buf, const char* s) {
    while (*s) {
        buf.push_back(static_cast<uint8_t>(*s++));
    }
    buf.push_back(0x00);
}

} // namespace

void setUp() {
    mockHw().reset();
    Preferences::resetAll();
}

void tearDown() {}

void test_gpio_pwm_pin_validation_and_normalization() {
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(-1));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(6));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(11));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(34));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(35));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(36));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(39));
    TEST_ASSERT_FALSE(GpioPwm::isValidPwmPin(40));

    TEST_ASSERT_TRUE(GpioPwm::isValidPwmPin(2));
    TEST_ASSERT_TRUE(GpioPwm::isValidPwmPin(18));
    TEST_ASSERT_TRUE(GpioPwm::isValidPwmPin(33));

    TEST_ASSERT_EQUAL_UINT8(8, GpioPwm::normalizeResolution(4));
    TEST_ASSERT_EQUAL_UINT8(10, GpioPwm::normalizeResolution(10));
    TEST_ASSERT_EQUAL_UINT8(12, GpioPwm::normalizeResolution(16));

    TEST_ASSERT_EQUAL_UINT16(100, GpioPwm::normalizeFrequency(10));
    TEST_ASSERT_EQUAL_UINT16(5000, GpioPwm::normalizeFrequency(5000));
    TEST_ASSERT_EQUAL_UINT16(40000, GpioPwm::normalizeFrequency(90000));
}

void test_gpio_pwm_driver_lifecycle_and_state_memory() {
    GpioPwm pwm(18, 12, 10000, true);
    TEST_ASSERT_TRUE(pwm.begin());
    TEST_ASSERT_TRUE(pwm.isAttached());
    TEST_ASSERT_EQUAL_UINT16(4095, pwm.getMaxDuty());
    TEST_ASSERT_EQUAL_UINT16(0, pwm.getValue());
    TEST_ASSERT_EQUAL_UINT16(4095, pwm.getLastNonZeroValue());
    TEST_ASSERT_TRUE(mockHw().ledcPins[18].attached);
    TEST_ASSERT_EQUAL_UINT32(0, mockHw().ledcPins[18].duty);

#if defined(UNIUNO_TEST_ESP32_CORE_V3)
    TEST_ASSERT_EQUAL_INT(1, mockHw().ledcAttachCalls);
    TEST_ASSERT_EQUAL_INT(0, mockHw().ledcSetupCalls);
    TEST_ASSERT_EQUAL_INT8(-1, pwm.getChannel());
#else
    TEST_ASSERT_EQUAL_INT(1, mockHw().ledcSetupCalls);
    TEST_ASSERT_EQUAL_INT(1, mockHw().ledcAttachPinCalls);
    TEST_ASSERT_GREATER_OR_EQUAL_INT8(0, pwm.getChannel());
    TEST_ASSERT_TRUE(GpioPwm::getAllocatedChannelMask() != 0);
#endif

    // Set mid duty cycle & clamp above max
    pwm.setValue(2048);
    TEST_ASSERT_EQUAL_UINT16(2048, pwm.getValue());
    TEST_ASSERT_TRUE(pwm.getState());
    TEST_ASSERT_EQUAL_UINT32(2048, mockHw().ledcPins[18].duty);

    pwm.setValue(9999);
    TEST_ASSERT_EQUAL_UINT16(4095, pwm.getValue());
    TEST_ASSERT_EQUAL_UINT32(4095, mockHw().ledcPins[18].duty);

    // OFF then ON restores last non-zero duty (set 1234 -> off -> on -> 1234)
    pwm.setValue(1234);
    pwm.setState(false);
    TEST_ASSERT_FALSE(pwm.getState());
    TEST_ASSERT_EQUAL_UINT16(0, pwm.getValue());
    TEST_ASSERT_EQUAL_UINT16(1234, pwm.getLastNonZeroValue());
    TEST_ASSERT_EQUAL_UINT32(0, mockHw().ledcPins[18].duty);

    pwm.setState(true);
    TEST_ASSERT_TRUE(pwm.getState());
    TEST_ASSERT_EQUAL_UINT16(1234, pwm.getValue());
    TEST_ASSERT_EQUAL_UINT32(1234, mockHw().ledcPins[18].duty);

    pwm.end();
    TEST_ASSERT_FALSE(pwm.isAttached());
    TEST_ASSERT_FALSE(mockHw().ledcPins[18].attached);
#if !defined(UNIUNO_TEST_ESP32_CORE_V3)
    TEST_ASSERT_EQUAL_UINT16(0, GpioPwm::getAllocatedChannelMask());
#endif
}

void test_gpio_pwm_active_low_inversion() {
    GpioPwm pwm(19, 8, 5000, false);
    TEST_ASSERT_TRUE(pwm.begin());
    TEST_ASSERT_EQUAL_UINT32(255, mockHw().ledcPins[19].duty);

    pwm.setValue(64);
    TEST_ASSERT_EQUAL_UINT16(64, pwm.getValue());
    TEST_ASSERT_EQUAL_UINT32(191, mockHw().ledcPins[19].duty);

    pwm.end();
}

void test_config_protocol_and_applier_analog_output() {
    const char* cfg =
        "ESP_CFG_V2\n"
        "C n=2\n"
        "S id=dimmer1 type=analog_output pin=18 res=12 freq=10000 val=1500 ao=30\n"
        "S id=btn1 type=input pin=4\n"
        "RH tgt=18 hld=0 atp=0 dly=0 aval=3000\n"
        "RL tgt=18 hld=0 atp=1 dly=5 aval=0\n";

    uniuno::AchaemenidConfigProtocol parser;
    ParseResult parsed;
    TEST_ASSERT_TRUE(parser.parse(cfg, parsed));
    TEST_ASSERT_TRUE(parsed.success);
    TEST_ASSERT_EQUAL_INT(2, parsed.count);

    TEST_ASSERT_EQUAL_STRING("analog_output", parsed.segments[0].type);
    TEST_ASSERT_EQUAL_INT(18, parsed.segments[0].pin);
    TEST_ASSERT_EQUAL_UINT8(12, parsed.segments[0].pwmResolution);
    TEST_ASSERT_EQUAL_UINT16(10000, parsed.segments[0].pwmFrequency);
    TEST_ASSERT_EQUAL_UINT16(1500, parsed.segments[0].analogValue);
    TEST_ASSERT_TRUE(parsed.segments[0].value);
    TEST_ASSERT_EQUAL_INT(30, parsed.segments[0].autoOffDelay);

    TEST_ASSERT_TRUE(parsed.segments[1].rule.active);
    TEST_ASSERT_EQUAL_INT16(3000, parsed.segments[1].rule.highActions[0].targetValue);
    TEST_ASSERT_EQUAL_INT16(0, parsed.segments[1].rule.lowActions[0].targetValue);

    PinManager pm;
    TEST_ASSERT_EQUAL_INT(2, ConfigApplier::apply(parsed, &pm));
    TEST_ASSERT_TRUE(pm.isAnalogOutputPin(18));
    TEST_ASSERT_EQUAL_INT16(1500, pm.getPinAnalogValue(18));
    TEST_ASSERT_EQUAL_UINT8(12, pm.getPinPwmResolution(18));
    TEST_ASSERT_EQUAL_UINT16(10000, pm.getPinPwmFrequency(18));
    TEST_ASSERT_EQUAL_UINT32(1500, mockHw().ledcPins[18].duty);

    // Invalid flash / input-only pin rejected
    TEST_ASSERT_FALSE(pm.addSegment("bad_flash", SegmentType::AnalogOutput, 6));
    TEST_ASSERT_FALSE(pm.addSegment("bad_input_only", SegmentType::AnalogOutput, 34));

    // Export state JSON includes values & resolutions
    const String json = pm.exportStateJson();
    TEST_ASSERT_TRUE(json.indexOf("\"values\":{\"18\":1500}") >= 0);
    TEST_ASSERT_TRUE(json.indexOf("\"resolutions\":{\"18\":12}") >= 0);

    pm.removeSegment("dimmer1");
    pm.removeSegment("btn1");
}

void test_nvs_storage_v3_roundtrip_and_v2_migration() {
    uniuno::NvsSegmentStorage storage;

    // Seed a legacy v2 bank A manually via Preferences mock
    {
        #pragma pack(push, 1)
        struct StoredRuleActionV2 {
            int32_t requiredHoldTime;
            int8_t targetPin;
            uint8_t actionState;
            uint8_t actionType;
            int32_t delay;
        };
        struct StoredSegmentV2 {
            char id[32];
            char type[16];
            int16_t pin;
            uint16_t autoOffDelay;
            uint8_t highActionCount;
            uint8_t lowActionCount;
            uint8_t ruleActive;
            StoredRuleActionV2 highActions[4];
            StoredRuleActionV2 lowActions[4];
        };
        #pragma pack(pop)

        StoredSegmentV2 v2{};
        strlcpy(v2.id, "legacy_btn", sizeof(v2.id));
        strlcpy(v2.type, "input", sizeof(v2.type));
        v2.pin = 5;
        v2.autoOffDelay = 0;
        v2.highActionCount = 1;
        v2.lowActionCount = 0;
        v2.ruleActive = 1;
        v2.highActions[0] = {0, 18, 1, 0, 0};

        Preferences prefs;
        prefs.begin("AchaemenidSeg", false);
        prefs.putString("active", "a");
        prefs.putUChar("aVer", 2);
        prefs.putInt("aCount", 1);
        prefs.putBytes("a0", &v2, sizeof(v2));
        prefs.end();
    }

    ParseResult migrated;
    TEST_ASSERT_TRUE(storage.loadSegmentConfig(migrated));
    TEST_ASSERT_EQUAL_INT(1, migrated.count);
    TEST_ASSERT_EQUAL_STRING("legacy_btn", migrated.segments[0].id);
    TEST_ASSERT_EQUAL_UINT8(DEFAULT_PWM_RESOLUTION, migrated.segments[0].pwmResolution);
    TEST_ASSERT_EQUAL_UINT16(DEFAULT_PWM_FREQUENCY, migrated.segments[0].pwmFrequency);
    TEST_ASSERT_EQUAL_INT16(RULE_ANALOG_VALUE_UNSET, migrated.segments[0].rule.highActions[0].targetValue);

    // Save v3 with analog_output + analog rule targetValue
    ParseResult v3In;
    v3In.success = true;
    v3In.segmentsProvided = true;
    v3In.count = 2;

    v3In.segments[0].valid = true;
    strlcpy(v3In.segments[0].id, "pwm_a", sizeof(v3In.segments[0].id));
    strlcpy(v3In.segments[0].type, "analog_output", sizeof(v3In.segments[0].type));
    v3In.segments[0].pin = 25;
    v3In.segments[0].pwmResolution = 10;
    v3In.segments[0].pwmFrequency = 12000;
    v3In.segments[0].autoOffDelay = 45;

    v3In.segments[1].valid = true;
    strlcpy(v3In.segments[1].id, "sw_in", sizeof(v3In.segments[1].id));
    strlcpy(v3In.segments[1].type, "input", sizeof(v3In.segments[1].type));
    v3In.segments[1].pin = 4;
    v3In.segments[1].rule.active = true;
    v3In.segments[1].rule.highActionCount = 1;
    v3In.segments[1].rule.highActions[0].targetPin = 25;
    v3In.segments[1].rule.highActions[0].targetValue = 777;
    v3In.segments[1].rule.highActions[0].actionState = true;

    storage.saveSegmentConfig(v3In);

    ParseResult v3Out;
    TEST_ASSERT_TRUE(storage.loadSegmentConfig(v3Out));
    TEST_ASSERT_EQUAL_INT(2, v3Out.count);
    TEST_ASSERT_EQUAL_STRING("analog_output", v3Out.segments[0].type);
    TEST_ASSERT_EQUAL_UINT8(10, v3Out.segments[0].pwmResolution);
    TEST_ASSERT_EQUAL_UINT16(12000, v3Out.segments[0].pwmFrequency);
    TEST_ASSERT_EQUAL_INT16(777, v3Out.segments[1].rule.highActions[0].targetValue);
}

void test_mqtt_binary_parsers_analog_opcodes() {
    RecordingEventDispatcher dispatcher;
    uniuno::StateParsers stateParsers;
    uniuno::SegmentParsers segmentParsers;
    uniuno::RuleParsers ruleParsers;

    // 1. 0x0A 8-byte frame: [0x0A][pin=18][val=2048 LE][timer=15 LE]
    std::vector<uint8_t> cmd0A = {0x0A, 18};
    pushU16LE(cmd0A, 2048);
    pushI32LE(cmd0A, 15);
    stateParsers.handle(cmd0A.data(), cmd0A.size(), &dispatcher);
    TEST_ASSERT_EQUAL_UINT(1, dispatcher.pinRequests.size());
    TEST_ASSERT_EQUAL_INT(18, dispatcher.pinRequests[0].pin);
    TEST_ASSERT_EQUAL_INT16(2048, dispatcher.pinRequests[0].analogValue);
    TEST_ASSERT_TRUE(dispatcher.pinRequests[0].state);
    TEST_ASSERT_EQUAL_INT(15, dispatcher.pinRequests[0].auto_off);

    // 2. 0x0A 4-byte compact frame: [0x0A][pin=18][val=0 LE]
    std::vector<uint8_t> cmd0AShort = {0x0A, 18};
    pushU16LE(cmd0AShort, 0);
    stateParsers.handle(cmd0AShort.data(), cmd0AShort.size(), &dispatcher);
    TEST_ASSERT_EQUAL_UINT(2, dispatcher.pinRequests.size());
    TEST_ASSERT_EQUAL_INT16(0, dispatcher.pinRequests[1].analogValue);
    TEST_ASSERT_FALSE(dispatcher.pinRequests[1].state);
    TEST_ASSERT_EQUAL_INT(-1, dispatcher.pinRequests[1].auto_off);

    // 3. 0x02 extended analog_output segment add: [0x02][pin=25][legacy=0][id\0][type\0][res=12][freq=10000 LE][init=1024 LE]
    std::vector<uint8_t> cmd02 = {0x02, 25, 0};
    pushCString(cmd02, "fan_pwm");
    pushCString(cmd02, "analog_output");
    cmd02.push_back(12);
    pushU16LE(cmd02, 10000);
    pushU16LE(cmd02, 1024);
    segmentParsers.handle(cmd02.data(), cmd02.size(), &dispatcher);
    TEST_ASSERT_EQUAL_UINT(1, dispatcher.segmentAdds.size());
    TEST_ASSERT_EQUAL_STRING("fan_pwm", dispatcher.segmentAdds[0].id);
    TEST_ASSERT_EQUAL_STRING("analog_output", dispatcher.segmentAdds[0].type);
    TEST_ASSERT_EQUAL_INT(25, dispatcher.segmentAdds[0].pin);
    TEST_ASSERT_EQUAL_UINT8(12, dispatcher.segmentAdds[0].pwmResolution);
    TEST_ASSERT_EQUAL_UINT16(10000, dispatcher.segmentAdds[0].pwmFrequency);
    TEST_ASSERT_EQUAL_UINT16(1024, dispatcher.segmentAdds[0].initialValue);

    // 4. 0x0B rule update with 13-byte analog action: [0x0B][in=4][hCount=1][13B action][lCount=0]
    std::vector<uint8_t> cmd0B = {0x0B, 4, 1};
    cmd0B.push_back(25);        // targetPin
    pushI32LE(cmd0B, 0);        // requiredHoldTime
    cmd0B.push_back(1);         // actionState
    cmd0B.push_back(ACTION_FOR_DURATION);
    pushI32LE(cmd0B, 5);        // delay
    pushU16LE(cmd0B, 3333);     // targetValue (int16_t LE)
    cmd0B.push_back(0);         // lowCount = 0
    ruleParsers.handle(cmd0B.data(), cmd0B.size(), &dispatcher);
    TEST_ASSERT_EQUAL_UINT(1, dispatcher.ruleUpdates.size());
    TEST_ASSERT_EQUAL_INT(4, dispatcher.ruleUpdates[0].pin);
    TEST_ASSERT_TRUE(dispatcher.ruleUpdates[0].rule.active);
    TEST_ASSERT_EQUAL_INT16(3333, dispatcher.ruleUpdates[0].rule.highActions[0].targetValue);
    TEST_ASSERT_EQUAL_INT(ACTION_FOR_DURATION, dispatcher.ruleUpdates[0].rule.highActions[0].actionType);
}

void test_rule_engine_analog_actions_and_duration_revert() {
    PinManager pm;
    TEST_ASSERT_TRUE(pm.addSegment("dimmer", SegmentType::AnalogOutput, 18, 0, RuleConfig(), 12, 5000));
    TEST_ASSERT_TRUE(pm.addSegment("button", SegmentType::Input, 4));

    uniuno::EventDispatcher realBus;
    static std::vector<PinStateChangedEvent> recordedChanges;
    recordedChanges.clear();
    realBus.on<PinStateChangedEvent>([](PinStateChangedEvent* e) {
        if (e) recordedChanges.push_back(*e);
    });

    uniuno::Timer timer(uniuno::TimerFeatures(), millis, &realBus);
    bool dashboardOnline = false;
    RuleContext ctx{nullptr, &timer, nullptr, &realBus, &pm, &dashboardOnline};
    RuleEngine engine(ctx);

    RuleConfig rule;
    rule.active = true;
    rule.highActionCount = 1;
    rule.highActions[0].targetPin = 18;
    rule.highActions[0].requiredHoldTime = 0;
    rule.highActions[0].actionType = ACTION_FOR_DURATION;
    rule.highActions[0].delay = 2; // 2s duration -> applies 2500 immediately then reverts to 0
    rule.highActions[0].targetValue = 2500;
    rule.highActions[0].actionState = true;

    engine.handleInput(4, true, 0, rule);
    TEST_ASSERT_EQUAL_INT16(2500, pm.getPinAnalogValue(18));
    TEST_ASSERT_EQUAL_UINT32(2500, mockHw().ledcPins[18].duty);
    TEST_ASSERT_EQUAL_UINT(1, recordedChanges.size());
    TEST_ASSERT_EQUAL_INT16(2500, recordedChanges[0].analogValue);
    TEST_ASSERT_EQUAL_UINT8(12, recordedChanges[0].resolution);

    // Advance virtual time past 2000ms and tick timer
    mockHw().fakeMillis += 2100;
    timer.tick();
    TEST_ASSERT_EQUAL_INT16(0, pm.getPinAnalogValue(18));
    TEST_ASSERT_FALSE(pm.getPinState(18));
    TEST_ASSERT_EQUAL_UINT32(0, mockHw().ledcPins[18].duty);
}

void test_websocket_parsers_analog_commands() {
    RecordingEventDispatcher dispatcher;
    uniuno::WsServerParser serverParser(&dispatcher, []() { return String("{\"type\":\"state_sync\"}"); });
    websockets::WebsocketsClient client;

    serverParser.parseMessage(
        String("{\"command\":\"set_analog\",\"pin\":18,\"value\":1800,\"timer\":20}"),
        client
    );
    TEST_ASSERT_EQUAL_UINT(1, dispatcher.pinRequests.size());
    TEST_ASSERT_EQUAL_INT(18, dispatcher.pinRequests[0].pin);
    TEST_ASSERT_EQUAL_INT16(1800, dispatcher.pinRequests[0].analogValue);
    TEST_ASSERT_EQUAL_INT(20, dispatcher.pinRequests[0].auto_off);
    TEST_ASSERT_EQUAL_INT(static_cast<int>(PinStateChangeOrigin::DashboardCommand),
                            static_cast<int>(dispatcher.pinRequests[0].origin));

    uniuno::WsClientParser clientParser(&dispatcher);
    const std::string binFrame = std::string("\x0A\x12", 2) + std::string("\xE8\x03", 2); // pin=18, val=1000 LE
    clientParser.parseMessage(websockets::WebsocketsMessage(binFrame, true));
    TEST_ASSERT_EQUAL_UINT(2, dispatcher.pinRequests.size());
    TEST_ASSERT_EQUAL_INT(18, dispatcher.pinRequests[1].pin);
    TEST_ASSERT_EQUAL_INT16(1000, dispatcher.pinRequests[1].analogValue);
    TEST_ASSERT_EQUAL_INT(static_cast<int>(PinStateChangeOrigin::Cloudflare),
                            static_cast<int>(dispatcher.pinRequests[1].origin));

    clientParser.parseMessage(websockets::WebsocketsMessage(
        "{\"type\":\"state_sync\",\"states\":{\"18\":true},\"values\":{\"18\":2222}}", false));
    TEST_ASSERT_EQUAL_UINT(4, dispatcher.pinRequests.size());
    TEST_ASSERT_EQUAL_INT16(2222, dispatcher.pinRequests[3].analogValue);
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_gpio_pwm_pin_validation_and_normalization);
    RUN_TEST(test_gpio_pwm_driver_lifecycle_and_state_memory);
    RUN_TEST(test_gpio_pwm_active_low_inversion);
    RUN_TEST(test_config_protocol_and_applier_analog_output);
    RUN_TEST(test_nvs_storage_v3_roundtrip_and_v2_migration);
    RUN_TEST(test_mqtt_binary_parsers_analog_opcodes);
    RUN_TEST(test_rule_engine_analog_actions_and_duration_revert);
    RUN_TEST(test_websocket_parsers_analog_commands);
    return UNITY_END();
}
