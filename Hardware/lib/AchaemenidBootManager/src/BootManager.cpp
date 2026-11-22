#include "BootManager.h"
#include <NetworkConfigHelper.h>
#include <Utilities/logging.h>
#include <ConfigApplier.h>
#include <AppEvents.h>
#include <AchaemenidWebSocketClient.h>
#include <Timer/Optimization/TimerAsm.h>
#include <Preferences.h>
#include <WiFi.h>
#include <ESPmDNS.h>

// In Arduino-ESP32 Core v3+, ESPmDNS.h wraps MDNSResponder and `extern MDNSResponder MDNS;`
// inside `#ifdef CONFIG_MDNS_MAX_INTERFACES` (which only includes <mdns.h> -> ESP_MDNS_H_ when active).
// Guard against environments where ESPmDNS.h is Core v3 while sdkconfig.h lacks CONFIG_MDNS_MAX_INTERFACES.
#if defined(UNIUNO_NATIVE_TEST)
  #define ACHAEMENID_MDNS_BACKEND_ARDUINO 1
#elif defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  #if defined(CONFIG_MDNS_MAX_INTERFACES)
    #define ACHAEMENID_MDNS_BACKEND_ARDUINO 1
  #elif defined(CONFIG_MDNS_MAX_SERVICES)
    #include <mdns.h>
    #define ACHAEMENID_MDNS_BACKEND_IDF 1
  #endif
#else
  #if defined(ESP_MDNS_H_)
    #define ACHAEMENID_MDNS_BACKEND_ARDUINO 1
  #elif defined(CONFIG_MDNS_MAX_SERVICES)
    #include <mdns.h>
    #define ACHAEMENID_MDNS_BACKEND_IDF 1
  #endif
#endif

namespace {

// Static SoftAP network configuration for deterministic captive portal DNS & gateway
const IPAddress kSoftApIp(192, 168, 4, 1);
const IPAddress kSoftApGateway(192, 168, 4, 1);
const IPAddress kSoftApSubnet(255, 255, 255, 0);

constexpr unsigned long kProvisioningIdleCheckIntervalMs = 1000UL;

} // namespace

BootManager::BootManager()
    : ctx_{},
      state_(BootState::CONNECT_WIFI),
      wifiFut_(uniuno::Future<void, void>::resolve()),
      fetchConfigStartTime_(0),
      lastReconnectAttempt_(0),
      provisioningLastActivityMs_(0),
      lastProvisioningIdleCheckMs_(0),
      provisioningServerStarted_(false),
      provisioningRoutesRegistered_(false),
      dnsServerStarted_(false),
      mdnsStarted_(false),
      hasSavedWifiNetworks_(false) {
    initMdnsIdentity();
}

void BootManager::initMdnsIdentity() {
    String customHost;
    Preferences prefs;
    if (prefs.begin("AchaemenidNet", true)) {
        customHost = prefs.getString("mdnsHost", "");
        prefs.end();
    }

    const char* rawHost = (customHost.length() > 0)
        ? customHost.c_str()
        : uniuno::captive_portal::kDefaultMdnsHostname;
    uniuno::captive_portal::normalizeMdnsHostname(rawHost, mdnsHostname_, sizeof(mdnsHostname_));
    uniuno::captive_portal::buildMdnsFqdn(mdnsHostname_, mdnsFqdn_, sizeof(mdnsFqdn_));
    uniuno::captive_portal::buildPortalUrl(mdnsHostname_, portalUrl_, sizeof(portalUrl_));
}

void BootManager::refreshMdnsIdentity() {
    char prevHostname[33];
    uniuno::net_config::copySafeString(prevHostname, sizeof(prevHostname), mdnsHostname_);
    initMdnsIdentity();
    if (strcmp(prevHostname, mdnsHostname_) != 0 && mdnsStarted_) {
        startMdnsResponder(state_ == BootState::PROVISIONING);
    }
}

