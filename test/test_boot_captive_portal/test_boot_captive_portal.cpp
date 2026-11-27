#include <unity.h>
#include <string.h>

#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <WebServer.h>
#include <INetworkManager.h>
#include <Events/EventDispatcher.h>
#include <Core/Async/Executor.h>
#include <AppEvents.h>
#include <PinManager.h>
#include <BootManager.h>

#include "../../lib/AchaemenidBootManager/src/CaptivePortalHelper.h"

using namespace uniuno::captive_portal;

namespace {

class StubNetworkManager : public uniuno::INetworkManager {
public:
  bool shouldResolve = true;
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

void test_normalize_mdns_hostname_valid_and_case_folding() {
  char buf[64];
  TEST_ASSERT_EQUAL_UINT(10, normalizeMdnsHostname("Achaemenid", buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("achaemenid", buf);

  TEST_ASSERT_EQUAL_UINT(10, normalizeMdnsHostname("  My_Node-01.local  ", buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("my-node-01", buf);

  TEST_ASSERT_EQUAL_UINT(6, normalizeMdnsHostname("Room 2!!", buf, sizeof(buf)));
  TEST_ASSERT_EQUAL_STRING("room-2", buf);
}

void test_normalize_mdns_hostname_fallback_on_empty_or_invalid() {
  char buf[64];
  normalizeMdnsHostname(nullptr, buf, sizeof(buf));
  TEST_ASSERT_EQUAL_STRING("achaemenid", buf);

  normalizeMdnsHostname("", buf, sizeof(buf));
  TEST_ASSERT_EQUAL_STRING("achaemenid", buf);

  normalizeMdnsHostname("   ---...local  ", buf, sizeof(buf));
  TEST_ASSERT_EQUAL_STRING("achaemenid", buf);
}

void test_build_mdns_fqdn_and_portal_url() {
  char fqdn[64];
  char url[80];

  buildMdnsFqdn("Achaemenid.local", fqdn, sizeof(fqdn));
  TEST_ASSERT_EQUAL_STRING("achaemenid.local", fqdn);

  buildPortalUrl("Achaemenid", url, sizeof(url));
  TEST_ASSERT_EQUAL_STRING("http://achaemenid.local/", url);

  buildPortalUrl("Living_Room", url, sizeof(url));
  TEST_ASSERT_EQUAL_STRING("http://living-room.local/", url);
}

void test_captive_portal_probe_paths_detected_across_os() {
  // Android
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/generate_204"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/gen_204"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/generate_204?v=123"));

  // Apple iOS / macOS
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/hotspot-detect.html"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/library/test/success.html"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/HOTSPOT-DETECT.HTML"));

  // Windows
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/connecttest.txt"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/ncsi.txt"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/redirect"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/fwlink"));

  // Firefox / Linux NetworkManager
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/canonical.html"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/success.txt"));
  TEST_ASSERT_TRUE(isCaptivePortalProbePath("/check_network_status.txt"));

  // Normal portal routes must NOT be flagged as OS captive probes
  TEST_ASSERT_FALSE(isCaptivePortalProbePath("/"));
  TEST_ASSERT_FALSE(isCaptivePortalProbePath("/save"));
  TEST_ASSERT_FALSE(isCaptivePortalProbePath("/scan"));
  TEST_ASSERT_FALSE(isCaptivePortalProbePath("/status"));
}

void test_portal_host_matching_and_redirect_decision() {
  // Exact mDNS FQDN (case-insensitive, optional port, optional trailing dot)
  TEST_ASSERT_TRUE(isPortalHost("achaemenid.local", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_TRUE(isPortalHost("ACHAEMENID.LOCAL:80", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_TRUE(isPortalHost("achaemenid.local.", kDefaultMdnsFqdn, kDefaultApIp));

  // Manual SoftAP IP fallback
  TEST_ASSERT_TRUE(isPortalHost("192.168.4.1", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_TRUE(isPortalHost("192.168.4.1:80", kDefaultMdnsFqdn, kDefaultApIp));

  // External domains hijacked by DNSServer must NOT be treated as portal host
  TEST_ASSERT_FALSE(isPortalHost("connectivitycheck.gstatic.com", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_FALSE(isPortalHost("captive.apple.com", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_FALSE(isPortalHost("www.msftconnecttest.com", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_FALSE(isPortalHost("", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_FALSE(isPortalHost(nullptr, kDefaultMdnsFqdn, kDefaultApIp));

  // Redirect policy:
  // 1. OS probe -> ALWAYS redirect to http://achaemenid.local/
  TEST_ASSERT_TRUE(
      shouldRedirectToCaptivePortal("connectivitycheck.gstatic.com", "/generate_204", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_TRUE(
      shouldRedirectToCaptivePortal("achaemenid.local", "/hotspot-detect.html", kDefaultMdnsFqdn, kDefaultApIp));

  // 2. Arbitrary external site on "/" -> redirect to http://achaemenid.local/
  TEST_ASSERT_TRUE(shouldRedirectToCaptivePortal("example.com", "/", kDefaultMdnsFqdn, kDefaultApIp));

  // 3. Real portal host on "/" -> serve 200 OK (NO redirect loop!)
  TEST_ASSERT_FALSE(shouldRedirectToCaptivePortal("achaemenid.local", "/", kDefaultMdnsFqdn, kDefaultApIp));
  TEST_ASSERT_FALSE(shouldRedirectToCaptivePortal("192.168.4.1", "/", kDefaultMdnsFqdn, kDefaultApIp));
}

void test_wifi_credential_validation() {
  TEST_ASSERT_TRUE(isValidWifiCredential("MyHomeWiFi", "StrongPass123"));
  TEST_ASSERT_TRUE(isValidWifiCredential("OpenCafe", ""));
  TEST_ASSERT_TRUE(isValidWifiCredential("OpenCafe", nullptr));

  // Boundary lengths: 32-char SSID, 8-char and 63-char passwords
  TEST_ASSERT_TRUE(isValidWifiCredential("12345678901234567890123456789012", "12345678"));
  TEST_ASSERT_TRUE(isValidWifiCredential("Net", "123456789012345678901234567890123456789012345678901234567890123"));

  // Invalid cases
  TEST_ASSERT_FALSE(isValidWifiCredential("", "12345678"));
  TEST_ASSERT_FALSE(isValidWifiCredential(nullptr, "12345678"));
  TEST_ASSERT_FALSE(isValidWifiCredential("123456789012345678901234567890123", "12345678")); // 33 bytes
  TEST_ASSERT_FALSE(isValidWifiCredential("MyWiFi", "1234567"));                             // 7 bytes (<8)
  TEST_ASSERT_FALSE(
      isValidWifiCredential("MyWiFi", "1234567890123456789012345678901234567890123456789012345678901234")); // 64 bytes
}

void test_json_and_html_escaping_safety() {
  char out[64];
  size_t pos = 0;
  TEST_ASSERT_TRUE(appendJsonEscaped(out, sizeof(out), pos, "Cafe \"A\" \\ \n\tNet"));
  TEST_ASSERT_EQUAL_STRING("Cafe \\\"A\\\" \\\\ \\n\\tNet", out);

  pos = 0;
  TEST_ASSERT_TRUE(appendHtmlEscaped(out, sizeof(out), pos, "<script>'\"&</script>"));
  TEST_ASSERT_EQUAL_STRING("&lt;script&gt;&#39;&quot;&amp;&lt;/script&gt;", out);

  // Truncation safety (must stay null-terminated and return false)
  char smallBuf[6];
  pos = 0;
  TEST_ASSERT_FALSE(appendHtmlEscaped(smallBuf, sizeof(smallBuf), pos, "<script>"));
  TEST_ASSERT_EQUAL_CHAR('\0', smallBuf[pos]);
}

void test_provisioning_idle_auto_retry_policy_and_wraparound() {
  constexpr unsigned long kTimeout = 180000UL;

  // Fresh device with NO saved WiFi must stay in provisioning forever
  TEST_ASSERT_FALSE(shouldAutoRetrySavedWifiFromProvisioning(false, 0, 500000UL, 0UL, kTimeout));

  // Active client connected to AP must NEVER kick the user off
  TEST_ASSERT_FALSE(shouldAutoRetrySavedWifiFromProvisioning(true, 1, 500000UL, 0UL, kTimeout));

  // Saved WiFi exists, 0 clients, before timeout -> keep AP open
  TEST_ASSERT_FALSE(shouldAutoRetrySavedWifiFromProvisioning(true, 0, 179999UL, 0UL, kTimeout));

  // Saved WiFi exists, 0 clients, at/after timeout -> retry saved WiFi
  TEST_ASSERT_TRUE(shouldAutoRetrySavedWifiFromProvisioning(true, 0, 180000UL, 0UL, kTimeout));

  // 32-bit millis() wraparound safety
  const unsigned long nearMax = 0xFFFFFFFFUL - 10000UL;
  const unsigned long afterWrap = 175000UL; // elapsed = 185001ms >= 180000ms
  TEST_ASSERT_TRUE(shouldAutoRetrySavedWifiFromProvisioning(true, 0, afterWrap, nearMax, kTimeout));

  const unsigned long shortAfterWrap = 5000UL; // elapsed = 15001ms < 180000ms
  TEST_ASSERT_FALSE(shouldAutoRetrySavedWifiFromProvisioning(true, 0, shortAfterWrap, nearMax, kTimeout));
}

void test_bootmanager_instant_captive_portal_dns_mdns_and_redirects() {
  StubNetworkManager net;
  PinManager pm;
  uniuno::Executor executor;
  uniuno::EventDispatcher eventBus;
  bool configLoaded = false;
  String rawPayload;

  BootManager boot;
  BootContext ctx{&net, &pm, &executor, &eventBus, nullptr, nullptr, &configLoaded, &rawPayload};
  boot.startBootSequenceAsync(ctx);

  // Zero saved WiFi -> instant provisioning without waiting for connectAsync()
  TEST_ASSERT_EQUAL_INT(0, net.connectCalls);
  TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(BootState::PROVISIONING), static_cast<uint8_t>(boot.getState()));
  TEST_ASSERT_TRUE(WiFi.mockApActive);
  TEST_ASSERT_EQUAL_STRING("achaemenid", boot.getMdnsHostname());
  TEST_ASSERT_EQUAL_STRING("http://achaemenid.local/", boot.getPortalUrl());

  // Wildcard DNSServer on UDP/53 -> 192.168.4.1
  TEST_ASSERT_TRUE(mockDnsState().running);
  TEST_ASSERT_EQUAL_UINT16(53, mockDnsState().port);
  TEST_ASSERT_EQUAL_STRING("*", mockDnsState().domain.c_str());
  TEST_ASSERT_EQUAL_STRING("192.168.4.1", mockDnsState().resolvedIp.toString().c_str());

  // ESPmDNS responder active with _http._tcp:80 and _ws._tcp:81 (local WebSocket in AP mode)
  TEST_ASSERT_TRUE(mockMdnsState().started);
  TEST_ASSERT_EQUAL_STRING("achaemenid", mockMdnsState().hostname.c_str());
  TEST_ASSERT_EQUAL_UINT(2, mockMdnsState().services.size());
  TEST_ASSERT_EQUAL_STRING("http", mockMdnsState().services[0].service.c_str());
  TEST_ASSERT_EQUAL_UINT16(80, mockMdnsState().services[0].port);
  TEST_ASSERT_EQUAL_STRING("ws", mockMdnsState().services[1].service.c_str());
  TEST_ASSERT_EQUAL_UINT16(81, mockMdnsState().services[1].port);

  // OS Captive Portal probes & foreign hosts redirect 302 -> http://achaemenid.local/
  auto& srv = boot.testServer();
  srv.simulateRequest(HTTP_GET, "/generate_204", "connectivitycheck.gstatic.com");
  TEST_ASSERT_EQUAL_INT(302, srv.lastResponse().code);
  TEST_ASSERT_EQUAL_STRING("http://achaemenid.local/", srv.lastResponse().headers.at("Location").c_str());

  srv.simulateRequest(HTTP_GET, "/hotspot-detect.html", "captive.apple.com");
  TEST_ASSERT_EQUAL_INT(302, srv.lastResponse().code);
  TEST_ASSERT_EQUAL_STRING("http://achaemenid.local/", srv.lastResponse().headers.at("Location").c_str());

  srv.simulateRequest(HTTP_GET, "/connecttest.txt", "www.msftconnecttest.com");
  TEST_ASSERT_EQUAL_INT(302, srv.lastResponse().code);
  TEST_ASSERT_EQUAL_STRING("http://achaemenid.local/", srv.lastResponse().headers.at("Location").c_str());

  srv.simulateRequest(HTTP_GET, "/", "example.com");
  TEST_ASSERT_EQUAL_INT(302, srv.lastResponse().code);
  TEST_ASSERT_EQUAL_STRING("http://achaemenid.local/", srv.lastResponse().headers.at("Location").c_str());

  // Direct portal host (mDNS or SoftAP IP) serves 200 OK dashboard without redirect loop
  srv.simulateRequest(HTTP_GET, "/", "achaemenid.local");
  TEST_ASSERT_EQUAL_INT(200, srv.lastResponse().code);
  TEST_ASSERT_TRUE(srv.lastResponse().body.find("http://achaemenid.local/") != std::string::npos);

  srv.simulateRequest(HTTP_GET, "/", "192.168.4.1");
  TEST_ASSERT_EQUAL_INT(200, srv.lastResponse().code);

  // Loop services DNS & HTTP in provisioning state
  boot.loop();
  TEST_ASSERT_GREATER_THAN_UINT32(0, mockDnsState().processCount);
  TEST_ASSERT_GREATER_THAN_UINT32(0, srv.handleClientCount());
}

void test_bootmanager_save_wifi_preserves_password_and_saves_custom_mdns() {
  // Pre-populate one saved WiFi network in NVS
  {
    Preferences prefs;
    prefs.begin("AchaemenidNet", false);
    prefs.putInt("wifiCount", 1);
    prefs.putString("ssid0", "HomeNet");
    prefs.putString("pass0", "SecretPass123");
    prefs.end();
  }

  StubNetworkManager net;
  net.shouldResolve = false; // Force fallback to provisioning portal
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

  TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(BootState::PROVISIONING), static_cast<uint8_t>(boot.getState()));

  // Submit form: keep HomeNet with blank password, add OfficeNet, set custom mDNS host
  auto& srv = boot.testServer();
  srv.simulateRequest(HTTP_POST, "/save", "achaemenid.local",
                      {{"ssid0", "HomeNet"},
                       {"pass0", ""},
                       {"ssid1", "OfficeNet"},
                       {"pass1", "OfficePass99"},
                       {"mdnsHost", "Living_Room.local"}});

  TEST_ASSERT_EQUAL_INT(200, srv.lastResponse().code);

  Preferences verify;
  verify.begin("AchaemenidNet", true);
  TEST_ASSERT_EQUAL_INT(2, verify.getInt("wifiCount", 0));
  TEST_ASSERT_EQUAL_STRING("HomeNet", verify.getString("ssid0", "").c_str());
  TEST_ASSERT_EQUAL_STRING("SecretPass123", verify.getString("pass0", "").c_str());
  TEST_ASSERT_EQUAL_STRING("OfficeNet", verify.getString("ssid1", "").c_str());
  TEST_ASSERT_EQUAL_STRING("OfficePass99", verify.getString("pass1", "").c_str());
  TEST_ASSERT_EQUAL_STRING("living-room", verify.getString("mdnsHost", "").c_str());
  verify.end();
}

void test_bootmanager_sta_connect_starts_mdns_http_and_ws() {
  {
    Preferences prefs;
    prefs.begin("AchaemenidNet", false);
    prefs.putInt("wifiCount", 1);
    prefs.putString("ssid0", "HomeNet");
    prefs.putString("pass0", "SecretPass123");
    prefs.end();
  }

  StubNetworkManager net;
  net.shouldResolve = true;
  PinManager pm;
  uniuno::Executor executor;
  uniuno::EventDispatcher eventBus;
  bool configLoaded = false;
  String rawPayload;

  static bool netOnlineEventReceived = false;
  netOnlineEventReceived = false;
  eventBus.on<NetworkStatusEvent>([](NetworkStatusEvent* evt) {
    if (evt != nullptr && evt->connected) netOnlineEventReceived = true;
  });

  BootManager boot;
  BootContext ctx{&net, &pm, &executor, &eventBus, nullptr, nullptr, &configLoaded, &rawPayload};
  boot.startBootSequenceAsync(ctx);
  mockHw().fakeMillis += 100;
  executor.poll();

  TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(BootState::DONE), static_cast<uint8_t>(boot.getState()));
  TEST_ASSERT_TRUE(netOnlineEventReceived);
  TEST_ASSERT_TRUE(mockMdnsState().started);
  TEST_ASSERT_EQUAL_STRING("achaemenid", mockMdnsState().hostname.c_str());
  TEST_ASSERT_EQUAL_UINT(2, mockMdnsState().services.size());
  TEST_ASSERT_EQUAL_STRING("http", mockMdnsState().services[0].service.c_str());
  TEST_ASSERT_EQUAL_UINT16(80, mockMdnsState().services[0].port);
  TEST_ASSERT_EQUAL_STRING("ws", mockMdnsState().services[1].service.c_str());
  TEST_ASSERT_EQUAL_UINT16(81, mockMdnsState().services[1].port);
}

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;
  UNITY_BEGIN();
  RUN_TEST(test_normalize_mdns_hostname_valid_and_case_folding);
  RUN_TEST(test_normalize_mdns_hostname_fallback_on_empty_or_invalid);
  RUN_TEST(test_build_mdns_fqdn_and_portal_url);
  RUN_TEST(test_captive_portal_probe_paths_detected_across_os);
  RUN_TEST(test_portal_host_matching_and_redirect_decision);
  RUN_TEST(test_wifi_credential_validation);
  RUN_TEST(test_json_and_html_escaping_safety);
  RUN_TEST(test_provisioning_idle_auto_retry_policy_and_wraparound);
  RUN_TEST(test_bootmanager_instant_captive_portal_dns_mdns_and_redirects);
  RUN_TEST(test_bootmanager_save_wifi_preserves_password_and_saves_custom_mdns);
  RUN_TEST(test_bootmanager_sta_connect_starts_mdns_http_and_ws);
  return UNITY_END();
}
