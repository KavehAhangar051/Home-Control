#include <unity.h>

#include <Arduino.h>
#include <ArduinoJson.h>
#include <AuxNodeManager.h>
#include <PinManager.h>
#include <Utilities/FixedJsonWriter.h>
#include <Utilities/SystemDiagnostics.h>
#include <core/WssUrlParser.h>

#include <cstring>

void setUp() {
  mockHw().reset();
}

void tearDown() {}

// ============================================================================
// 1. Zero-Heap WSS URL Parser Tests
// ============================================================================

void test_wss_url_parser_standard_and_custom_ports() {
  uniuno::ParsedWssUrl out{};
  TEST_ASSERT_TRUE(uniuno::parseWssUrl("wss://db.home-control.enddev.ir/ws", out));
  TEST_ASSERT_EQUAL_STRING("db.home-control.enddev.ir", out.host);
  TEST_ASSERT_EQUAL_INT(443, out.port);
  TEST_ASSERT_EQUAL_STRING("/ws", out.path);

  TEST_ASSERT_TRUE(uniuno::parseWssUrl("https://iot.example.com:8443/v2/stream?token=1", out));
  TEST_ASSERT_EQUAL_STRING("iot.example.com", out.host);
  TEST_ASSERT_EQUAL_INT(8443, out.port);
  TEST_ASSERT_EQUAL_STRING("/v2/stream?token=1", out.path);

  TEST_ASSERT_TRUE(uniuno::parseWssUrl("wss://no-path.example.org", out));
  TEST_ASSERT_EQUAL_STRING("no-path.example.org", out.host);
  TEST_ASSERT_EQUAL_INT(443, out.port);
  TEST_ASSERT_EQUAL_STRING("/", out.path);
}

void test_wss_url_parser_rejects_invalid_inputs_and_overflows() {
  uniuno::ParsedWssUrl out{};
  TEST_ASSERT_FALSE(uniuno::parseWssUrl(nullptr, out));
  TEST_ASSERT_FALSE(uniuno::parseWssUrl("", out));
  TEST_ASSERT_FALSE(uniuno::parseWssUrl("ws://insecure.example.com/ws", out));
  TEST_ASSERT_FALSE(uniuno::parseWssUrl("wss:///only-path", out));
  TEST_ASSERT_FALSE(uniuno::parseWssUrl("wss://:443/ws", out));

  // Invalid port falls back to default 443 while keeping valid host/path
  TEST_ASSERT_TRUE(uniuno::parseWssUrl("wss://fallback.example.com:99999/ws", out));
  TEST_ASSERT_EQUAL_STRING("fallback.example.com", out.host);
  TEST_ASSERT_EQUAL_INT(443, out.port);
  TEST_ASSERT_EQUAL_STRING("/ws", out.path);

  // Oversized host (>95 chars) rejected safely
  char longUrl[160];
  std::strcpy(longUrl, "wss://");
  std::memset(longUrl + 6, 'a', 110);
  std::strcpy(longUrl + 116, "/ws");
  TEST_ASSERT_FALSE(uniuno::parseWssUrl(longUrl, out));
}

// ============================================================================
// 2. Zero-Heap PinManager & AuxNodeManager State JSON Export Tests
// ============================================================================

void test_zero_heap_export_state_json_matches_string_overload() {
  PinManager pm;
  AuxNodeManager nodes;

  const uint8_t mac[6] = {0xAA, 0xBB, 0xCC, 0x11, 0x22, 0x33};
  TEST_ASSERT_TRUE(nodes.addNode(1, mac, 4, AUX_CHIP_ESP8266_01, "Hall \"Relay\""));
  TEST_ASSERT_TRUE(nodes.setNodeOnline(1, true));

  TEST_ASSERT_TRUE(pm.addSegment("pin_2", SegmentType::Output, 2, 10));
  TEST_ASSERT_TRUE(pm.setPinState(2, true));
  TEST_ASSERT_TRUE(pm.addSegment("pin_25", SegmentType::AnalogOutput, 25, 0, RuleConfig(), 8, 5000));
  TEST_ASSERT_TRUE(pm.setPinAnalogValue(25, 180));
  TEST_ASSERT_TRUE(pm.addVirtualSegment("vpin_100", SegmentType::Output, 100, 1, 2));
  TEST_ASSERT_TRUE(pm.setPinState(100, true));

  char buf[2048];
  const size_t len = pm.exportStateJson(buf, sizeof(buf), &nodes);
  const String legacyJson = pm.exportStateJson(&nodes);

  TEST_ASSERT_GREATER_THAN(0, len);
  TEST_ASSERT_EQUAL_UINT32(legacyJson.length(), len);
  TEST_ASSERT_EQUAL_STRING(legacyJson.c_str(), buf);

  StaticJsonDocument<2048> doc;
  const DeserializationError err = deserializeJson(doc, buf, len);
  TEST_ASSERT_FALSE(err);
  TEST_ASSERT_EQUAL_STRING("state_sync", doc["type"].as<const char*>());
  TEST_ASSERT_TRUE(doc["states"]["2"].as<bool>());
  TEST_ASSERT_EQUAL_INT(180, doc["values"]["25"].as<int>());
  TEST_ASSERT_EQUAL_INT(8, doc["resolutions"]["25"].as<int>());
  TEST_ASSERT_EQUAL_STRING("pin_2", doc["ids"]["2"].as<const char*>());
  TEST_ASSERT_EQUAL_INT(1, doc["virtual"]["100"]["node"].as<int>());
  TEST_ASSERT_EQUAL_INT(2, doc["virtual"]["100"]["rpin"].as<int>());
  TEST_ASSERT_EQUAL_STRING("Hall \"Relay\"", doc["nodes"][0]["name"].as<const char*>());
  TEST_ASSERT_TRUE(doc["nodes"][0]["online"].as<bool>());
}

