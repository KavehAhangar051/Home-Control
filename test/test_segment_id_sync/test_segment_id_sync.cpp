#include <Arduino.h>
#include <unity.h>

#include <AchaemenidConfigProtocol.h>
#include <AppEvents.h>
#include <ConfigApplier.h>
#include <NvsSegmentStorage.h>
#include <PinManager.h>
#include <Preferences.h>
#include <parsers/MqttCommandDispatcher.h>
#include <parsers/SegmentParsers.h>

#include <cstring>
#include <string>
#include <vector>

namespace {

class SegmentEventRecorder : public uniuno::IEventDispatcher {
public:
    std::vector<SegmentAddRequestEvent> adds;
    std::vector<std::string> addIds;
    std::vector<std::string> addTypes;
    std::vector<SegmentRemoveRequestEvent> removes;
    std::vector<std::string> removeIds;

    void dispatchByHash(void* event, uint32_t event_hash) override {
        if (event_hash == uniuno::kEventHash<SegmentAddRequestEvent>) {
            auto* e = static_cast<SegmentAddRequestEvent*>(event);
            addIds.push_back(e->id ? e->id : "");
            addTypes.push_back(e->type ? e->type : "");
            SegmentAddRequestEvent copy = *e;
            copy.id = addIds.back().c_str();
            copy.type = addTypes.back().c_str();
            adds.push_back(copy);
        } else if (event_hash == uniuno::kEventHash<SegmentRemoveRequestEvent>) {
            auto* e = static_cast<SegmentRemoveRequestEvent*>(event);
            removeIds.push_back(e->id ? e->id : "");
            SegmentRemoveRequestEvent copy = *e;
            copy.id = removeIds.back().c_str();
            removes.push_back(copy);
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

void resetHardwareState() {
    mockHw().reset();
    Preferences::resetAll();
}

} // namespace

void setUp() {
    resetHardwareState();
}

void tearDown() {}

// ============================================================================
// 1. Binary DELETE_SEGMENT (0x03) Parser: Legacy & Extended v2 (with pin)
// ============================================================================
void test_mqtt_delete_segment_parser_legacy_and_v2() {
    uniuno::MqttCommandDispatcher dispatcher;
    uniuno::SegmentParsers segParser;
    dispatcher.registerHandler(&segParser);
    SegmentEventRecorder recorder;

    // Legacy frame: [0x03]["jjib4yz"][0x00] (no trailing pin byte)
    const uint8_t legacyFrame[] = {
        0x03, 'j', 'j', 'i', 'b', '4', 'y', 'z', 0x00
    };
    dispatcher.handlePayload(legacyFrame, sizeof(legacyFrame), &recorder);
    TEST_ASSERT_EQUAL_UINT32(1, recorder.removes.size());
    TEST_ASSERT_EQUAL_STRING("jjib4yz", recorder.removeIds[0].c_str());
    TEST_ASSERT_EQUAL_INT(-1, recorder.removes[0].pin);

    // Extended v2 frame: [0x03]["jjib4yz"][0x00][5]
    const uint8_t v2Frame[] = {
        0x03, 'j', 'j', 'i', 'b', '4', 'y', 'z', 0x00, 0x05
    };
    dispatcher.handlePayload(v2Frame, sizeof(v2Frame), &recorder);
    TEST_ASSERT_EQUAL_UINT32(2, recorder.removes.size());
    TEST_ASSERT_EQUAL_STRING("jjib4yz", recorder.removeIds[1].c_str());
    TEST_ASSERT_EQUAL_INT(5, recorder.removes[1].pin);

    // Pin-only v2 frame: [0x03][0x00][14]
    const uint8_t pinOnlyFrame[] = {0x03, 0x00, 14};
    dispatcher.handlePayload(pinOnlyFrame, sizeof(pinOnlyFrame), &recorder);
    TEST_ASSERT_EQUAL_UINT32(3, recorder.removes.size());
    TEST_ASSERT_EQUAL_STRING("", recorder.removeIds[2].c_str());
    TEST_ASSERT_EQUAL_INT(14, recorder.removes[2].pin);

    // Virtual pin (45 in 40..127) is accepted as a valid fallback pin
    const uint8_t vpinFrame[] = {0x03, 'v', 'p', '4', '5', 0x00, 45};
    dispatcher.handlePayload(vpinFrame, sizeof(vpinFrame), &recorder);
    TEST_ASSERT_EQUAL_UINT32(4, recorder.removes.size());
    TEST_ASSERT_EQUAL_STRING("vp45", recorder.removeIds[3].c_str());
    TEST_ASSERT_EQUAL_INT(45, recorder.removes[3].pin);

    // Out-of-range trailing pin (200 > 127) is ignored safely while preserving ID
    const uint8_t badPinFrame[] = {0x03, 'a', 'b', 'c', 0x00, 200};
    dispatcher.handlePayload(badPinFrame, sizeof(badPinFrame), &recorder);
    TEST_ASSERT_EQUAL_UINT32(5, recorder.removes.size());
    TEST_ASSERT_EQUAL_STRING("abc", recorder.removeIds[4].c_str());
    TEST_ASSERT_EQUAL_INT(-1, recorder.removes[4].pin);

    // Empty ID + invalid pin is rejected
    const uint8_t emptyFrame[] = {0x03, 0x00};
    dispatcher.handlePayload(emptyFrame, sizeof(emptyFrame), &recorder);
    TEST_ASSERT_EQUAL_UINT32(5, recorder.removes.size());
}

// ============================================================================
// 2. Exact User Bug Reproduction: Mismatched ID Delete on GPIO 5 via Pin Fallback
// ============================================================================
void test_delete_mismatched_id_resolves_via_fallback_pin() {
    PinManager pm;
    TEST_ASSERT_TRUE(pm.addSegment("48ef3dw", SegmentType::Output, 5));
    TEST_ASSERT_TRUE(pm.addSegment("iszmn6e", SegmentType::Output, 2));
    TEST_ASSERT_EQUAL_INT(2, pm.getActiveCount());

    // Exact mismatch reported by user: ESP32 has '48ef3dw' on GPIO 5,
    // Dashboard tries to delete 'jjib4yz' with trailing fallback pin=5.
    TEST_ASSERT_TRUE(pm.removeSegmentByIdOrPin("jjib4yz", 5));
    TEST_ASSERT_FALSE(pm.hasPin(5));
    TEST_ASSERT_FALSE(pm.hasId("48ef3dw"));
    TEST_ASSERT_TRUE(pm.hasPin(2));
    TEST_ASSERT_EQUAL_INT(1, pm.getActiveCount());

    // Exact ID match takes precedence over fallbackPin if both are supplied
    TEST_ASSERT_TRUE(pm.addSegment("seg_pin12", SegmentType::Output, 12));
    TEST_ASSERT_TRUE(pm.removeSegmentByIdOrPin("seg_pin12", 2));
    TEST_ASSERT_FALSE(pm.hasPin(12));
    TEST_ASSERT_TRUE(pm.hasPin(2));
    TEST_ASSERT_EQUAL_INT(1, pm.getActiveCount());
}

// ============================================================================
// 3. Canonical ID Pin Extraction Fallback (and Random Base-36 Safety)
// ============================================================================
void test_canonical_id_fallback_and_random_id_safety() {
    TEST_ASSERT_EQUAL_INT(5, PinManager::extractPinFromCanonicalId("gpio_5"));
    TEST_ASSERT_EQUAL_INT(5, PinManager::extractPinFromCanonicalId("GPIO_5"));
    TEST_ASSERT_EQUAL_INT(14, PinManager::extractPinFromCanonicalId("pin_14"));
    TEST_ASSERT_EQUAL_INT(0, PinManager::extractPinFromCanonicalId("0"));
    TEST_ASSERT_EQUAL_INT(39, PinManager::extractPinFromCanonicalId("gpio_39"));

    // Invalid / non-canonical / random base-36 IDs must NEVER extract a pin
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("7xhkvz2"));
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("jjib4yz"));
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("48ef3dw"));
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("gpio_40"));
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId("gpio_5_old"));
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId(""));
    TEST_ASSERT_EQUAL_INT(-1, PinManager::extractPinFromCanonicalId(nullptr));

    PinManager pm;
    TEST_ASSERT_TRUE(pm.addSegment("old_rnd5", SegmentType::Output, 5));
    TEST_ASSERT_TRUE(pm.addSegment("old_rnd7", SegmentType::Output, 7));

    // Random ID starting with digit '7' must NOT delete pin 7 when fallbackPin == -1
    TEST_ASSERT_FALSE(pm.removeSegmentByIdOrPin("7xhkvz2", -1));
    TEST_ASSERT_TRUE(pm.hasPin(7));

    // Canonical ID 'gpio_5' deletes pin 5 even on legacy frame (fallbackPin == -1)
    TEST_ASSERT_TRUE(pm.removeSegmentByIdOrPin("gpio_5", -1));
    TEST_ASSERT_FALSE(pm.hasPin(5));
    TEST_ASSERT_TRUE(pm.hasPin(7));
}

