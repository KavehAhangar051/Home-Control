#include <unity.h>
#include <string.h>

#include "../../lib/AchaemenidBootManager/src/CaptivePortalHelper.h"

using namespace uniuno::captive_portal;

void setUp(void) {}
void tearDown(void) {}

void test_normalize_mdns_hostname_valid_and_case_folding() {
    char buf[64];
    TEST_ASSERT_EQUAL_UINT(10, normalizeMdnsHostname("Achaemenid", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("achaemenid", buf);

    TEST_ASSERT_EQUAL_UINT(12, normalizeMdnsHostname("  My_Node-01.local  ", buf, sizeof(buf)));
    TEST_ASSERT_EQUAL_STRING("my-node-01", buf);

    TEST_ASSERT_EQUAL_UINT(8, normalizeMdnsHostname("Room 2!!", buf, sizeof(buf)));
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
    TEST_ASSERT_TRUE(shouldRedirectToCaptivePortal(
        "connectivitycheck.gstatic.com", "/generate_204", kDefaultMdnsFqdn, kDefaultApIp));
    TEST_ASSERT_TRUE(shouldRedirectToCaptivePortal(
        "achaemenid.local", "/hotspot-detect.html", kDefaultMdnsFqdn, kDefaultApIp));

    // 2. Arbitrary external site on "/" -> redirect to http://achaemenid.local/
    TEST_ASSERT_TRUE(shouldRedirectToCaptivePortal(
        "example.com", "/", kDefaultMdnsFqdn, kDefaultApIp));

    // 3. Real portal host on "/" -> serve 200 OK (NO redirect loop!)
    TEST_ASSERT_FALSE(shouldRedirectToCaptivePortal(
        "achaemenid.local", "/", kDefaultMdnsFqdn, kDefaultApIp));
    TEST_ASSERT_FALSE(shouldRedirectToCaptivePortal(
        "192.168.4.1", "/", kDefaultMdnsFqdn, kDefaultApIp));
}

void test_wifi_credential_validation() {
    TEST_ASSERT_TRUE(isValidWifiCredential("MyHomeWiFi", "StrongPass123"));
    TEST_ASSERT_TRUE(isValidWifiCredential("OpenCafe", ""));
    TEST_ASSERT_TRUE(isValidWifiCredential("OpenCafe", nullptr));

    // Boundary lengths: 32-char SSID, 8-char and 63-char passwords
    TEST_ASSERT_TRUE(isValidWifiCredential("12345678901234567890123456789012", "12345678"));
    TEST_ASSERT_TRUE(isValidWifiCredential(
        "Net", "123456789012345678901234567890123456789012345678901234567890123"));

    // Invalid cases
    TEST_ASSERT_FALSE(isValidWifiCredential("", "12345678"));
    TEST_ASSERT_FALSE(isValidWifiCredential(nullptr, "12345678"));
    TEST_ASSERT_FALSE(isValidWifiCredential("123456789012345678901234567890123", "12345678")); // 33 bytes
    TEST_ASSERT_FALSE(isValidWifiCredential("MyWiFi", "1234567")); // 7 bytes (<8)
    TEST_ASSERT_FALSE(isValidWifiCredential(
        "MyWiFi", "1234567890123456789012345678901234567890123456789012345678901234")); // 64 bytes
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
    return UNITY_END();
}
