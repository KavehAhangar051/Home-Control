#include "BootManager.h"
#include <Utilities/logging.h>
#include <ConfigApplier.h>
#include <AppEvents.h>
#include <AchaemenidWebSocketClient.h>
#include <Preferences.h>
#include <WiFi.h>

BootManager::BootManager() 
    : state_(BootState::CONNECT_WIFI),
      wifiFut_(uniuno::Future<void, void>::resolve()),
      fetchConfigStartTime_(0),
      lastReconnectAttempt_(0),
      provisioningServerStarted_(false) 
{}

uniuno::AsyncResult<void> BootManager::bootPollFn() {
    if (state_ == BootState::PROVISIONING) {
        provisioningServer_.handleClient();
        return uniuno::AsyncResult<void>::pending();
    }

    if (state_ == BootState::CONNECT_WIFI || state_ == BootState::RECONNECTING) {
        auto res = wifiFut_.poll();
        if (UNLIKELY(res.is_rejected())) {
            WARNING("[Boot] Saved WiFi networks failed. Starting local provisioning AP.");
            startProvisioningPortal();
            return uniuno::AsyncResult<void>::pending();
        }
        if (LIKELY(res.is_resolved())) {
            INFO("[Boot] WiFi connected. Starting/restarting network services.");
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

void BootManager::startProvisioningPortal() {
    if (provisioningServerStarted_) return;

    WiFi.mode(WIFI_AP_STA);
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    String suffix = mac.substring(mac.length() > 6 ? mac.length() - 6 : 0);
    String apSsid = "Achaemenid-" + suffix;
    String apPassword = "Setup-" + suffix;
    Preferences apPrefs;
    if (apPrefs.begin("AchaemenidNet", true)) {
        if (apPrefs.getBool("apConfigured", false)) {
            apSsid = apPrefs.getString("apSsid", apSsid);
            apPassword = apPrefs.getString("apPass", apPassword);
        }
        apPrefs.end();
    }

    if (!WiFi.softAP(apSsid.c_str(), apPassword.c_str())) {
        ERROR("[Provisioning] Could not start setup access point.");
        return;
    }

    provisioningServer_.on("/", HTTP_GET, [this]() {
        String html =
            "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<meta charset='utf-8'><title>Achaemenid Wi-Fi Setup</title>"
            "<style>body{font:16px Arial;max-width:560px;margin:30px auto;padding:0 16px;background:#f5f6f8}"
            "main{background:white;padding:22px;border-radius:12px}input{box-sizing:border-box;width:100%;padding:11px;margin:6px 0 14px}"
            "button{padding:12px 20px;background:#1769aa;color:white;border:0;border-radius:7px}</style></head><body>"
            "<main><h2>Wi-Fi setup</h2><p>Enter up to five networks. The ESP32 selects an available saved network.</p>"
            "<form method='POST' action='/save'>";
        for (int i = 0; i < 5; ++i) {
            html += "<h3>Network " + String(i + 1) + "</h3>";
            html += "<label>SSID</label><input name='ssid" + String(i) + "' maxlength='32' autocomplete='off'>";
            html += "<label>Password</label><input name='pass" + String(i) + "' type='password' maxlength='63' autocomplete='new-password'>";
        }
        html += "<button type='submit'>Save and connect</button></form></main></body></html>";
        provisioningServer_.send(200, "text/html; charset=utf-8", html);
    });

    provisioningServer_.on("/save", HTTP_POST, [this]() {
        String ssids[5];
        String passwords[5];
        int count = 0;

        for (int i = 0; i < 5; ++i) {
            String ssid = provisioningServer_.arg("ssid" + String(i));
            String password = provisioningServer_.arg("pass" + String(i));
            ssid.trim();
            if (ssid.length() == 0) continue;
            if (ssid.length() > 32 || password.length() > 63 ||
                (password.length() > 0 && password.length() < 8)) {
                provisioningServer_.send(400, "text/plain", "Invalid SSID or password length.");
                return;
            }
            ssids[count] = ssid;
            passwords[count] = password;
            ++count;
        }

        if (count == 0) {
            provisioningServer_.send(400, "text/plain", "Enter at least one SSID.");
            return;
        }

        Preferences prefs;
        if (!prefs.begin("AchaemenidNet", false)) {
            provisioningServer_.send(500, "text/plain", "Could not open network storage.");
            return;
        }

        prefs.putInt("wifiCount", count);
        for (int i = 0; i < count; ++i) {
            prefs.putString(("ssid" + String(i)).c_str(), ssids[i]);
            prefs.putString(("pass" + String(i)).c_str(), passwords[i]);
        }
        for (int i = count; i < 5; ++i) {
            prefs.remove(("ssid" + String(i)).c_str());
            prefs.remove(("pass" + String(i)).c_str());
        }
        prefs.end();

        provisioningServer_.send(200, "text/html; charset=utf-8",
            "<html><meta charset='utf-8'><body><h2>Wi-Fi settings saved.</h2>"
            "<p>The device is restarting and will try the saved networks.</p></body></html>");
        delay(300);
        ESP.restart();
    });

    provisioningServer_.onNotFound([this]() {
        provisioningServer_.sendHeader("Location", "/", true);
        provisioningServer_.send(302, "text/plain", "");
    });
    provisioningServer_.begin();
    provisioningServerStarted_ = true;
    state_ = BootState::PROVISIONING;

    INFOF("[Provisioning] Access point '%s' started. Open http://192.168.4.1", apSsid.c_str());
}

void BootManager::loop() {
    if (state_ == BootState::PROVISIONING) {
        provisioningServer_.handleClient();
        return;
    }

    if (state_ != BootState::DONE || ctx_.network == nullptr) return;
    if (ctx_.network->isConnected()) return;
    if (millis() - lastReconnectAttempt_ < 5000) return;

    lastReconnectAttempt_ = millis();
    WARNING("[Network] WiFi disconnected. Retrying saved networks.");
    state_ = BootState::RECONNECTING;
    wifiFut_ = ctx_.network->connectAsync();

    auto reconnectFuture = uniuno::create_future([this]() { return this->bootPollFn(); });
    ctx_.executor->execute(reconnectFuture, [this](uniuno::Error e) { this->bootErrorFn(e); });
}

void BootManager::startBootSequenceAsync(BootContext ctx) {
    ctx_ = ctx;

    // بارگذاری بلافاصله تنظیمات از NVS هنگام شروع بوت (آفلاین بوت کاملاً ایزوله از شبکه)
    INFO("[Boot] Booting up... Loading config from NVS immediately.");
    ParseResult nvsResult = {}; // Zero-initialize to avoid garbage memory
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

    state_ = BootState::CONNECT_WIFI;
    INFO("[BootManager] Starting WiFi connection (using configured APs)...");
    wifiFut_ = ctx_.network->connectAsync();
    
    // We bind poll and error functions to this instance for executor
    auto bootFuture = uniuno::create_future([this]() { return this->bootPollFn(); });
    ctx_.executor->execute(bootFuture, [this](uniuno::Error e) { this->bootErrorFn(e); });
}
