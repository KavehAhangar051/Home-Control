#include <unity.h>
#include <string.h>

#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <Ticker.h>
#include <AsyncMqttClient.h>
#include <INetworkManager.h>
#include <Events/EventDispatcher.h>
#include <Core/Async/Executor.h>
#include <AppEvents.h>
#include <PinManager.h>
#include <BootManager.h>
#include <AchaemenidConfigProtocol.h>
#include <NetworkConfigHelper.h>
#include <AchaemenidMQTT.h>

using namespace uniuno;
using namespace uniuno::net_config;

namespace {

class StubNetworkManager : public uniuno::INetworkManager {
public:
  bool shouldResolve = false;
  bool connected = false;
  int connectCalls = 0;

  void add_access_point(const char*, const char*) override {}
  uniuno::Future<void, void, uniuno::Error> connectAsync() override {
    ++connectCalls;
    if (shouldResolve) {
      connected = true;
      return uniuno::Future<void, void, uniuno::Error>::resolve();
    }
    connected = false;
    return uniuno::Future<void, void, uniuno::Error>::reject(uniuno::Error("WIFI_FAILED"));
  }
  bool isConnected() const override { return connected; }
  uniuno::WiFiConnector* getConnector() override { return nullptr; }
};

void resetAllMocks() {
  mockHw().reset();
  Preferences::resetAll();
  WiFi.resetMock();
  mockDnsState().reset();
  mockMdnsState().reset();
}

} // namespace

void setUp(void) {
  resetAllMocks();
}

void tearDown(void) {}

void test_network_config_validation_helpers() {
  // STA credentials
  TEST_ASSERT_TRUE(isValidWifiCredential("MyWiFi", "12345678"));
  TEST_ASSERT_TRUE(isValidWifiCredential("12345678901234567890123456789012", "")); // 32-byte SSID, open
  TEST_ASSERT_TRUE(isValidWifiCredential("OpenNet", nullptr));
  TEST_ASSERT_FALSE(isValidWifiCredential("", "12345678"));
  TEST_ASSERT_FALSE(isValidWifiCredential("123456789012345678901234567890123", "12345678")); // 33 bytes
  TEST_ASSERT_FALSE(isValidWifiCredential("MyWiFi", "1234567"));                             // 7 bytes WPA invalid

  // SoftAP credentials (strictly requires 8..63 char pass)
  TEST_ASSERT_TRUE(isValidSoftApCredential("Achaemenid-AP", "Secret123"));
  TEST_ASSERT_FALSE(isValidSoftApCredential("Achaemenid-AP", ""));
  TEST_ASSERT_FALSE(isValidSoftApCredential("Achaemenid-AP", "1234567"));
  TEST_ASSERT_FALSE(isValidSoftApCredential("", "Secret123"));

  // MQTT sanitization & normalization
  TEST_ASSERT_EQUAL_INT(8883, sanitizeMqttPort(8883));
  TEST_ASSERT_EQUAL_INT(1883, sanitizeMqttPort(0));
  TEST_ASSERT_EQUAL_INT(1883, sanitizeMqttPort(-5));
  TEST_ASSERT_EQUAL_INT(1883, sanitizeMqttPort(70000));

  TEST_ASSERT_EQUAL_INT(0, sanitizeMqttQos(0));
  TEST_ASSERT_EQUAL_INT(2, sanitizeMqttQos(2));
  TEST_ASSERT_EQUAL_INT(1, sanitizeMqttQos(-1));
  TEST_ASSERT_EQUAL_INT(1, sanitizeMqttQos(3));

  TEST_ASSERT_TRUE(isValidMqttHost("broker.emqx.io"));
  TEST_ASSERT_TRUE(isValidMqttHost("192.168.1.10"));
  TEST_ASSERT_FALSE(isValidMqttHost(""));
  TEST_ASSERT_FALSE(isValidMqttHost("bad host"));
  TEST_ASSERT_FALSE(isValidMqttHost("bad/#host"));

  char topicBuf[64];
  TEST_ASSERT_TRUE(normalizeMqttBaseTopic("  /KamyarIoT/Achaemenid/// ", topicBuf, sizeof(topicBuf)));
  TEST_ASSERT_EQUAL_STRING("KamyarIoT/Achaemenid", topicBuf);
  TEST_ASSERT_FALSE(normalizeMqttBaseTopic("///", topicBuf, sizeof(topicBuf)));
  TEST_ASSERT_FALSE(normalizeMqttBaseTopic("Home/+/Light", topicBuf, sizeof(topicBuf)));
  TEST_ASSERT_FALSE(normalizeMqttBaseTopic("Home/#", topicBuf, sizeof(topicBuf)));

  // Capped MQTT backoff (never 0, capped at 60s)
  TEST_ASSERT_EQUAL_UINT32(1000UL, computeMqttReconnectDelayMs(1));
  TEST_ASSERT_EQUAL_UINT32(2000UL, computeMqttReconnectDelayMs(2));
  TEST_ASSERT_EQUAL_UINT32(4000UL, computeMqttReconnectDelayMs(3));
  TEST_ASSERT_EQUAL_UINT32(8000UL, computeMqttReconnectDelayMs(4));
  TEST_ASSERT_EQUAL_UINT32(16000UL, computeMqttReconnectDelayMs(5));
  TEST_ASSERT_EQUAL_UINT32(32000UL, computeMqttReconnectDelayMs(6));
  TEST_ASSERT_EQUAL_UINT32(60000UL, computeMqttReconnectDelayMs(7));
  TEST_ASSERT_EQUAL_UINT32(60000UL, computeMqttReconnectDelayMs(50));
}