void test_fixed_json_writer_handles_truncation_safely() {
  char smallBuf[12];
  uniuno::FixedJsonWriter writer(smallBuf, sizeof(smallBuf));
  writer.appendRaw("{\"hello\":\"world\"}");
  TEST_ASSERT_TRUE(writer.overflowed());
  TEST_ASSERT_EQUAL_UINT32(sizeof(smallBuf) - 1, writer.length());
  TEST_ASSERT_EQUAL_CHAR('\0', smallBuf[sizeof(smallBuf) - 1]);
}

// ============================================================================
// 3. System Diagnostics, MQTT Status Telemetry & OTA Health Gate Tests
// ============================================================================

void test_reset_reason_mapping() {
  TEST_ASSERT_EQUAL_STRING("unknown", uniuno::diagnostics::resetReasonToString(0));
  TEST_ASSERT_EQUAL_STRING("poweron", uniuno::diagnostics::resetReasonToString(1));
  TEST_ASSERT_EQUAL_STRING("sw", uniuno::diagnostics::resetReasonToString(3));
  TEST_ASSERT_EQUAL_STRING("panic", uniuno::diagnostics::resetReasonToString(4));
  TEST_ASSERT_EQUAL_STRING("int_wdt", uniuno::diagnostics::resetReasonToString(5));
  TEST_ASSERT_EQUAL_STRING("task_wdt", uniuno::diagnostics::resetReasonToString(6));
  TEST_ASSERT_EQUAL_STRING("brownout", uniuno::diagnostics::resetReasonToString(9));
  TEST_ASSERT_EQUAL_STRING("unknown", uniuno::diagnostics::resetReasonToString(999));
}

void test_format_mqtt_online_status_json() {
  char payload[160];
  const size_t len =
      uniuno::diagnostics::formatMqttOnlineStatusJson(payload, sizeof(payload), 192, 168, 1, 42, "task_wdt", 142848U);
  TEST_ASSERT_EQUAL_UINT32(std::strlen(payload), len);

  StaticJsonDocument<256> doc;
  const DeserializationError err = deserializeJson(doc, payload, len);
  TEST_ASSERT_FALSE(err);
  TEST_ASSERT_EQUAL_STRING("online", doc["status"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("192.168.1.42", doc["ip"].as<const char*>());
  TEST_ASSERT_EQUAL_STRING("task_wdt", doc["resetReason"].as<const char*>());
  TEST_ASSERT_EQUAL_UINT32(142848U, doc["minFreeHeap"].as<uint32_t>());

  // Null reset reason falls back safely to "unknown"
  uniuno::diagnostics::formatMqttOnlineStatusJson(payload, sizeof(payload), 10, 0, 0, 5, nullptr, 65536U);
  TEST_ASSERT_NOT_NULL(std::strstr(payload, "\"resetReason\":\"unknown\""));
}

void test_ota_health_gate_state_machine() {
  uniuno::diagnostics::OtaHealthGate gate;
  TEST_ASSERT_FALSE(gate.isInitialized());
  TEST_ASSERT_FALSE(gate.shouldConfirm(50000UL, true));

  gate.begin(1000UL, 30000UL);
  TEST_ASSERT_TRUE(gate.isInitialized());
  TEST_ASSERT_FALSE(gate.isConfirmed());

  // Too early even with network connected
  TEST_ASSERT_FALSE(gate.shouldConfirm(30999UL, true));
  // Threshold reached, but network offline
  TEST_ASSERT_FALSE(gate.shouldConfirm(31000UL, false));
  // Threshold reached AND network connected -> confirm!
  TEST_ASSERT_TRUE(gate.shouldConfirm(31000UL, true));

  // One-shot after markConfirmed()
  gate.markConfirmed();
  TEST_ASSERT_TRUE(gate.isConfirmed());
  TEST_ASSERT_FALSE(gate.shouldConfirm(60000UL, true));

  // Unsigned millis() rollover safety
  gate.begin(0xFFFFFFF0UL, 100UL);
  TEST_ASSERT_FALSE(gate.shouldConfirm(50UL, true));
  TEST_ASSERT_TRUE(gate.shouldConfirm(84UL, true));
}

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;
  UNITY_BEGIN();
  RUN_TEST(test_wss_url_parser_standard_and_custom_ports);
  RUN_TEST(test_wss_url_parser_rejects_invalid_inputs_and_overflows);
  RUN_TEST(test_zero_heap_export_state_json_matches_string_overload);
  RUN_TEST(test_fixed_json_writer_handles_truncation_safely);
  RUN_TEST(test_reset_reason_mapping);
  RUN_TEST(test_format_mqtt_online_status_json);
  RUN_TEST(test_ota_health_gate_state_machine);
  return UNITY_END();
}