bool BootManager::startMdnsResponder(bool apMode) {
#if defined(ACHAEMENID_MDNS_BACKEND_ARDUINO)
    if (mdnsStarted_) {
        MDNS.end();
        mdnsStarted_ = false;
    }

    if (!MDNS.begin(mdnsHostname_)) {
        WARNINGF("[mDNS] Failed to start mDNS responder for '%s'.", mdnsFqdn_);
        return false;
    }

    mdnsStarted_ = true;
    MDNS.setInstanceName(apMode ? "Achaemenid Wi-Fi Setup" : "Achaemenid IoT Node");
    MDNS.addService("http", "tcp", 80);
    if (!apMode) {
        MDNS.addService("ws", "tcp", 81);
    }

    INFOF("[mDNS] Responder active at %s (%s mode)", portalUrl_, apMode ? "AP" : "STA");
    return true;
#elif defined(ACHAEMENID_MDNS_BACKEND_IDF)
    if (mdnsStarted_) {
        mdns_free();
        mdnsStarted_ = false;
    }

    if (mdns_init() != ESP_OK || mdns_hostname_set(mdnsHostname_) != ESP_OK) {
        WARNINGF("[mDNS] Failed to start ESP-IDF mDNS responder for '%s'.", mdnsFqdn_);
        return false;
    }

    mdnsStarted_ = true;
    mdns_instance_name_set(apMode ? "Achaemenid Wi-Fi Setup" : "Achaemenid IoT Node");
    mdns_service_add(nullptr, "_http", "_tcp", 80, nullptr, 0);
    if (!apMode) {
        mdns_service_add(nullptr, "_ws", "_tcp", 81, nullptr, 0);
    }

    INFOF("[mDNS] ESP-IDF responder active at %s (%s mode)", portalUrl_, apMode ? "AP" : "STA");
    return true;
#else
    (void)apMode;
    WARNINGF("[mDNS] ESPmDNS disabled in current sdkconfig (CONFIG_MDNS_MAX_INTERFACES missing); Captive Portal DNS still resolves %s.", mdnsFqdn_);
    return false;
#endif
}

void BootManager::stopMdnsResponder() {
#if defined(ACHAEMENID_MDNS_BACKEND_ARDUINO)
    if (mdnsStarted_) {
        MDNS.end();
        mdnsStarted_ = false;
    }
#elif defined(ACHAEMENID_MDNS_BACKEND_IDF)
    if (mdnsStarted_) {
        mdns_free();
        mdnsStarted_ = false;
    }
#else
    mdnsStarted_ = false;
#endif
}

bool BootManager::hasSavedWifiCredentials() const {
    Preferences prefs;
    if (!prefs.begin("AchaemenidNet", true)) {
        return false;
    }
    int count = prefs.getInt("wifiCount", 0);
    if (count > 5) count = 5;
    bool hasValid = false;
    char keyBuf[16];
    for (int i = 0; i < count; ++i) {
        snprintf(keyBuf, sizeof(keyBuf), "ssid%d", i);
        String ssid = prefs.getString(keyBuf, "");
        ssid.trim();
        if (ssid.length() > 0) {
            hasValid = true;
            break;
        }
    }
    prefs.end();
    return hasValid;
}

void BootManager::touchProvisioningActivity() {
    provisioningLastActivityMs_ = millis();
}

void BootManager::beginWifiConnectAttempt(bool initialBoot) {
    if (!networkReady_ || ctx_.network == nullptr) return;

    WiFi.setHostname(mdnsHostname_);
    state_ = initialBoot ? BootState::CONNECT_WIFI : BootState::RECONNECTING;
    wifiFut_ = ctx_.network->connectAsync();

    if (bootTaskHandle_) {
        bootTaskHandle_.cancel();
    }
    auto bootFuture = uniuno::create_future([this]() { return this->bootPollFn(); });
    bootTaskHandle_ = ctx_.executor->executeInterval(
        bootFuture, 50, [this](uniuno::Error e) { this->bootErrorFn(e); });
}

uniuno::AsyncResult<void> BootManager::bootPollFn() {
    if (state_ == BootState::PROVISIONING) {
        if (dnsServerStarted_) {
            dnsServer_.processNextRequest();
        }
        provisioningServer_.handleClient();
        return uniuno::AsyncResult<void>::pending();
    }

    if (state_ == BootState::CONNECT_WIFI || state_ == BootState::RECONNECTING) {
        auto res = wifiFut_.poll();
        if (UNLIKELY(res.is_rejected())) {
            if (state_ == BootState::CONNECT_WIFI) {
                // Initial boot (or idle AP auto-recovery): all saved APs failed -> launch Captive Portal AP
                WARNING("[Boot] Saved WiFi networks failed. Starting Captive Portal provisioning AP.");
                startProvisioningPortal();
                return uniuno::AsyncResult<void>::pending();
            } else {
                // Runtime disconnect: temporary router drop. Do NOT plunge into setup AP!
                WARNING("[Network] Reconnection attempt failed. Will retry saved networks.");
                state_ = BootState::DONE; // Reset state so loop() can retry after backoff
                return uniuno::AsyncResult<void>::resolve();
            }
        }
        if (LIKELY(res.is_resolved())) {
            IPAddress ip = WiFi.localIP();
            INFOF("[Boot] WiFi connected (IP: %d.%d.%d.%d). Starting mDNS & network services.",
                  ip[0], ip[1], ip[2], ip[3]);
            startMdnsResponder(false);
            NetworkStatusEvent netEvt{true};
            ctx_.eventBus->dispatch(netEvt);
            state_ = BootState::DONE;
            return uniuno::AsyncResult<void>::resolve();
        }
    }
    return uniuno::AsyncResult<void>::pending();
}