// ============================================================================
// 4. Upsert Segment on Occupied Pin (Prevents ID Drift on Re-Add)
// ============================================================================
void test_upsert_segment_replaces_stale_id_on_same_pin() {
    PinManager pm;
    TEST_ASSERT_TRUE(pm.addSegment("old_id5", SegmentType::Output, 5));
    TEST_ASSERT_EQUAL_STRING("old_id5", pm.getSegmentIdByPin(5));

    // Strict addSegment still rejects occupied pin
    TEST_ASSERT_FALSE(pm.addSegment("jjib4yz", SegmentType::Output, 5));
    TEST_ASSERT_EQUAL_STRING("old_id5", pm.getSegmentIdByPin(5));

    // upsertSegment replaces old ID with Dashboard's new ID on GPIO 5
    TEST_ASSERT_TRUE(pm.upsertSegment("jjib4yz", SegmentType::Input, 5));
    TEST_ASSERT_EQUAL_INT(1, pm.getActiveCount());
    TEST_ASSERT_FALSE(pm.hasId("old_id5"));
    TEST_ASSERT_TRUE(pm.hasId("jjib4yz"));
    TEST_ASSERT_EQUAL_STRING("jjib4yz", pm.getSegmentIdByPin(5));

    // Invalid upsert (e.g., ADC2 pin 5 as AnalogInput) MUST fail BEFORE deleting existing segment
    TEST_ASSERT_FALSE(pm.upsertSegment("bad_adc", SegmentType::AnalogInput, 5));
    TEST_ASSERT_TRUE(pm.hasPin(5));
    TEST_ASSERT_EQUAL_STRING("jjib4yz", pm.getSegmentIdByPin(5));

    // Moving an existing ID to a new pin cleans up the old pin slot
    TEST_ASSERT_TRUE(pm.upsertSegment("jjib4yz", SegmentType::Output, 18));
    TEST_ASSERT_FALSE(pm.hasPin(5));
    TEST_ASSERT_TRUE(pm.hasPin(18));
    TEST_ASSERT_EQUAL_STRING("jjib4yz", pm.getSegmentIdByPin(18));
    TEST_ASSERT_EQUAL_INT(1, pm.getActiveCount());
}