void test_acp_wifi_and_open_network_and_max_5_cap() {
  const char* payload = "ESP_CFG_V2\n"
                        "W s=Home%20WiFi p=StrongPass123\n"
                        "W s=OpenCafe\n"
                        "W s=InvalidShortPass p=1234\n"
                        "W s= p=12345678\n"
                        "W s=12345678901234567890123456789012 p=12345678\n"
                        "W s=Net4 p=PassWord44\n"
                        "W s=Net5 p=PassWord55\n"
                        "W s=Net6Ignored p=PassWord66\n";

  AchaemenidConfigProtocol acp;
  ParseResult res;
  TEST_ASSERT_TRUE(acp.parse(payload, res));
  TEST_ASSERT_TRUE(res.wifiProvided);
  TEST_ASSERT_EQUAL_INT(5, res.wifiCount);

  TEST_ASSERT_EQUAL_STRING("Home WiFi", res.wifi[0].ssid);
  TEST_ASSERT_EQUAL_STRING("StrongPass123", res.wifi[0].password);

  TEST_ASSERT_EQUAL_STRING("OpenCafe", res.wifi[1].ssid);
  TEST_ASSERT_EQUAL_STRING("", res.wifi[1].password);

  TEST_ASSERT_EQUAL_STRING("12345678901234567890123456789012", res.wifi[2].ssid);
  TEST_ASSERT_EQUAL_STRING("Net4", res.wifi[3].ssid);
  TEST_ASSERT_EQUAL_STRING("Net5", res.wifi[4].ssid);
}

void test_acp_wifi_empty_list_marker() {
  const char* payload = "ESP_CFG_V2\n"
                        "W n=0\n";

  AchaemenidConfigProtocol acp;
  ParseResult res;
  TEST_ASSERT_TRUE(acp.parse(payload, res));
  TEST_ASSERT_TRUE(res.wifiProvided);
  TEST_ASSERT_EQUAL_INT(0, res.wifiCount);
}

void test_acp_ap_valid_clear_and_malformed_protection() {
  AchaemenidConfigProtocol acp;
  ParseResult res;

  // 1. Valid AP + optional mDNS
  TEST_ASSERT_TRUE(acp.parse("ESP_CFG_V2\n"
                             "A s=My%20CustomAP p=SetupPass123 m=My-Node\n",
                             res));
  TEST_ASSERT_TRUE(res.apProvided);
  TEST_ASSERT_TRUE(res.apValid);
  TEST_ASSERT_EQUAL_STRING("My CustomAP", res.apSsid);
  TEST_ASSERT_EQUAL_STRING("SetupPass123", res.apPassword);
  TEST_ASSERT_TRUE(res.mdnsProvided);
  TEST_ASSERT_EQUAL_STRING("My-Node", res.mdnsHost);

  // 2. Explicit clear (both empty)
  TEST_ASSERT_TRUE(acp.parse("ESP_CFG_V2\n"
                             "A s= p=\n",
                             res));
  TEST_ASSERT_TRUE(res.apProvided);
  TEST_ASSERT_FALSE(res.apValid);

  // 3. Partial/invalid AP must NOT mark apProvided=true (protects saved AP in NVS)
  TEST_ASSERT_TRUE(acp.parse("ESP_CFG_V2\n"
                             "A s=HalfBakedAP p=123\n",
                             res));
  TEST_ASSERT_FALSE(res.apProvided);
  TEST_ASSERT_FALSE(res.apValid);
}