void BootManager::restartFn() {
    ESP.restart();
}

void BootManager::bootErrorFn(uniuno::Error e) {
    ERRORF("[Boot] Critical Failure: %s. Restarting in 5s...", (const char*)e);
    if (ctx_.appTimer != nullptr) {
        ctx_.appTimer->setTimeout(uniuno::makeStaticFunction(&BootManager::restartFn), 5000);
    } else {
        delay(5000);
        ESP.restart();
    }
}

void BootManager::sendCaptiveRedirect() {
    provisioningServer_.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    provisioningServer_.sendHeader("Pragma", "no-cache");
    provisioningServer_.sendHeader("Expires", "-1");
    provisioningServer_.sendHeader("Location", portalUrl_, true);
    provisioningServer_.send(302, "text/plain", "");
}

void BootManager::handlePortalRoot() {
    touchProvisioningActivity();

    String host = provisioningServer_.hostHeader();
    String uri = provisioningServer_.uri();
    if (uniuno::captive_portal::shouldRedirectToCaptivePortal(
            host.c_str(), uri.c_str(), mdnsFqdn_, uniuno::captive_portal::kDefaultApIp)) {
        sendCaptiveRedirect();
        return;
    }

    // Load previously saved SSIDs (read-only) so the user can see/edit them cleanly
    String savedSsids[5];
    int savedCount = 0;
    Preferences prefs;
    if (prefs.begin("AchaemenidNet", true)) {
        savedCount = prefs.getInt("wifiCount", 0);
        if (savedCount > 5) savedCount = 5;
        char keyBuf[16];
        for (int i = 0; i < savedCount; ++i) {
            snprintf(keyBuf, sizeof(keyBuf), "ssid%d", i);
            savedSsids[i] = prefs.getString(keyBuf, "");
        }
        prefs.end();
    }

    char escapedBuf[192];
    String html;
    html.reserve(6144);
    html += F("<!doctype html><html lang='fa' dir='rtl'><head>"
              "<meta charset='utf-8'>"
              "<meta name='viewport' content='width=device-width,initial-scale=1'>"
              "<title>تنظیمات وای‌فای هخامنشی</title>"
              "<style>"
              ":root{--bg:#0f172a;--card:#1e293b;--border:#334155;--text:#f8fafc;--muted:#94a3b8;--accent:#38bdf8;--accent2:#0284c7;--ok:#22c55e;}"
              "*{box-sizing:border-box}"
              "body{margin:0;padding:18px 12px 36px;font:15px/1.6 system-ui,-apple-system,Segoe UI,Tahoma,sans-serif;background:var(--bg);color:var(--text)}"
              "main{max-width:560px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;box-shadow:0 16px 40px rgba(0,0,0,.35)}"
              "h1{margin:0 0 6px;font-size:20px}"
              ".sub{margin:0 0 16px;color:var(--muted);font-size:13px}"
              ".meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;font-size:12px;color:var(--muted)}"
              ".tag{background:#0f172a;border:1px solid var(--border);border-radius:8px;padding:5px 10px;direction:ltr}"
              ".scan-box{background:#0f172a;border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:18px}"
              ".row{display:flex;justify-content:space-between;align-items:center;gap:8px}"
              ".btn{cursor:pointer;border:0;border-radius:9px;padding:10px 14px;font-size:14px;font-weight:600;color:#fff;background:var(--accent2)}"
              ".btn:disabled{opacity:.6;cursor:wait}"
              ".btn-full{width:100%;padding:13px;font-size:15px;margin-top:8px;background:linear-gradient(135deg,#0284c7,#0ea5e9)}"
              ".net-list{margin-top:10px;display:grid;gap:6px;max-height:220px;overflow:auto}"
              ".net-item{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-radius:8px;background:#1e293b;border:1px solid var(--border);cursor:pointer;text-align:left;color:var(--text);width:100%}"
              ".net-item:hover{border-color:var(--accent)}"
              ".net-ssid{font-weight:600;direction:ltr;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%}"
              ".net-rssi{font-size:12px;color:var(--muted);direction:ltr}"
              ".slot{border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px;background:#162032}"
              ".slot-title{font-size:13px;font-weight:700;color:var(--accent);margin:0 0 8px}"
              "label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}"
              "input{width:100%;padding:10px 11px;margin-bottom:10px;border-radius:8px;border:1px solid var(--border);background:#0f172a;color:var(--text);font-size:14px;direction:ltr}"
              "input:focus{outline:none;border-color:var(--accent)}"
              ".hint{font-size:12px;color:var(--muted);margin:6px 0 0}"
              "</style></head><body><main>"
              "<h1>مدیریت وای‌فای دستگاه</h1>"
              "<p class='sub'>تا ۵ شبکه وای‌فای وارد کنید؛ ESP32 به‌صورت خودکار به اولین شبکه در دسترس متصل می‌شود.</p>"
              "<div class='meta'><span class='tag'>");

    size_t pos = 0;
    uniuno::captive_portal::appendHtmlEscaped(escapedBuf, sizeof(escapedBuf), pos, portalUrl_);
    html += escapedBuf;
    html += F("</span><span class='tag'>AP: ");

    pos = 0;
    uniuno::captive_portal::appendHtmlEscaped(escapedBuf, sizeof(escapedBuf), pos, apSsid_.c_str());
    html += escapedBuf;
    html += F("</span></div>"
              "<div class='scan-box'>"
              "<div class='row'><strong style='font-size:14px'>شبکه‌های وای‌فای اطراف</strong>"
              "<button type='button' id='scanBtn' class='btn' onclick='scanWifi()'>اسکن شبکه‌ها</button></div>"
              "<div id='scanStatus' class='hint'>برای مشاهده شبکه‌های نزدیک، روی «اسکن شبکه‌ها» بزنید و روی نام شبکه کلیک کنید.</div>"
              "<div id='netList' class='net-list'></div></div>"
              "<form method='POST' action='/save'>");

    for (int i = 0; i < 5; ++i) {
        char numBuf[8];
        snprintf(numBuf, sizeof(numBuf), "%d", i);
        html += F("<div class='slot'><div class='slot-title'>شبکه ");
        html += (i + 1);
        html += F("</div><label for='ssid");
        html += numBuf;
        html += F("'>نام شبکه (SSID)</label><input id='ssid");
        html += numBuf;
        html += F("' name='ssid");
        html += numBuf;
        html += F("' maxlength='32' autocomplete='off' placeholder='MyWiFi' value='");
        if (savedSsids[i].length() > 0) {
            pos = 0;
            uniuno::captive_portal::appendHtmlEscaped(
                escapedBuf, sizeof(escapedBuf), pos, savedSsids[i].c_str());
            html += escapedBuf;
        }
        html += F("'><label for='pass");
        html += numBuf;
        html += F("'>رمز عبور (خالی برای شبکه باز، یا حداقل ۸ کاراکتر)</label><input id='pass");
        html += numBuf;
        html += F("' name='pass");
        html += numBuf;
        html += F("' type='password' maxlength='63' autocomplete='new-password' placeholder='••••••••'></div>");
    }

    html += F("<div class='slot'><div class='slot-title'>نام محلی دستگاه (mDNS)</div>"
              "<label for='mdnsHost'>آدرس محلی (بدون .local — پیش‌فرض: achaemenid)</label>"
              "<input id='mdnsHost' name='mdnsHost' maxlength='32' autocomplete='off' placeholder='achaemenid' value='");
    pos = 0;
    uniuno::captive_portal::appendHtmlEscaped(escapedBuf, sizeof(escapedBuf), pos, mdnsHostname_);
    html += escapedBuf;
    html += F("'><div class='hint'>پس از اتصال، دستگاه از طریق <code>http://&lt;name&gt;.local/</code> در دسترس خواهد بود.</div></div>"
              "<button type='submit' class='btn btn-full'>ذخیره و اتصال به وای‌فای</button>"
              "</form>"
              "<script>");
    html += F("function fillSsid(name){"
              "for(var i=0;i<5;i++){var el=document.getElementById('ssid'+i);if(el&&el.value.trim()===''){el.value=name;document.getElementById('pass'+i).focus();return;}}"
              "var f=document.getElementById('ssid0');if(f){f.value=name;document.getElementById('pass0').focus();}}"
              "function scanWifi(){"
              "var btn=document.getElementById('scanBtn'),st=document.getElementById('scanStatus'),list=document.getElementById('netList');"
              "btn.disabled=true;st.textContent='در حال جستجوی شبکه‌های وای‌فای...';list.innerHTML='';"
              "fetch('/scan').then(function(r){return r.json();}).then(function(d){"
              "btn.disabled=false;if(!d.networks||!d.networks.length){st.textContent='هیچ شبکه‌ای پیدا نشد.';return;}"
              "st.textContent=d.networks.length+' شبکه پیدا شد؛ برای انتخاب روی نام آن کلیک کنید:';"
              "d.networks.forEach(function(n){"
              "var b=document.createElement('button');b.type='button';b.className='net-item';"
              "b.onclick=function(){fillSsid(n.ssid);};"
              "var s1=document.createElement('span');s1.className='net-ssid';s1.textContent=n.ssid;"
              "var s2=document.createElement('span');s2.className='net-rssi';s2.textContent=(n.open?'Open ':'WPA ')+n.rssi+' dBm';"
              "b.appendChild(s1);b.appendChild(s2);list.appendChild(b);});"
              "}).catch(function(){btn.disabled=false;st.textContent='خطا در اسکن شبکه‌ها. دوباره تلاش کنید.';});}"
              "</script></main></body></html>");

    provisioningServer_.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    provisioningServer_.send(200, "text/html; charset=utf-8", html);
}