// ============================================================================
// 5. clearAllSegments() + exportStateJson() includes "ids" before "timers"
// ============================================================================
void test_clear_all_and_export_state_json_ids() {
    PinManager pm;
    TEST_ASSERT_TRUE(pm.addSegment("gpio_5", SegmentType::Output, 5));
    TEST_ASSERT_TRUE(pm.addSegment("sensor_34", SegmentType::AnalogInput, 34));

    String json = pm.exportStateJson();
    const int idsIdx = json.indexOf("\"ids\":{");
    const int timersIdx = json.indexOf("\"timers\":{");
    TEST_ASSERT_TRUE(idsIdx >= 0);
    TEST_ASSERT_TRUE(timersIdx > idsIdx);
    TEST_ASSERT_TRUE(json.indexOf("\"5\":\"gpio_5\"") >= 0);
    TEST_ASSERT_TRUE(json.indexOf("\"34\":\"sensor_34\"") >= 0);

    // Confirm timers section still excludes analog_input GPIO 34
    String timersPart = json.substring(static_cast<size_t>(timersIdx));
    TEST_ASSERT_TRUE(timersPart.indexOf("\"5\":0") >= 0);
    TEST_ASSERT_TRUE(timersPart.indexOf("\"34\":") < 0);

    pm.clearAllSegments();
    TEST_ASSERT_EQUAL_INT(0, pm.getActiveCount());
    TEST_ASSERT_FALSE(pm.hasPin(5));
    TEST_ASSERT_FALSE(pm.hasPin(34));
}

