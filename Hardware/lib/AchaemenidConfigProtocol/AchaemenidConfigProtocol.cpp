#include "AchaemenidConfigProtocol.h"
#include <string.h>
#include <stdlib.h>

namespace uniuno {

static void decodeValue(const char* input, char* output, size_t outputSize) {
    size_t out = 0;
    for (size_t i = 0; input[i] && out + 1 < outputSize; ++i) {
        if (input[i] == '%' && input[i + 1] && input[i + 2]) {
            char hex[3] = {input[i + 1], input[i + 2], '\0'};
            char* end = nullptr;
            long value = strtol(hex, &end, 16);
            if (end && *end == '\0') {
                output[out++] = static_cast<char>(value);
                i += 2;
                continue;
            }
        }
        output[out++] = input[i];
    }
    output[out] = '\0';
}

class KeyValueParser {
    const char* start;
    const char* end;
public:
    KeyValueParser(const char* s, const char* e) : start(s), end(e) {}
    
    // returns true if key exists, fills value buffer
    bool getValue(const char* key, char* outVal, size_t maxLen) {
        size_t keyLen = strlen(key);
        const char* p = start;
        while (p < end) {
            // Check if p starts with key followed by '='
            if (end - p > keyLen && strncmp(p, key, keyLen) == 0 && p[keyLen] == '=') {
                const char* valStart = p + keyLen + 1;
                const char* valEnd = valStart;
                while (valEnd < end && *valEnd != ' ' && *valEnd != '\r') valEnd++;
                
                size_t valLen = valEnd - valStart;
                if (valLen >= maxLen) valLen = maxLen - 1;
                strncpy(outVal, valStart, valLen);
                outVal[valLen] = '\0';
                return true;
            }
            // Move to next space
            while (p < end && *p != ' ' && *p != '\r') p++;
            while (p < end && (*p == ' ' || *p == '\r')) p++;
        }
        return false;
    }
    
