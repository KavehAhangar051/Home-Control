#pragma once

#ifdef ESP32

#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiAdapter.h>
#include <NetworkConfigHelper.h>
#include <Optimization/SmallVector.h>
#include <Optimization/CompilerTraits.h>
#include <cstring>

namespace uniuno {

struct WiFiCredential {
  char ssid[33]{};
  char pass[64]{};
};

class ESP32WiFiAdapter : public WiFiAdapter {
public:
  ESP32WiFiAdapter() {}

  FORCE_INLINE bool mode(WiFiMode_t m) override { 
    WiFi.persistent(false);
    bool result = WiFi.mode(m); 
    WiFi.setSleep(false); // <--- ZERO LATENCY WIFI
    return result;
  }

  FORCE_INLINE WiFiMode_t get_mode() override { 
    return WiFi.getMode(); 
  }

  bool add_access_point(const char *ssid, const char *passphrase) override {
    if (!net_config::isValidWifiCredential(ssid, passphrase)) {
      return false;
    }
    if (credentials.full()) {
      return false;
    }

    WiFiCredential cred;
    net_config::copySafeString(cred.ssid, sizeof(cred.ssid), ssid);
    net_config::copySafeString(cred.pass, sizeof(cred.pass), passphrase);

    const char* passArg = (cred.pass[0] != '\0') ? cred.pass : nullptr;
    const size_t ssidLen = strlen(cred.ssid);
    if (ssidLen <= 31) {
      if (!wifiMulti.addAP(cred.ssid, passArg)) {
        return false;
      }
      hasWiFiMultiAp_ = true;
    } else {
      // Arduino-ESP32 WiFiMulti rejects 32-byte SSIDs; track for direct WiFi.begin fallback
      hasExtendedSsid_ = true;
    }

    credentials.push_back(cred);
    return true;
  }

  FORCE_INLINE wl_status_t status() override { 
    return WiFi.status(); 
  }

  wl_status_t run(unsigned int connectTimeoutMs = 5000) override {
    if (status() == WL_CONNECTED) {
      return WL_CONNECTED;
    }

    if (credentials.empty()) {
      return WL_CONNECT_FAILED;
    }

    wl_status_t res = WL_DISCONNECTED;
    if (hasWiFiMultiAp_) {
      // WiFiMulti selects among <=31-char saved APs using the connector's bounded timeout.
      res = static_cast<wl_status_t>(wifiMulti.run(connectTimeoutMs));
      if (res == WL_CONNECTED) {
        return WL_CONNECTED;
      }
    }

    if (hasExtendedSsid_) {
      for (size_t i = 0; i < credentials.size(); ++i) {
        const WiFiCredential& cred = credentials[i];
        if (strlen(cred.ssid) == 32) {
          const char* passArg = (cred.pass[0] != '\0') ? cred.pass : nullptr;
          WiFi.begin(cred.ssid, passArg);
          const unsigned long start = millis();
          while (WiFi.status() != WL_CONNECTED &&
                 static_cast<unsigned long>(millis() - start) < connectTimeoutMs) {
            delay(50);
          }
          if (WiFi.status() == WL_CONNECTED) {
            return WL_CONNECTED;
          }
        }
      }
    }

    return res;
  }

  FORCE_INLINE bool disconnect(bool wifioff = false) override {
    return WiFi.disconnect(wifioff);
  }

private:
  SmallVector<WiFiCredential, 5> credentials;
  WiFiMulti wifiMulti;
  bool hasWiFiMultiAp_ = false;
  bool hasExtendedSsid_ = false;
};

} // namespace uniuno

#endif