// ============================================================================
// 6. ACP Config Parser sets segmentsProvided for S-only and C n=0 payloads
// ============================================================================
void test_acp_sets_segments_provided_without_c_header() {
    uniuno::AchaemenidConfigProtocol parser;

    const char* sOnlyPayload =
        "ESP_CFG_V2\n"
        "S id=gpio_5 type=output pin=5 val=0 ao=0\n";
    ParseResult parsed;
    TEST_ASSERT_TRUE(parser.parse(sOnlyPayload, parsed));
    TEST_ASSERT_TRUE(parsed.segmentsProvided);
    TEST_ASSERT_EQUAL_INT(1, parsed.count);
    TEST_ASSERT_EQUAL_STRING("gpio_5", parsed.segments[0].id);

    const char* emptySegmentsPayload =
        "ESP_CFG_V2\n"
        "C n=0\n";
    ParseResult emptyParsed;
    TEST_ASSERT_TRUE(parser.parse(emptySegmentsPayload, emptyParsed));
    TEST_ASSERT_TRUE(emptyParsed.segmentsProvided);
    TEST_ASSERT_EQUAL_INT(0, emptyParsed.count);

    const char* mqttOnlyPayload =
        "ESP_CFG_V2\n"
        "M h=broker.emqx.io p=1883 t=KamyarIoT/Achaemenid q=1\n";
    ParseResult mqttOnlyParsed;
    TEST_ASSERT_TRUE(parser.parse(mqttOnlyPayload, mqttOnlyParsed));
    TEST_ASSERT_FALSE(mqttOnlyParsed.segmentsProvided);
}

// ============================================================================
// 7. End-to-End NVS Persistence after Upsert and Pin-Fallback Delete
// ============================================================================
void test_nvs_persistence_after_upsert_and_fallback_delete() {
    uniuno::NvsSegmentStorage storage;
    PinManager pm;
    TEST_ASSERT_TRUE(pm.addSegment("old_id5", SegmentType::Output, 5));
    TEST_ASSERT_TRUE(pm.addSegment("keep_2", SegmentType::Output, 2));

    // Upsert pin 5 with new ID and persist
    TEST_ASSERT_TRUE(pm.upsertSegment("jjib4yz", SegmentType::Output, 5));
    ParseResult snap1;
    pm.exportConfig(snap1);
    storage.saveSegmentConfig(snap1);

    // Simulate reboot into fresh PinManager
    PinManager rebooted;
    ParseResult loaded1;
    TEST_ASSERT_TRUE(storage.loadSegmentConfig(loaded1));
    TEST_ASSERT_EQUAL_INT(2, ConfigApplier::apply(loaded1, &rebooted));
    TEST_ASSERT_EQUAL_STRING("jjib4yz", rebooted.getSegmentIdByPin(5));

    // Delete pin 5 with a different Dashboard ID + fallback pin 5, persist, reboot again
    TEST_ASSERT_TRUE(rebooted.removeSegmentByIdOrPin("different_id", 5));
    ParseResult snap2;
    rebooted.exportConfig(snap2);
    storage.saveSegmentConfig(snap2);

    PinManager rebooted2;
    ParseResult loaded2;
    TEST_ASSERT_TRUE(storage.loadSegmentConfig(loaded2));
    TEST_ASSERT_EQUAL_INT(1, ConfigApplier::apply(loaded2, &rebooted2));
    TEST_ASSERT_FALSE(rebooted2.hasPin(5));
    TEST_ASSERT_TRUE(rebooted2.hasPin(2));
}

int main(int, char**) {
    UNITY_BEGIN();
    RUN_TEST(test_mqtt_delete_segment_parser_legacy_and_v2);
    RUN_TEST(test_delete_mismatched_id_resolves_via_fallback_pin);
    RUN_TEST(test_canonical_id_fallback_and_random_id_safety);
    RUN_TEST(test_upsert_segment_replaces_stale_id_on_same_pin);
    RUN_TEST(test_clear_all_and_export_state_json_ids);
    RUN_TEST(test_acp_sets_segments_provided_without_c_header);
    RUN_TEST(test_nvs_persistence_after_upsert_and_fallback_delete);
    return UNITY_END();
}