void test_acp_mqtt_validation_clamping_and_credentials() {
  AchaemenidConfigProtocol acp;
  ParseResult res;

  // Valid with trailing slash & out-of-range port/qos & optional auth
  TEST_ASSERT_TRUE(acp.parse("ESP_CFG_V2\n"
                             "M h=mqtt.example.com p=99999 t=/Smart/Home/ q=7 u=iot%20user pw=Pass%23Word\n",
                             res));
  TEST_ASSERT_TRUE(res.mqtt.valid);
  TEST_ASSERT_EQUAL_STRING("mqtt.example.com", res.mqtt.host);
  TEST_ASSERT_EQUAL_INT(1883, res.mqtt.port);
  TEST_ASSERT_EQUAL_STRING("Smart/Home", res.mqtt.baseTopic);
  TEST_ASSERT_EQUAL_INT(1, res.mqtt.qos);
  TEST_ASSERT_EQUAL_STRING("iot user", res.mqtt.user);
  TEST_ASSERT_EQUAL_STRING("Pass#Word", res.mqtt.password);

  // Reject empty host or wildcard topic
  TEST_ASSERT_TRUE(acp.parse("ESP_CFG_V2\n"
                             "M h= p=1883 t=Valid/Topic q=1\n",
                             res));
  TEST_ASSERT_FALSE(res.mqtt.valid);

  TEST_ASSERT_TRUE(acp.parse("ESP_CFG_V2\n"
                             "M h=broker.emqx.io p=1883 t=Home/+/Topic q=1\n",
                             res));
  TEST_ASSERT_FALSE(res.mqtt.valid);
}

void test_mqtt_config_matching_logic() {
  uniuno::MqttConfig a;
  a.server = "broker.emqx.io";
  a.port = 1883;
  a.baseTopic = "KamyarIoT/Achaemenid";
  a.qos = 1;
  a.user = "u1";
  a.password = "p1";

  uniuno::MqttConfig b = a;
  TEST_ASSERT_TRUE(a.matchesConnectionParams(b));

  b.server = "test.mosquitto.org";
  TEST_ASSERT_FALSE(a.matchesConnectionParams(b));

  b = a;
  b.port = 8883;
  TEST_ASSERT_FALSE(a.matchesConnectionParams(b));

  b = a;
  b.baseTopic = "Other/Topic";
  TEST_ASSERT_FALSE(a.matchesConnectionParams(b));

  b = a;
  b.qos = 2;
  TEST_ASSERT_FALSE(a.matchesConnectionParams(b));

  b = a;
  b.user = "";
  TEST_ASSERT_FALSE(a.matchesConnectionParams(b));
}

void test_mqtt_runtime_reconfigure_while_connected() {
  WiFi.mockStatus = WL_CONNECTED;

  AchaemenidMQTT mqtt;
  auto& raw = mqtt.testMqttClient();

  // 1. Initial configuration + connect
  mqtt.begin("broker.emqx.io", 1883, "Home/Living/", 1, "alice", "secret1");
  mqtt.subscribe("Home/Living/Command");
  mqtt.connect();

  TEST_ASSERT_EQUAL_STRING("broker.emqx.io", raw.mockServer.c_str());
  TEST_ASSERT_EQUAL_UINT16(1883, raw.mockPort);
  TEST_ASSERT_EQUAL_STRING("Home/Living", mqtt.getBaseTopic().c_str());
  TEST_ASSERT_EQUAL_STRING("Home/Living/Status", raw.mockWillTopic.c_str());
  TEST_ASSERT_EQUAL_STRING("alice", raw.mockUser.c_str());
  TEST_ASSERT_EQUAL_INT(1, raw.connectCallCount);
  TEST_ASSERT_EQUAL_INT(0, raw.disconnectCallCount);

  // Simulate active MQTT connection
  raw.mockConnected = true;
  if (raw.onConnectCb) raw.onConnectCb(false);
  TEST_ASSERT_EQUAL_STRING("Home/Living/Command", raw.mockLastSubscribedTopic.c_str());
  const int subCallsAfterConnect = raw.subscribeCallCount;

  // 2. Identical config re-applied while connected -> MUST NOT disconnect or churn
  mqtt.begin("broker.emqx.io", 1883, "Home/Living", 1, "alice", "secret1");
  mqtt.subscribe("Home/Living/Command");
  mqtt.connect();
  TEST_ASSERT_TRUE(raw.mockConnected);
  TEST_ASSERT_EQUAL_INT(0, raw.disconnectCallCount);
  TEST_ASSERT_EQUAL_INT(1, raw.connectCallCount);
  TEST_ASSERT_EQUAL_INT(subCallsAfterConnect, raw.subscribeCallCount);

  // 3. Broker/topic/credentials changed while connected -> MUST cleanly disconnect & clear creds
  mqtt.begin("test.mosquitto.org", 1884, "Office/Main", 2, "", "");
  mqtt.subscribe("Office/Main/Command"); // Deferred while reconfiguring, not sent on old broker
  TEST_ASSERT_EQUAL_INT(1, raw.disconnectCallCount);
  TEST_ASSERT_FALSE(raw.mockConnected);
  TEST_ASSERT_FALSE(mqtt.testHasPendingReconfigureReconnect()); // Cleared when onDisconnect ran
  TEST_ASSERT_EQUAL_STRING("test.mosquitto.org", raw.mockServer.c_str());
  TEST_ASSERT_EQUAL_UINT16(1884, raw.mockPort);
  TEST_ASSERT_EQUAL_STRING("Office/Main/Status", raw.mockWillTopic.c_str());
  TEST_ASSERT_EQUAL_UINT8(2, raw.mockWillQos);
  TEST_ASSERT_EQUAL_STRING("", raw.mockUser.c_str());
  TEST_ASSERT_EQUAL_STRING("", raw.mockPass.c_str());
  TEST_ASSERT_EQUAL_INT(subCallsAfterConnect, raw.subscribeCallCount);

  // Reconnect triggers subscription on new topic
  mqtt.connect();
  TEST_ASSERT_EQUAL_INT(2, raw.connectCallCount);
  raw.mockConnected = true;
  if (raw.onConnectCb) raw.onConnectCb(false);
  TEST_ASSERT_EQUAL_STRING("Office/Main/Command", raw.mockLastSubscribedTopic.c_str());
}