    int getInt(const char* key, int defVal = 0) {
        char buf[16];
        if (getValue(key, buf, sizeof(buf))) {
            return atoi(buf);
        }
        return defVal;
    }
};

bool AchaemenidConfigProtocol::parse(const char* payload, ParseResult& outResult) {
    outResult.count = 0;
    outResult.success = false;
    for (int i = 0; i < MAX_SEGMENTS; i++) {
        outResult.segments[i].valid = false;
        outResult.segments[i].pin = -1;
        outResult.segments[i].id[0] = '\0';
        outResult.segments[i].type[0] = '\0';
        outResult.segments[i].rule.active = false;
        outResult.segments[i].rule.highActionCount = 0;
        outResult.segments[i].rule.lowActionCount = 0;
    }

    if (!payload || payload[0] == '\0') {
        Serial.println("[ACP] Empty payload received.");
        return outResult.success;
    }

    // بررسی هدر نسخه
    if (strncmp(payload, "ESP_CFG_V2", 10) != 0) {
        Serial.println("[ACP] Invalid protocol header.");
        return outResult.success;
    }

    const char* p = payload;
    int segIndex = -1;

    while (*p) {
        const char* eol = strchr(p, '\n');
        if (!eol) eol = p + strlen(p);

        // Skip empty lines
        if (eol == p || (eol == p + 1 && *p == '\r')) {
            if (*eol == '\0') break;
            p = eol + 1;
            continue;
        }

        KeyValueParser kvp(p, eol);

        if (strncmp(p, "C ", 2) == 0) {
            char markerBuf[4] = {0};
            outResult.segmentsProvided = kvp.getValue("n", markerBuf, sizeof(markerBuf));
        } else if (strncmp(p, "S ", 2) == 0) {
            segIndex++;
            if (segIndex >= MAX_SEGMENTS) {
                Serial.printf("[ACP] Max segments (%d) reached.\n", MAX_SEGMENTS);
                break;
            }
            char idBuf[32] = {0};
            char typeBuf[16] = {0};
            char pinBuf[16] = {0};

            bool hasId = kvp.getValue("id", idBuf, sizeof(idBuf));
            bool hasType = kvp.getValue("type", typeBuf, sizeof(typeBuf));
            bool hasPin = kvp.getValue("pin", pinBuf, sizeof(pinBuf));
            
            if (hasId && hasType && hasPin) {
                int pinNum = parsePinNumber(pinBuf);
                bool valid = (strlen(idBuf) > 0) && (strlen(typeBuf) > 0) && (pinNum >= 0);
                
                strncpy(outResult.segments[segIndex].id, idBuf, sizeof(outResult.segments[segIndex].id) - 1);
                strncpy(outResult.segments[segIndex].type, typeBuf, sizeof(outResult.segments[segIndex].type) - 1);
                
                outResult.segments[segIndex].pin = pinNum;
                outResult.segments[segIndex].value = (kvp.getInt("val", 0) > 0);
                outResult.segments[segIndex].autoOffDelay = kvp.getInt("ao", 0);
                outResult.segments[segIndex].valid = valid;
                if (valid) {
                    outResult.count++;
                } else {
                    segIndex--;
                }
            } else {
                segIndex--;
            }
        } else if (strncmp(p, "RH ", 3) == 0 || strncmp(p, "RL ", 3) == 0) {
            if (segIndex >= 0 && segIndex < MAX_SEGMENTS && outResult.segments[segIndex].valid) {
                bool isHigh = (p[1] == 'H');
                char tgtBuf[16] = {0};
                
                if (kvp.getValue("tgt", tgtBuf, sizeof(tgtBuf))) {
                    int targetPin = parsePinNumber(tgtBuf);
                    if (targetPin >= 0) {
                        outResult.segments[segIndex].rule.active = true;
                        if (isHigh) {
                            int c = outResult.segments[segIndex].rule.highActionCount;
                            if (c < 4) {
                                outResult.segments[segIndex].rule.highActions[c].targetPin = targetPin;
                                outResult.segments[segIndex].rule.highActions[c].requiredHoldTime = kvp.getInt("hld", 0);
                                outResult.segments[segIndex].rule.highActions[c].actionState = kvp.getInt("ast", 1) > 0;
                                outResult.segments[segIndex].rule.highActions[c].actionType = static_cast<RuleActionType>(kvp.getInt("atp", 0));
                                outResult.segments[segIndex].rule.highActions[c].delay = kvp.getInt("dly", 0);
                                outResult.segments[segIndex].rule.highActionCount++;
                            }
                        } else {
                            int c = outResult.segments[segIndex].rule.lowActionCount;
                            if (c < 4) {
                                outResult.segments[segIndex].rule.lowActions[c].targetPin = targetPin;
                                outResult.segments[segIndex].rule.lowActions[c].requiredHoldTime = kvp.getInt("hld", 0);
                                outResult.segments[segIndex].rule.lowActions[c].actionState = kvp.getInt("ast", 0) > 0;
                                outResult.segments[segIndex].rule.lowActions[c].actionType = static_cast<RuleActionType>(kvp.getInt("atp", 0));
                                outResult.segments[segIndex].rule.lowActions[c].delay = kvp.getInt("dly", 0);
                                outResult.segments[segIndex].rule.lowActionCount++;
                            }
                        }
                    }
                }
            }
        } else if (strncmp(p, "M ", 2) == 0) {
            // تجزیه تنظیمات MQTT
            char hostBuf[192] = {0};
            char topicBuf[192] = {0};
            
            bool hasHost = kvp.getValue("h", hostBuf, sizeof(hostBuf));
            bool hasTopic = kvp.getValue("t", topicBuf, sizeof(topicBuf));
            
            if (hasHost && hasTopic) {
                decodeValue(hostBuf, outResult.mqtt.host, sizeof(outResult.mqtt.host));
                decodeValue(topicBuf, outResult.mqtt.baseTopic, sizeof(outResult.mqtt.baseTopic));
                outResult.mqtt.port = kvp.getInt("p", 1883);
                outResult.mqtt.qos = kvp.getInt("q", 1);
                outResult.mqtt.valid = true;
                Serial.printf("[ACP] MQTT Config Parsed: host=%s port=%d topic=%s qos=%d\n", 
                    outResult.mqtt.host, outResult.mqtt.port, outResult.mqtt.baseTopic, outResult.mqtt.qos);
            }
        } else if (strncmp(p, "W ", 2) == 0) {
            // تجزیه تنظیمات وای‌فای
            char ssidBuf[100] = {0};
            char passBuf[190] = {0};
            
            char markerBuf[4] = {0};
            if (kvp.getValue("n", markerBuf, sizeof(markerBuf))) outResult.wifiProvided = true;
            bool hasSsid = kvp.getValue("s", ssidBuf, sizeof(ssidBuf));
            bool hasPass = kvp.getValue("p", passBuf, sizeof(passBuf));
            
            if (hasSsid && hasPass) outResult.wifiProvided = true;
            if (hasSsid && hasPass && outResult.wifiCount < 5) {
                int c = outResult.wifiCount;
                decodeValue(ssidBuf, outResult.wifi[c].ssid, sizeof(outResult.wifi[c].ssid));
                decodeValue(passBuf, outResult.wifi[c].password, sizeof(outResult.wifi[c].password));
                outResult.wifi[c].valid = true;
                outResult.wifiCount++;
                Serial.printf("[ACP] WiFi Config Parsed: ssid=%s\n", outResult.wifi[c].ssid);
            }
        } else if (strncmp(p, "A ", 2) == 0) {
            char ssidBuf[100] = {0};
            char passBuf[190] = {0};
            if (kvp.getValue("s", ssidBuf, sizeof(ssidBuf)) &&
                kvp.getValue("p", passBuf, sizeof(passBuf))) {
                outResult.apProvided = true;
                decodeValue(ssidBuf, outResult.apSsid, sizeof(outResult.apSsid));
                decodeValue(passBuf, outResult.apPassword, sizeof(outResult.apPassword));
                outResult.apValid = outResult.apSsid[0] != '\0' &&
                    strlen(outResult.apPassword) >= 8 &&
                    strlen(outResult.apPassword) <= 63;
            }
        }

        if (*eol == '\0') break;
        p = eol + 1;
    }
    
    outResult.success = true;
    Serial.printf("[ACP] Parsed %d valid segments.\n", outResult.count);
    return true;
}

int AchaemenidConfigProtocol::parsePinNumber(const char* pinStr) {
    if (!pinStr || pinStr[0] == '\0' || pinStr[0] == 'A') {
        return -1;
    }
    int val = atoi(pinStr);
    if (val == 0 && strcmp(pinStr, "0") != 0) {
        return -1;
    }
    return val;
}

void AchaemenidConfigProtocol::printResult(const ParseResult* result) {
    if (!result) return;
    Serial.println("========= ACP Parse Result =========");
    Serial.printf("  Success: %s\n", result->success ? "YES" : "NO");
    Serial.printf("  Valid segments: %d\n", result->count);

    for (int i = 0; i < MAX_SEGMENTS; i++) {
        if (!result->segments[i].valid) continue;

        Serial.printf("  [%d] id=%s  type=%s  pin=%d  val=%s\n",
            i,
            result->segments[i].id,
            result->segments[i].type,
            result->segments[i].pin,
            result->segments[i].value ? "ON" : "OFF");
    }

    Serial.println("=======================================");
}

} // namespace uniuno
