#include "NetworkStorage.h"
#include <Preferences.h>
#include <Utilities/logging.h>
#include <Optimization/StaticString.h>

Preferences prefs;

bool saveNetworkConfig(const ConfigLoadedEvent& config) {
    bool wifiChanged = false;
    bool started = prefs.begin("AchaemenidNet", false); // false = read/write
    if (!started) {
        ERROR("[NetworkStorage] Failed to open Preferences");
        return false;
    }

    // Preserve existing WiFi credentials when this event carries no WiFi update.
    // This is important for the boot-time ConfigLoadedEvent restored from NVS.
    if (config.hasParsedConfig && config.parsed.wifiProvided) {
        int wifiCount = config.wifiCount > 5 ? 5 : config.wifiCount;
        int currentCount = prefs.getInt("wifiCount", 0);
        if (currentCount != wifiCount) wifiChanged = true;
        prefs.putInt("wifiCount", wifiCount);
        for (int i = 0; i < wifiCount; i++) {
            uniuno::StaticString<8> ssidKey("ssid");
            uniuno::StaticString<8> passKey("pass");
            ssidKey += static_cast<char>('0' + i);
            passKey += static_cast<char>('0' + i);

            String currentSsid = prefs.getString(ssidKey.c_str(), "");
            String currentPass = prefs.getString(passKey.c_str(), "");
            if (currentSsid != config.wifi[i].ssid) {
                wifiChanged = true;
                prefs.putString(ssidKey.c_str(), config.wifi[i].ssid);
                INFOF("[NetworkStorage] Updated WiFi SSID slot %d.", i + 1);
            }
            if (currentPass != config.wifi[i].password) {
                wifiChanged = true;
                prefs.putString(passKey.c_str(), config.wifi[i].password);
                INFO("[NetworkStorage] Updated WiFi password.");
            }
        }
        for (int i = wifiCount; i < 5; ++i) {
            uniuno::StaticString<8> ssidKey("ssid");
            uniuno::StaticString<8> passKey("pass");
            ssidKey += static_cast<char>('0' + i);
            passKey += static_cast<char>('0' + i);
            if (prefs.isKey(ssidKey.c_str()) || prefs.isKey(passKey.c_str())) wifiChanged = true;
            prefs.remove(ssidKey.c_str());
            prefs.remove(passKey.c_str());
        }
    }

    if (config.hasParsedConfig && config.parsed.apProvided) {
        prefs.putBool("apConfigured", config.parsed.apValid);
        if (config.parsed.apValid) {
            prefs.putString("apSsid", config.parsed.apSsid);
            prefs.putString("apPass", config.parsed.apPassword);
        } else {
            prefs.remove("apSsid");
            prefs.remove("apPass");
        }
    }

    // Save MQTT
    if (config.mqtt.valid) {
        String currentHost = prefs.getString("mqHost", "");
        if (currentHost != config.mqtt.host) {
            prefs.putString("mqHost", config.mqtt.host);
            INFOF("[NetworkStorage] [DEBUG] MQTT Host changed from '%s' to '%s'.", currentHost.c_str(), config.mqtt.host);
        }

        String currentTopic = prefs.getString("mqTopic", "");
        if (currentTopic != config.mqtt.baseTopic) {
            prefs.putString("mqTopic", config.mqtt.baseTopic);
            INFOF("[NetworkStorage] [DEBUG] MQTT Topic changed from '%s' to '%s'.", currentTopic.c_str(), config.mqtt.baseTopic);
        }

        int currentPort = prefs.getInt("mqPort", -1);
        if (currentPort != config.mqtt.port) {
            prefs.putInt("mqPort", config.mqtt.port);
        }

        int currentQos = prefs.getInt("mqQos", -1);
        if (currentQos != config.mqtt.qos) {
            prefs.putInt("mqQos", config.mqtt.qos);
        }

        prefs.putBool("mqValid", true);
    }

    prefs.end();
    INFO("Network configuration saved to NVS (Preferences)");
    return wifiChanged;
}

void loadNetworkConfig(String ssid[5], String pass[5], int& count, MqttConfig& mqttConfig) {
    bool started = prefs.begin("AchaemenidNet", true); // true = read-only
    if (!started) {
        WARNING("[NetworkStorage] Preferences empty or failed to open");
        count = 0;
        mqttConfig.valid = false;
        return;
    }

    count = prefs.getInt("wifiCount", 0);
    if (count > 5) count = 5;

    for (int i = 0; i < count; i++) {
        uniuno::StaticString<8> ssidKey("ssid");
        uniuno::StaticString<8> passKey("pass");
        ssidKey += static_cast<char>('0' + i);
        passKey += static_cast<char>('0' + i);

        ssid[i] = prefs.getString(ssidKey.c_str(), "");
        pass[i] = prefs.getString(passKey.c_str(), "");
        INFOF("[NetworkStorage] Stored WiFi network %d - SSID: '%s'", i + 1, ssid[i].c_str());
    }

    bool mqValid = prefs.getBool("mqValid", false);
    if (mqValid) {
        String host = prefs.getString("mqHost", "");
        String topic = prefs.getString("mqTopic", "");
        int port = prefs.getInt("mqPort", 1883);
        int qos = prefs.getInt("mqQos", 1);

        strncpy(mqttConfig.host, host.c_str(), sizeof(mqttConfig.host) - 1);
        strncpy(mqttConfig.baseTopic, topic.c_str(), sizeof(mqttConfig.baseTopic) - 1);
        mqttConfig.port = port;
        mqttConfig.qos = qos;
        mqttConfig.valid = true;

        INFOF("[NetworkStorage] [DEBUG] Stored MQTT Config - Host: '%s', Port: %d, Topic: '%s', QOS: %d", mqttConfig.host, mqttConfig.port, mqttConfig.baseTopic, mqttConfig.qos);
    } else {
        mqttConfig.valid = false;
        INFO("[NetworkStorage] [DEBUG] No valid MQTT config stored.");
    }

    prefs.end();
    INFOF("[NetworkStorage] Loaded %d WiFi networks and MQTT config from NVS", count);
}