void BootManager::handleWifiScan() {
    touchProvisioningActivity();

    int n = WiFi.scanNetworks(false, false);
    if (n < 0) n = 0;

    // Deduplicate by SSID keeping strongest RSSI (max 15 entries to keep heap small)
    struct ScanEntry {
        String ssid;
        int32_t rssi = 0;
        bool open = false;
    };
    ScanEntry entries[15];
    int count = 0;

    for (int i = 0; i < n; ++i) {
        String ssid = WiFi.SSID(i);
        ssid.trim();
        if (ssid.length() == 0) continue;
        int32_t rssi = WiFi.RSSI(i);
        bool isOpen = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN);

        int existingIdx = -1;
        for (int j = 0; j < count; ++j) {
            if (entries[j].ssid == ssid) {
                existingIdx = j;
                break;
            }
        }
        if (existingIdx >= 0) {
            if (rssi > entries[existingIdx].rssi) {
                entries[existingIdx].rssi = rssi;
                entries[existingIdx].open = isOpen;
            }
        } else if (count < 15) {
            entries[count++] = {ssid, rssi, isOpen};
        }
    }
    WiFi.scanDelete();

    // Sort strongest signal first (simple insertion sort on <=15 items)
    for (int i = 1; i < count; ++i) {
        ScanEntry key = entries[i];
        int j = i - 1;
        while (j >= 0 && entries[j].rssi < key.rssi) {
            entries[j + 1] = entries[j];
            --j;
        }
        entries[j + 1] = key;
    }

    String json;
    json.reserve(1024);
    json += F("{\"networks\":[");
    char escaped[128];
    for (int i = 0; i < count; ++i) {
        if (i > 0) json += ',';
        size_t pos = 0;
        uniuno::captive_portal::appendJsonEscaped(
            escaped, sizeof(escaped), pos, entries[i].ssid.c_str());
        json += F("{\"ssid\":\"");
        json += escaped;
        json += F("\",\"rssi\":");
        json += entries[i].rssi;
        json += F(",\"open\":");
        json += entries[i].open ? F("true") : F("false");
        json += '}';
    }
    json += F("]}");

    provisioningServer_.sendHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    provisioningServer_.send(200, "application/json; charset=utf-8", json);
}