void test_bootmanager_invalid_nvs_ap_falls_back_to_mac_ap() {
  // Store corrupted AP config in NVS (password too short)
  {
    Preferences prefs;
    prefs.begin("AchaemenidNet", false);
    prefs.putBool("apConfigured", true);
    prefs.putString("apSsid", "BrokenAP");
    prefs.putString("apPass", "123"); // < 8 chars -> SoftAP would fail if used!
    prefs.end();
  }

  StubNetworkManager net;
  PinManager pm;
  uniuno::Executor executor;
  uniuno::EventDispatcher eventBus;
  bool configLoaded = false;
  String rawPayload;

  BootManager boot;
  BootContext ctx{&net, &pm, &executor, &eventBus, nullptr, nullptr, &configLoaded, &rawPayload};
  boot.startBootSequenceAsync(ctx);

  TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(BootState::PROVISIONING), static_cast<uint8_t>(boot.getState()));
  TEST_ASSERT_TRUE(WiFi.mockApActive);
  TEST_ASSERT_EQUAL_STRING("Achaemenid-DDEEFF", WiFi.mockApSsid.c_str());
  TEST_ASSERT_EQUAL_STRING("Setup-DDEEFF", WiFi.mockApPass.c_str());
}

void test_bootmanager_refresh_mdns_updates_running_responder() {
  StubNetworkManager net;
  net.shouldResolve = true;
  {
    Preferences prefs;
    prefs.begin("AchaemenidNet", false);
    prefs.putInt("wifiCount", 1);
    prefs.putString("ssid0", "HomeNet");
    prefs.putString("pass0", "StrongPass123");
    prefs.end();
  }

  PinManager pm;
  uniuno::Executor executor;
  uniuno::EventDispatcher eventBus;
  bool configLoaded = false;
  String rawPayload;

  BootManager boot;
  BootContext ctx{&net, &pm, &executor, &eventBus, nullptr, nullptr, &configLoaded, &rawPayload};
  boot.startBootSequenceAsync(ctx);
  mockHw().fakeMillis += 100;
  executor.poll();

  TEST_ASSERT_EQUAL_STRING("achaemenid", boot.getMdnsHostname());
  TEST_ASSERT_EQUAL_STRING("achaemenid", mockMdnsState().hostname.c_str());

  {
    Preferences prefs;
    prefs.begin("AchaemenidNet", false);
    prefs.putString("mdnsHost", "LivingRoomNode");
    prefs.end();
  }
  boot.refreshMdnsIdentity();
  TEST_ASSERT_EQUAL_STRING("livingroomnode", boot.getMdnsHostname());
  TEST_ASSERT_EQUAL_STRING("http://livingroomnode.local/", boot.getPortalUrl());
  TEST_ASSERT_EQUAL_STRING("livingroomnode", mockMdnsState().hostname.c_str());
}

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;
  UNITY_BEGIN();
  RUN_TEST(test_network_config_validation_helpers);
  RUN_TEST(test_acp_wifi_and_open_network_and_max_5_cap);
  RUN_TEST(test_acp_wifi_empty_list_marker);
  RUN_TEST(test_acp_ap_valid_clear_and_malformed_protection);
  RUN_TEST(test_acp_mqtt_validation_clamping_and_credentials);
  RUN_TEST(test_mqtt_config_matching_logic);
  RUN_TEST(test_mqtt_runtime_reconfigure_while_connected);
  RUN_TEST(test_bootmanager_invalid_nvs_ap_falls_back_to_mac_ap);
  RUN_TEST(test_bootmanager_refresh_mdns_updates_running_responder);
  return UNITY_END();
}