void BootManager::handlePortalStatus() {
    touchProvisioningActivity();
    char escapedAp[128];
    size_t pos = 0;
    uniuno::captive_portal::appendJsonEscaped(escapedAp, sizeof(escapedAp), pos, apSsid_.c_str());

    String json;
    json.reserve(256);
    json += F("{\"mode\":\"provisioning\",\"mdns\":\"");
    json += mdnsFqdn_;
    json += F("\",\"url\":\"");
    json += portalUrl_;
    json += F("\",\"apSsid\":\"");
    json += escapedAp;
    json += F("\",\"ip\":\"");
    json += WiFi.softAPIP().toString();
    json += F("\",\"clients\":");
    json += static_cast<int>(WiFi.softAPgetStationNum());
    json += '}';

    provisioningServer_.sendHeader("Cache-Control", "no-store");
    provisioningServer_.send(200, "application/json; charset=utf-8", json);
}

void BootManager::handleSaveWifi() {
    touchProvisioningActivity();

    // Load previously saved credentials so leaving password blank on an existing SSID preserves it
    String prevSsids[5];
    String prevPasses[5];
    int prevCount = 0;
    {
        Preferences readPrefs;
        if (readPrefs.begin("AchaemenidNet", true)) {
            prevCount = readPrefs.getInt("wifiCount", 0);
            if (prevCount > 5) prevCount = 5;
            char prevKey[16];
            for (int i = 0; i < prevCount; ++i) {
                snprintf(prevKey, sizeof(prevKey), "ssid%d", i);
                prevSsids[i] = readPrefs.getString(prevKey, "");
                snprintf(prevKey, sizeof(prevKey), "pass%d", i);
                prevPasses[i] = readPrefs.getString(prevKey, "");
            }
            readPrefs.end();
        }
    }

    String ssids[5];
    String passwords[5];
    int count = 0;

    char keyBuf[16];
    for (int i = 0; i < 5; ++i) {
        snprintf(keyBuf, sizeof(keyBuf), "ssid%d", i);
        String ssid = provisioningServer_.arg(keyBuf);
        snprintf(keyBuf, sizeof(keyBuf), "pass%d", i);
        String password = provisioningServer_.arg(keyBuf);
        ssid.trim();
        if (ssid.length() == 0) continue;

        if (password.length() == 0) {
            for (int j = 0; j < prevCount; ++j) {
                if (prevSsids[j] == ssid && prevPasses[j].length() > 0) {
                    password = prevPasses[j];
                    break;
                }
            }
        }

        if (!uniuno::captive_portal::isValidWifiCredential(ssid.c_str(), password.c_str())) {
            provisioningServer_.send(
                400,
                "text/html; charset=utf-8",
                "<!doctype html><html lang='fa' dir='rtl'><meta charset='utf-8'>"
                "<body style='font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc'>"
                "<h2>خطا در اطلاعات شبکه</h2>"
                "<p>طول نام شبکه (حداکثر ۳۲ کاراکتر) یا رمز عبور (خالی یا بین ۸ تا ۶۳ کاراکتر) نامعتبر است.</p>"
                "<p><a href='/' style='color:#38bdf8'>بازگشت به فرم</a></p></body></html>");
            return;
        }
        ssids[count] = ssid;
        passwords[count] = password;
        ++count;
    }

    if (count == 0) {
        provisioningServer_.send(
            400,
            "text/html; charset=utf-8",
            "<!doctype html><html lang='fa' dir='rtl'><meta charset='utf-8'>"
            "<body style='font-family:sans-serif;padding:24px;background:#0f172a;color:#f8fafc'>"
            "<h2>حداقل یک شبکه وارد کنید</h2>"
            "<p><a href='/' style='color:#38bdf8'>بازگشت به فرم</a></p></body></html>");
        return;
    }

    Preferences prefs;
    if (!prefs.begin("AchaemenidNet", false)) {
        provisioningServer_.send(500, "text/plain; charset=utf-8", "Could not open network storage.");
        return;
    }

    String rawMdns = provisioningServer_.arg("mdnsHost");
    rawMdns.trim();
    if (rawMdns.length() > 0) {
        char cleanMdns[33];
        uniuno::captive_portal::normalizeMdnsHostname(rawMdns.c_str(), cleanMdns, sizeof(cleanMdns));
        prefs.putString("mdnsHost", cleanMdns);
    }

    prefs.putInt("wifiCount", count);
    for (int i = 0; i < count; ++i) {
        snprintf(keyBuf, sizeof(keyBuf), "ssid%d", i);
        prefs.putString(keyBuf, ssids[i]);
        snprintf(keyBuf, sizeof(keyBuf), "pass%d", i);
        prefs.putString(keyBuf, passwords[i]);
    }
    for (int i = count; i < 5; ++i) {
        snprintf(keyBuf, sizeof(keyBuf), "ssid%d", i);
        prefs.remove(keyBuf);
        snprintf(keyBuf, sizeof(keyBuf), "pass%d", i);
        prefs.remove(keyBuf);
    }
    prefs.end();

    INFOF("[Provisioning] Saved %d Wi-Fi network(s) to NVS. Restarting...", count);

    provisioningServer_.sendHeader("Cache-Control", "no-store");
    provisioningServer_.send(
        200,
        "text/html; charset=utf-8",
        "<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>تنظیمات ذخیره شد</title></head>"
        "<body style='font-family:system-ui,sans-serif;padding:28px;background:#0f172a;color:#f8fafc;text-align:center'>"
        "<h2 style='color:#22c55e'>تنظیمات وای‌فای با موفقیت ذخیره شد</h2>"
        "<p>دستگاه در حال راه‌اندازی مجدد و اتصال به شبکه وای‌فای شماست...</p>"
        "</body></html>");

    if (ctx_.appTimer != nullptr) {
        ctx_.appTimer->setTimeout(uniuno::makeStaticFunction(&BootManager::restartFn), 600);
    } else {
        delay(350);
        ESP.restart();
    }
}

void BootManager::registerCaptivePortalRoutes() {
    if (provisioningRoutesRegistered_) return;

    provisioningServer_.on("/", HTTP_GET, [this]() { this->handlePortalRoot(); });
    provisioningServer_.on("/scan", HTTP_GET, [this]() { this->handleWifiScan(); });
    provisioningServer_.on("/status", HTTP_GET, [this]() { this->handlePortalStatus(); });
    provisioningServer_.on("/save", HTTP_POST, [this]() { this->handleSaveWifi(); });
    provisioningServer_.on("/favicon.ico", HTTP_GET, [this]() {
        provisioningServer_.send(204, "text/plain", "");
    });

    // Explicit OS Captive Portal connectivity probes (Android, iOS/macOS, Windows, Firefox/Linux)
    auto probeHandler = [this]() {
        this->touchProvisioningActivity();
        this->sendCaptiveRedirect();
    };
    provisioningServer_.on("/generate_204", HTTP_ANY, probeHandler);
    provisioningServer_.on("/gen_204", HTTP_ANY, probeHandler);
    provisioningServer_.on("/hotspot-detect.html", HTTP_ANY, probeHandler);
    provisioningServer_.on("/library/test/success.html", HTTP_ANY, probeHandler);
    provisioningServer_.on("/success.html", HTTP_ANY, probeHandler);
    provisioningServer_.on("/connecttest.txt", HTTP_ANY, probeHandler);
    provisioningServer_.on("/ncsi.txt", HTTP_ANY, probeHandler);
    provisioningServer_.on("/redirect", HTTP_ANY, probeHandler);
    provisioningServer_.on("/fwlink", HTTP_ANY, probeHandler);
    provisioningServer_.on("/canonical.html", HTTP_ANY, probeHandler);
    provisioningServer_.on("/success.txt", HTTP_ANY, probeHandler);
    provisioningServer_.on("/check_network_status.txt", HTTP_ANY, probeHandler);

    // Catch-all: redirect any unknown path or hijacked domain straight to http://achaemenid.local/
    provisioningServer_.onNotFound([this]() {
        this->touchProvisioningActivity();
        this->sendCaptiveRedirect();
    });

    provisioningRoutesRegistered_ = true;
}

void BootManager::startProvisioningPortal() {
    if (provisioningServerStarted_) return;
    if (bootTaskHandle_) {
        bootTaskHandle_.cancel();
    }

    stopMdnsResponder();

    WiFi.disconnect(false, false);
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAPsetHostname(mdnsHostname_);
    if (!WiFi.softAPConfig(kSoftApIp, kSoftApGateway, kSoftApSubnet)) {
        WARNING("[Provisioning] WiFi.softAPConfig returned false; continuing with default AP IP.");
    }

    String mac = WiFi.macAddress();
    mac.replace(":", "");
    String suffix = mac.substring(mac.length() > 6 ? mac.length() - 6 : 0);
    String defaultApSsid = "Achaemenid-" + suffix;
    String defaultApPassword = "Setup-" + suffix;
    apSsid_ = defaultApSsid;
    String apPassword = defaultApPassword;

    Preferences apPrefs;
    if (apPrefs.begin("AchaemenidNet", true)) {
        if (apPrefs.getBool("apConfigured", false)) {
            String customSsid = apPrefs.getString("apSsid", "");
            String customPass = apPrefs.getString("apPass", "");
            if (uniuno::net_config::isValidSoftApCredential(customSsid.c_str(), customPass.c_str())) {
                apSsid_ = customSsid;
                apPassword = customPass;
            } else {
                WARNING("[Provisioning] Stored custom AP credentials in NVS are invalid; falling back to default MAC AP.");
            }
        }
        apPrefs.end();
    }

    if (!WiFi.softAP(apSsid_.c_str(), apPassword.c_str())) {
        if (apSsid_ != defaultApSsid) {
            WARNING("[Provisioning] Custom softAP failed; retrying with default MAC AP.");
            apSsid_ = defaultApSsid;
            apPassword = defaultApPassword;
            if (!WiFi.softAP(apSsid_.c_str(), apPassword.c_str())) {
                ERROR("[Provisioning] Could not start setup access point.");
                return;
            }
        } else {
            ERROR("[Provisioning] Could not start setup access point.");
            return;
        }
    }

    // Start wildcard DNS server (UDP 53) so every OS captive check & achaemenid.local resolve to AP IP
    dnsServer_.setErrorReplyCode(DNSReplyCode::NoError);
    dnsServer_.setTTL(uniuno::captive_portal::kDnsTtlSeconds);
    dnsServerStarted_ = dnsServer_.start(
        uniuno::captive_portal::kDnsPort, "*", WiFi.softAPIP());
    if (!dnsServerStarted_) {
        WARNING("[Provisioning] Failed to start Captive Portal DNS server on UDP/53.");
    }

    // Start ESPmDNS responder so mDNS-capable clients (iOS/macOS/Windows/Android) resolve achaemenid.local
    startMdnsResponder(true);

    registerCaptivePortalRoutes();
    provisioningServer_.begin();
    provisioningServerStarted_ = true;
    state_ = BootState::PROVISIONING;

    touchProvisioningActivity();
    lastProvisioningIdleCheckMs_ = provisioningLastActivityMs_;

    INFOF("[Provisioning] Access point '%s' started. Captive Portal active at %s (%s)",
          apSsid_.c_str(), portalUrl_, WiFi.softAPIP().toString().c_str());
}

void BootManager::stopProvisioningPortal() {
    if (dnsServerStarted_) {
        dnsServer_.stop();
        dnsServerStarted_ = false;
    }
    if (provisioningServerStarted_) {
        provisioningServer_.stop();
        provisioningServerStarted_ = false;
    }
    stopMdnsResponder();
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
}

/**
 * @brief High-performance non-blocking loop for network monitoring and provisioning.
 * Uses 4-cycle Xtensa CCOUNT hardware throttle (500ms) — zero millis() calls while connected!
 */
HOT_PATH void BootManager::loop() {
    if (UNLIKELY(state_ == BootState::PROVISIONING)) {
        if (dnsServerStarted_) {
            dnsServer_.processNextRequest();
        }
        provisioningServer_.handleClient();

        const unsigned long now = millis();
        if (static_cast<unsigned long>(now - lastProvisioningIdleCheckMs_) >= kProvisioningIdleCheckIntervalMs) {
            lastProvisioningIdleCheckMs_ = now;
            const uint8_t clients = static_cast<uint8_t>(WiFi.softAPgetStationNum());
            if (clients > 0) {
                provisioningLastActivityMs_ = now;
            } else if (uniuno::captive_portal::shouldAutoRetrySavedWifiFromProvisioning(
                           hasSavedWifiNetworks_,
                           clients,
                           now,
                           provisioningLastActivityMs_,
                           uniuno::captive_portal::kDefaultProvisioningIdleRetryMs)) {
                INFO("[Provisioning] No clients connected for 3m. Retrying saved Wi-Fi networks...");
                stopProvisioningPortal();
                beginWifiConnectAttempt(true);
            }
        }
        return;
    }

    if (UNLIKELY(state_ != BootState::DONE || !networkReady_)) return;

    // 4-cycle CCOUNT hardware throttle: check WiFi status once every 500ms without calling millis()
    if (LIKELY(!uniuno::asm_opt::is_cycle_interval_elapsed(
            lastConnectedCheckCycle_, uniuno::asm_opt::ms_to_cycles(500)))) {
        return;
    }

    if (LIKELY(ctx_.network->isConnected())) return;

    const unsigned long now = millis();
    if (!uniuno::asm_opt::is_timer_expired(now, lastReconnectAttempt_ + 5000)) return;

    lastReconnectAttempt_ = now;
    WARNING("[Network] WiFi disconnected. Retrying saved networks.");
    beginWifiConnectAttempt(false);
}

/**
 * @brief Loads NVS segments using static storage so the ~4.2KB ParseResult
 * buffer never consumes loopTask stack before esp_wifi_init() runs.
 */
__attribute__((noinline)) void BootManager::loadOfflineConfigFromNvs() {
    INFO("[Boot] Booting up... Loading config from NVS immediately.");
    static ParseResult nvsResult;
    nvsResult.reset();
    if (ctx_.segmentStorage != nullptr && ctx_.segmentStorage->loadSegmentConfig(nvsResult)) {
        int applied = ConfigApplier::apply(nvsResult, ctx_.pinManager);
        ctx_.pinManager->printStatus();
        *(ctx_.configLoadedFlag) = true;

        Serial.println("==========================================");
        Serial.println("  Instant Boot — Config loaded from NVS   ");
        Serial.println("==========================================");

        ConfigLoadedEvent evt;
        evt.pinCount = applied;
        ctx_.eventBus->dispatch(evt);
    } else {
        WARNING("[Boot] NVS empty or storage unavailable. No configuration loaded. Please push config.");
    }
}

void BootManager::startBootSequenceAsync(const BootContext& ctx) {
    ctx_ = ctx;
    networkReady_ = (ctx_.network != nullptr);

    initMdnsIdentity();

    // بارگذاری بلافاصله تنظیمات از NVS در یک فریم استک مجزا (آزادسازی ۴.۵KB استک قبل از راه‌اندازی WiFi)
    loadOfflineConfigFromNvs();

    hasSavedWifiNetworks_ = hasSavedWifiCredentials();
    if (!hasSavedWifiNetworks_) {
        WARNING("[BootManager] No saved WiFi networks in NVS. Launching Captive Portal immediately.");
        startProvisioningPortal();
        return;
    }

    INFOF("[BootManager] Starting WiFi connection (mDNS hostname: %s)...", mdnsFqdn_);
    beginWifiConnectAttempt(true);
}
