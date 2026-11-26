#include "AchaemenidConfigProtocol.h"
#include "NetworkConfigHelper.h"
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

static void parseTextConditions(KeyValueParser& kvp, RuleCondition* outConds, uint8_t& outCount, uint8_t& outLogic) {
    outCount = 0;
    outLogic = COND_LOGIC_AND;
    char logicBuf[8] = {0};
    if (kvp.getValue("clog", logicBuf, sizeof(logicBuf))) {
        if (strcmp(logicBuf, "or") == 0 || strcmp(logicBuf, "1") == 0) {
            outLogic = COND_LOGIC_OR;
        }
    }
    char cndBuf[128] = {0};
    if (!kvp.getValue("cnd", cndBuf, sizeof(cndBuf)) || cndBuf[0] == '\0') {
        return;
    }
    const char* cur = cndBuf;
    while (*cur && outCount < MAX_RULE_CONDITIONS_PER_ACTION) {
        const char* comma = strchr(cur, ',');
        const char* segEnd = comma ? comma : (cur + strlen(cur));
        char item[36] = {0};
        size_t itemLen = static_cast<size_t>(segEnd - cur);
        if (itemLen >= sizeof(item)) itemLen = sizeof(item) - 1;
        memcpy(item, cur, itemLen);
        item[itemLen] = '\0';
        int pin = -1;
        int op = 0;
        int val = 0;
        int maxVal = 0;
        if (sscanf(item, "%d:%d:%d:%d", &pin, &op, &val, &maxVal) >= 2) {
            RuleCondition rc;
            rc.sourcePin = static_cast<int8_t>(pin);
            rc.op = static_cast<uint8_t>(op < 0 ? 0 : op);
            rc.value = static_cast<uint16_t>(val < 0 ? 0 : (val > MAX_ANALOG_OUTPUT_VALUE ? MAX_ANALOG_OUTPUT_VALUE : val));
            rc.maxValue = static_cast<uint16_t>(maxVal < 0 ? 0 : (maxVal > MAX_ANALOG_OUTPUT_VALUE ? MAX_ANALOG_OUTPUT_VALUE : maxVal));
            if (isValidManagedPin(pin) && op >= 0 && op <= COND_OP_MAX && isValidRuleCondition(rc)) {
                outConds[outCount++] = rc;
            }
        }
        if (!comma) break;
        cur = comma + 1;
    }
}

bool AchaemenidConfigProtocol::parse(const char* payload, ParseResult& outResult) {
    outResult.reset();

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
            if (kvp.getValue("n", markerBuf, sizeof(markerBuf))) {
                outResult.segmentsProvided = true;
            }
        } else if (strncmp(p, "E ", 2) == 0) {
            char markerBuf[8] = {0};
            if (kvp.getValue("n", markerBuf, sizeof(markerBuf))) {
                outResult.auxNodesProvided = true;
            }

            char macBuf[32] = {0};
            const int rawNodeId = kvp.getInt("id", 0);
            const bool hasMac = kvp.getValue("mac", macBuf, sizeof(macBuf));
            if (hasMac && isValidAuxNodeId(rawNodeId)) {
                outResult.auxNodesProvided = true;
                uint8_t parsedMac[6] = {0};
                const int rawCap = kvp.getInt("cap", 4);
                const int rawChip = kvp.getInt("chip", 0);
                char nameEncBuf[96] = {0};
                char nameBuf[32] = {0};
                if (kvp.getValue("name", nameEncBuf, sizeof(nameEncBuf))) {
                    decodeValue(nameEncBuf, nameBuf, sizeof(nameBuf));
                }

                if (parseMacAddress(macBuf, parsedMac) &&
                    rawCap >= 1 && rawCap <= static_cast<int>(MAX_AUX_NODE_PIN_CAPACITY)) {
                    int targetIdx = -1;
                    for (int idx = 0; idx < outResult.auxNodeCount; ++idx) {
                        if (outResult.auxNodes[idx].nodeId == static_cast<uint8_t>(rawNodeId) ||
                            macEquals(outResult.auxNodes[idx].mac, parsedMac)) {
                            targetIdx = idx;
                            break;
                        }
                    }
                    if (targetIdx < 0 && outResult.auxNodeCount < MAX_AUX_NODES) {
                        targetIdx = outResult.auxNodeCount++;
                    }
                    if (targetIdx >= 0) {
                        AuxNodeConfig& node = outResult.auxNodes[targetIdx];
                        node.reset();
                        node.nodeId = static_cast<uint8_t>(rawNodeId);
                        memcpy(node.mac, parsedMac, 6);
                        node.pinCapacity = static_cast<uint8_t>(rawCap);
                        node.chipType = (rawChip >= 0 && rawChip <= static_cast<int>(AUX_CHIP_MAX))
                            ? static_cast<AuxChipType>(rawChip)
                            : AUX_CHIP_UNKNOWN;
                        if (nameBuf[0] != '\0') {
                            net_config::copySafeString(node.name, sizeof(node.name), nameBuf);
                        } else {
                            snprintf(node.name, sizeof(node.name), "Node-%d", rawNodeId);
                        }
                        node.online = false;
                        node.valid = true;
                    }
                } else {
                    Serial.printf("[ACP] Warning: Rejected invalid aux node line (id=%d mac=%s cap=%d).\n",
                                  rawNodeId, macBuf, rawCap);
                }
            }
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
                const int pinNum = parsePinNumber(pinBuf);
                const int rawVirt = kvp.getInt("virt", 0);
                const int rawNode = kvp.getInt("node", AUX_NODE_ID_LOCAL);
                const int rawRpin = kvp.getInt("rpin", -1);
                const bool isVirt = (rawVirt == 1) || isVirtualPin(pinNum);

                bool valid = (strlen(idBuf) > 0) && (strlen(typeBuf) > 0);
                if (isVirt) {
                    valid = valid && isVirtualPin(pinNum) &&
                            isValidAuxNodeId(rawNode) && isValidAuxRemotePin(rawRpin);
                } else {
                    valid = valid && isLocalGpioPin(pinNum);
                }
                
                strncpy(outResult.segments[segIndex].id, idBuf, sizeof(outResult.segments[segIndex].id) - 1);
                strncpy(outResult.segments[segIndex].type, typeBuf, sizeof(outResult.segments[segIndex].type) - 1);
                
                const bool isAnalogInput =
                    (strcmp(typeBuf, "analog_input") == 0 || strcmp(typeBuf, "adc_input") == 0);

                int rawRes = kvp.getInt("res", isAnalogInput ? DEFAULT_ADC_RESOLUTION : DEFAULT_PWM_RESOLUTION);
                if (rawRes < MIN_PWM_RESOLUTION) rawRes = MIN_PWM_RESOLUTION;
                if (rawRes > MAX_PWM_RESOLUTION) rawRes = MAX_PWM_RESOLUTION;

                int rawFreq = kvp.getInt("freq", DEFAULT_PWM_FREQUENCY);
                if (rawFreq < MIN_PWM_FREQUENCY) rawFreq = MIN_PWM_FREQUENCY;
                if (rawFreq > MAX_PWM_FREQUENCY) rawFreq = MAX_PWM_FREQUENCY;

                const uint16_t maxScale = static_cast<uint16_t>((1UL << rawRes) - 1UL);
                int rawVal = kvp.getInt("val", 0);
                if (rawVal < 0) rawVal = 0;
                if (rawVal > static_cast<int>(maxScale)) rawVal = static_cast<int>(maxScale);

                int rawSint = kvp.getInt("sint", DEFAULT_ADC_SAMPLE_INTERVAL_MS);
                if (rawSint < MIN_ADC_SAMPLE_INTERVAL_MS) rawSint = MIN_ADC_SAMPLE_INTERVAL_MS;
                if (rawSint > MAX_ADC_SAMPLE_INTERVAL_MS) rawSint = MAX_ADC_SAMPLE_INTERVAL_MS;

                int rawDelta = kvp.getInt("delta", DEFAULT_ADC_DELTA_THRESHOLD);
                if (rawDelta < MIN_ADC_DELTA_THRESHOLD) rawDelta = MIN_ADC_DELTA_THRESHOLD;
                if (rawDelta > static_cast<int>(maxScale)) rawDelta = static_cast<int>(maxScale);

                int rawAth = kvp.getInt("ath", 0);
                if (rawAth < 0) rawAth = 0;
                if (rawAth > static_cast<int>(maxScale)) rawAth = static_cast<int>(maxScale);

                int rawAtl = kvp.getInt("atl", 0);
                if (rawAth == 0 || rawAtl < 0) rawAtl = 0;
                if (rawAtl > rawAth) rawAtl = rawAth;

                outResult.segments[segIndex].pin = pinNum;
                outResult.segments[segIndex].isVirtual = isVirt;
                outResult.segments[segIndex].nodeId = isVirt ? static_cast<uint8_t>(rawNode) : AUX_NODE_ID_LOCAL;
                outResult.segments[segIndex].remotePin = isVirt ? static_cast<uint8_t>(rawRpin) : REMOTE_PIN_UNSET;
                outResult.segments[segIndex].pwmResolution = isAnalogInput
                    ? DEFAULT_PWM_RESOLUTION
                    : static_cast<uint8_t>(rawRes);
                outResult.segments[segIndex].pwmFrequency = static_cast<uint16_t>(rawFreq);
                outResult.segments[segIndex].adcResolution = isAnalogInput
                    ? static_cast<uint8_t>(rawRes)
                    : DEFAULT_ADC_RESOLUTION;
                outResult.segments[segIndex].adcSampleIntervalMs = static_cast<uint16_t>(rawSint);
                outResult.segments[segIndex].adcDeltaThreshold = static_cast<uint16_t>(rawDelta);
                outResult.segments[segIndex].adcHighThreshold = static_cast<uint16_t>(rawAth);
                outResult.segments[segIndex].adcLowThreshold = static_cast<uint16_t>(rawAtl);
                outResult.segments[segIndex].analogValue = static_cast<uint16_t>(rawVal);
                outResult.segments[segIndex].value = (rawVal > 0);
                outResult.segments[segIndex].autoOffDelay = kvp.getInt("ao", 0);
                outResult.segments[segIndex].valid = valid;
                if (valid) {
                    outResult.segmentsProvided = true;
                    outResult.count++;
                } else {
                    outResult.segments[segIndex].reset();
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
                    if (isValidManagedPin(targetPin)) {
                        const int rawAval = kvp.getInt("aval", RULE_ANALOG_VALUE_UNSET);
                        const bool hasAnalogVal = (rawAval >= 0 && rawAval <= MAX_ANALOG_OUTPUT_VALUE);
                        const int16_t targetVal = hasAnalogVal ? static_cast<int16_t>(rawAval) : RULE_ANALOG_VALUE_UNSET;

                        int holdTime = 0;
                        char hldBuf[16] = {0};
                        if (kvp.getValue("hld", hldBuf, sizeof(hldBuf))) {
                            if (strcmp(hldBuf, "dc") == 0 || strcmp(hldBuf, "double_click") == 0) {
                                holdTime = RULE_TRIGGER_DOUBLE_CLICK;
                            } else {
                                holdTime = atoi(hldBuf);
                            }
                        }
                        if (!isValidDigitalHoldTime(holdTime)) {
                            holdTime = 0;
                        }

                        outResult.segments[segIndex].rule.active = true;
                        if (isHigh) {
                            int c = outResult.segments[segIndex].rule.highActionCount;
                            if (c < static_cast<int>(MAX_RULE_ACTIONS_PER_SIDE)) {
                                RuleAction& act = outResult.segments[segIndex].rule.highActions[c];
                                act.reset();
                                act.targetPin = targetPin;
                                act.requiredHoldTime = holdTime;
                                act.targetValue = targetVal;
                                act.actionState = hasAnalogVal
                                    ? (targetVal > 0)
                                    : (kvp.getInt("ast", 1) > 0);
                                act.actionType = static_cast<RuleActionType>(kvp.getInt("atp", 0));
                                act.delay = kvp.getInt("dly", 0);
                                parseTextConditions(kvp, act.conditions, act.conditionCount, act.conditionLogic);
                                outResult.segments[segIndex].rule.highActionCount++;
                            }
                        } else {
                            int c = outResult.segments[segIndex].rule.lowActionCount;
                            if (c < static_cast<int>(MAX_RULE_ACTIONS_PER_SIDE)) {
                                RuleAction& act = outResult.segments[segIndex].rule.lowActions[c];
                                act.reset();
                                act.targetPin = targetPin;
                                act.requiredHoldTime = holdTime;
                                act.targetValue = targetVal;
                                act.actionState = hasAnalogVal
                                    ? (targetVal > 0)
                                    : (kvp.getInt("ast", 0) > 0);
                                act.actionType = static_cast<RuleActionType>(kvp.getInt("atp", 0));
                                act.delay = kvp.getInt("dly", 0);
                                parseTextConditions(kvp, act.conditions, act.conditionCount, act.conditionLogic);
                                outResult.segments[segIndex].rule.lowActionCount++;
                            }
                        }
                    }
                }
            }
        } else if (strncmp(p, "RR ", 3) == 0) {
            // Multi-range analog input rule:
            // RR min=<0..maxScale> max=<0..maxScale> tgt=<pin> [hyst=<0..maxScale/2>] [trg=<0|1|enter|exit>] [ast=<0|1>] [aval=<0..4095>] [atp=<0|1|2>] [dly=<0..60>]
            if (segIndex >= 0 && segIndex < MAX_SEGMENTS && outResult.segments[segIndex].valid) {
                char tgtBuf[16] = {0};
                if (kvp.getValue("tgt", tgtBuf, sizeof(tgtBuf))) {
                    const int targetPin = parsePinNumber(tgtBuf);
                    const uint8_t c = outResult.segments[segIndex].rule.analogRangeCount;
                    if (isValidManagedPin(targetPin) && c < MAX_ANALOG_RANGE_RULES) {
                        const uint8_t res = outResult.segments[segIndex].adcResolution;
                        const int maxScale = static_cast<int>((1UL << res) - 1UL);

                        int rawMin = kvp.getInt("min", 0);
                        int rawMax = kvp.getInt("max", maxScale);
                        if (rawMin < 0) rawMin = 0;
                        if (rawMin > maxScale) rawMin = maxScale;
                        if (rawMax < 0) rawMax = 0;
                        if (rawMax > maxScale) rawMax = maxScale;
                        if (rawMin > rawMax) {
                            const int tmp = rawMin;
                            rawMin = rawMax;
                            rawMax = tmp;
                        }

                        int rawHyst = kvp.getInt("hyst", 0);
                        if (rawHyst < 0) rawHyst = 0;
                        if (rawHyst > (maxScale >> 1)) rawHyst = (maxScale >> 1);

                        AnalogRangeTriggerMode triggerMode = RANGE_ON_ENTER;
                        char trgBuf[12] = {0};
                        if (kvp.getValue("trg", trgBuf, sizeof(trgBuf))) {
                            if (strcmp(trgBuf, "exit") == 0 || atoi(trgBuf) == 1) {
                                triggerMode = RANGE_ON_EXIT;
                            }
                        }

                        const int rawAval = kvp.getInt("aval", RULE_ANALOG_VALUE_UNSET);
                        const bool hasAnalogVal = (rawAval >= 0 && rawAval <= MAX_ANALOG_OUTPUT_VALUE);
                        const int16_t targetVal = hasAnalogVal ? static_cast<int16_t>(rawAval) : RULE_ANALOG_VALUE_UNSET;

                        int rawAtp = kvp.getInt("atp", 0);
                        if (rawAtp < 0 || rawAtp > ACTION_FOR_DURATION) rawAtp = ACTION_IMMEDIATE;
                        int rawDly = kvp.getInt("dly", 0);
                        if (rawDly < 0) rawDly = 0;
                        if (rawDly > 60) rawDly = 60;

                        AnalogRangeRule& rr = outResult.segments[segIndex].rule.analogRanges[c];
                        rr.minValue = static_cast<uint16_t>(rawMin);
                        rr.maxValue = static_cast<uint16_t>(rawMax);
                        rr.hysteresis = static_cast<uint16_t>(rawHyst);
                        rr.targetValue = targetVal;
                        rr.targetPin = static_cast<int8_t>(targetPin);
                        rr.delay = static_cast<uint8_t>(rawDly);
                        rr.actionType = static_cast<RuleActionType>(rawAtp);
                        rr.triggerMode = triggerMode;
                        rr.actionState = hasAnalogVal ? (targetVal > 0) : (kvp.getInt("ast", 1) > 0);
                        rr.enabled = true;
                        parseTextConditions(kvp, rr.conditions, rr.conditionCount, rr.conditionLogic);

                        outResult.segments[segIndex].rule.analogRangeCount = static_cast<uint8_t>(c + 1);
                        outResult.segments[segIndex].rule.active = true;
                    }
                }
            }
        } else if (strncmp(p, "M ", 2) == 0) {
            // تجزیه تنظیمات MQTT
            char hostBuf[192] = {0};
            char topicBuf[192] = {0};
            char userBuf[100] = {0};
            char passBuf[100] = {0};
            
            bool hasHost = kvp.getValue("h", hostBuf, sizeof(hostBuf));
            bool hasTopic = kvp.getValue("t", topicBuf, sizeof(topicBuf));
            
            if (hasHost && hasTopic) {
                char decodedHost[64] = {0};
                char decodedTopic[64] = {0};
                char normalizedTopic[64] = {0};
                decodeValue(hostBuf, decodedHost, sizeof(decodedHost));
                decodeValue(topicBuf, decodedTopic, sizeof(decodedTopic));

                if (net_config::isValidMqttHost(decodedHost) &&
                    net_config::normalizeMqttBaseTopic(decodedTopic, normalizedTopic, sizeof(normalizedTopic))) {
                    net_config::copySafeString(outResult.mqtt.host, sizeof(outResult.mqtt.host), decodedHost);
                    net_config::copySafeString(outResult.mqtt.baseTopic, sizeof(outResult.mqtt.baseTopic), normalizedTopic);
                    outResult.mqtt.port = net_config::sanitizeMqttPort(kvp.getInt("p", net_config::kDefaultMqttPort));
                    outResult.mqtt.qos = net_config::sanitizeMqttQos(kvp.getInt("q", net_config::kDefaultMqttQos));

                    if (kvp.getValue("u", userBuf, sizeof(userBuf))) {
                        decodeValue(userBuf, outResult.mqtt.user, sizeof(outResult.mqtt.user));
                    } else {
                        outResult.mqtt.user[0] = '\0';
                    }
                    if (kvp.getValue("pw", passBuf, sizeof(passBuf))) {
                        decodeValue(passBuf, outResult.mqtt.password, sizeof(outResult.mqtt.password));
                    } else {
                        outResult.mqtt.password[0] = '\0';
                    }

                    outResult.mqtt.valid = true;
                    Serial.printf("[ACP] MQTT Config Parsed: host=%s port=%d topic=%s qos=%d\n", 
                        outResult.mqtt.host, outResult.mqtt.port, outResult.mqtt.baseTopic, outResult.mqtt.qos);
                } else {
                    outResult.mqtt.reset();
                    Serial.println("[ACP] Warning: Rejected invalid MQTT config (empty/malformed host or topic).");
                }
            }
        } else if (strncmp(p, "W ", 2) == 0) {
            // تجزیه تنظیمات وای‌فای
            char ssidBuf[128] = {0};
            char passBuf[200] = {0};
            
            char markerBuf[4] = {0};
            if (kvp.getValue("n", markerBuf, sizeof(markerBuf))) outResult.wifiProvided = true;
            bool hasSsid = kvp.getValue("s", ssidBuf, sizeof(ssidBuf));
            bool hasPass = kvp.getValue("p", passBuf, sizeof(passBuf));
            
            if (hasSsid) {
                if (!hasPass) {
                    passBuf[0] = '\0';
                }
                outResult.wifiProvided = true;
                if (outResult.wifiCount < 5) {
                    char decodedSsid[33] = {0};
                    char decodedPass[64] = {0};
                    decodeValue(ssidBuf, decodedSsid, sizeof(decodedSsid));
                    decodeValue(passBuf, decodedPass, sizeof(decodedPass));

                    if (net_config::isValidWifiCredential(decodedSsid, decodedPass)) {
                        int c = outResult.wifiCount;
                        net_config::copySafeString(outResult.wifi[c].ssid, sizeof(outResult.wifi[c].ssid), decodedSsid);
                        net_config::copySafeString(outResult.wifi[c].password, sizeof(outResult.wifi[c].password), decodedPass);
                        outResult.wifi[c].valid = true;
                        outResult.wifiCount++;
                        Serial.printf("[ACP] WiFi Config Parsed: ssid=%s\n", outResult.wifi[c].ssid);
                    } else if (decodedSsid[0] != '\0' || decodedPass[0] != '\0') {
                        Serial.printf("[ACP] Warning: Skipped invalid WiFi entry (ssid='%s', passLen=%u).\n",
                                      decodedSsid, static_cast<unsigned int>(strlen(decodedPass)));
                    }
                } else {
                    Serial.println("[ACP] Warning: Max 5 WiFi networks supported; ignoring extra entry.");
                }
            }
        } else if (strncmp(p, "A ", 2) == 0) {
            char ssidBuf[128] = {0};
            char passBuf[200] = {0};
            char mdnsBuf[128] = {0};
            const bool hasSsid = kvp.getValue("s", ssidBuf, sizeof(ssidBuf));
            const bool hasPass = kvp.getValue("p", passBuf, sizeof(passBuf));
            if (hasSsid && hasPass) {
                char decodedSsid[33] = {0};
                char decodedPass[64] = {0};
                decodeValue(ssidBuf, decodedSsid, sizeof(decodedSsid));
                decodeValue(passBuf, decodedPass, sizeof(decodedPass));

                const bool isExplicitClear = (decodedSsid[0] == '\0' && decodedPass[0] == '\0');
                const bool isValidAp = net_config::isValidSoftApCredential(decodedSsid, decodedPass);

                if (isExplicitClear) {
                    outResult.apProvided = true;
                    outResult.apValid = false;
                    outResult.apSsid[0] = '\0';
                    outResult.apPassword[0] = '\0';
                } else if (isValidAp) {
                    outResult.apProvided = true;
                    outResult.apValid = true;
                    net_config::copySafeString(outResult.apSsid, sizeof(outResult.apSsid), decodedSsid);
                    net_config::copySafeString(outResult.apPassword, sizeof(outResult.apPassword), decodedPass);
                } else {
                    Serial.println("[ACP] Warning: Ignored partial/invalid AP config (keeping existing NVS AP settings).");
                }
            }
            if (kvp.getValue("m", mdnsBuf, sizeof(mdnsBuf))) {
                decodeValue(mdnsBuf, outResult.mdnsHost, sizeof(outResult.mdnsHost));
                outResult.mdnsProvided = true;
            }
        } else if (strncmp(p, "N ", 2) == 0) {
            char mdnsBuf[128] = {0};
            if (kvp.getValue("m", mdnsBuf, sizeof(mdnsBuf))) {
                decodeValue(mdnsBuf, outResult.mdnsHost, sizeof(outResult.mdnsHost));
                outResult.mdnsProvided = true;
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

        if (strcmp(result->segments[i].type, "analog_output") == 0 ||
            strcmp(result->segments[i].type, "pwm_output") == 0) {
            Serial.printf("  [%d] id=%s  type=%s  pin=%d  val=%u (%u-bit @ %uHz)\n",
                i,
                result->segments[i].id,
                result->segments[i].type,
                result->segments[i].pin,
                result->segments[i].analogValue,
                result->segments[i].pwmResolution,
                result->segments[i].pwmFrequency);
        } else if (strcmp(result->segments[i].type, "analog_input") == 0 ||
                   strcmp(result->segments[i].type, "adc_input") == 0) {
            Serial.printf("  [%d] id=%s  type=%s  pin=%d  (%u-bit sint=%ums delta=%u ath=%u atl=%u ranges=%u)\n",
                i,
                result->segments[i].id,
                result->segments[i].type,
                result->segments[i].pin,
                result->segments[i].adcResolution,
                result->segments[i].adcSampleIntervalMs,
                result->segments[i].adcDeltaThreshold,
                result->segments[i].adcHighThreshold,
                result->segments[i].adcLowThreshold,
                static_cast<unsigned int>(result->segments[i].rule.analogRangeCount));
        } else {
            Serial.printf("  [%d] id=%s  type=%s  pin=%d  val=%s\n",
                i,
                result->segments[i].id,
                result->segments[i].type,
                result->segments[i].pin,
                result->segments[i].value ? "ON" : "OFF");
        }
    }

    Serial.println("=======================================");
}

namespace rule_codec {

static int32_t readInt32LE(const uint8_t* buf, size_t offset) {
    const uint32_t value = static_cast<uint32_t>(buf[offset]) |
        (static_cast<uint32_t>(buf[offset + 1]) << 8) |
        (static_cast<uint32_t>(buf[offset + 2]) << 16) |
        (static_cast<uint32_t>(buf[offset + 3]) << 24);
    return static_cast<int32_t>(value);
}

static int16_t readInt16LE(const uint8_t* buf, size_t offset) {
    const uint16_t value = static_cast<uint16_t>(buf[offset]) |
        (static_cast<uint16_t>(buf[offset + 1]) << 8);
    return static_cast<int16_t>(value);
}

static uint16_t readUint16LE(const uint8_t* buf, size_t offset) {
    return static_cast<uint16_t>(buf[offset]) |
        (static_cast<uint16_t>(buf[offset + 1]) << 8);
}

static bool readConditions(
    const uint8_t* payload,
    size_t len,
    size_t& offset,
    uint8_t condMeta,
    RuleCondition* outConds,
    uint8_t& outCount,
    uint8_t& outLogic
) {
    const uint8_t condCount = static_cast<uint8_t>(condMeta & 0x0FU);
    const uint8_t condLogic = static_cast<uint8_t>((condMeta >> 4) & 0x01U);
    if (condCount > MAX_RULE_CONDITIONS_PER_ACTION) return false;
    if (offset + static_cast<size_t>(condCount) * 6U > len) return false;

    outCount = condCount;
    outLogic = (condLogic == COND_LOGIC_OR) ? COND_LOGIC_OR : COND_LOGIC_AND;
    for (uint8_t i = 0; i < condCount; ++i) {
        RuleCondition cond;
        cond.sourcePin = static_cast<int8_t>(payload[offset]);
        cond.op = payload[offset + 1];
        cond.value = readUint16LE(payload, offset + 2);
        cond.maxValue = readUint16LE(payload, offset + 4);
        offset += 6;
        if (!isValidRuleCondition(cond)) return false;
        outConds[i] = cond;
    }
    return true;
}

static bool readDigitalRuleAction(
    const uint8_t* payload,
    size_t len,
    size_t& offset,
    RuleAction& action,
    uint8_t opcode
) {
    const bool withAnalogTarget = (opcode == 0x0B || opcode == 0x12);
    const bool withConditions = (opcode == 0x12);
    const size_t baseSize = withConditions ? 14U : (withAnalogTarget ? 13U : 11U);
    if (offset + baseSize > len) return false;

    action.reset();
    const int targetPin = static_cast<int8_t>(payload[offset]);
    const int32_t holdTime = readInt32LE(payload, offset + 1);
    const bool actionState = payload[offset + 5] == 0x01;
    const uint8_t actionType = payload[offset + 6];
    const int32_t delay = readInt32LE(payload, offset + 7);
    int16_t targetValue = RULE_ANALOG_VALUE_UNSET;
    if (withAnalogTarget) {
        targetValue = readInt16LE(payload, offset + 11);
    }
    const uint8_t condMeta = withConditions ? payload[offset + 13] : 0;
    offset += baseSize;

    if (!isValidManagedPin(targetPin) || !isValidDigitalHoldTime(holdTime) ||
        actionType > ACTION_FOR_DURATION || delay < 0 || delay > 60) {
        return false;
    }
    if (targetValue != RULE_ANALOG_VALUE_UNSET &&
        (targetValue < 0 || targetValue > MAX_ANALOG_OUTPUT_VALUE)) {
        return false;
    }

    action.targetPin = static_cast<int8_t>(targetPin);
    action.requiredHoldTime = static_cast<int8_t>(holdTime);
    action.targetValue = targetValue;
    action.actionState = (targetValue != RULE_ANALOG_VALUE_UNSET) ? (targetValue > 0) : actionState;
    action.actionType = static_cast<RuleActionType>(actionType);
    action.delay = static_cast<uint8_t>(delay);

    if (withConditions) {
        return readConditions(
            payload, len, offset, condMeta,
            action.conditions, action.conditionCount, action.conditionLogic);
    }
    return true;
}

bool parseBinaryRuleUpdate(const uint8_t* payload, size_t len, int& outInputPin, RuleConfig& outRule) {
    outRule.reset();
    if (payload == nullptr || len < 4) return false;

    const uint8_t opcode = payload[0];
    if (opcode != 0x05 && opcode != 0x0B && opcode != 0x12) return false;

    const int maxActions = (opcode == 0x12) ? static_cast<int>(MAX_RULE_ACTIONS_PER_SIDE) : 4;
    size_t offset = 1;
    const int inputPin = payload[offset++];
    if (!isValidManagedPin(inputPin) || offset >= len) return false;

    const uint8_t highCount = payload[offset++];
    if (highCount > maxActions) return false;
    for (uint8_t i = 0; i < highCount; ++i) {
        RuleAction action;
        if (!readDigitalRuleAction(payload, len, offset, action, opcode)) return false;
        outRule.highActions[outRule.highActionCount++] = action;
    }

    if (offset >= len) return false;
    const uint8_t lowCount = payload[offset++];
    if (lowCount > maxActions) return false;
    for (uint8_t i = 0; i < lowCount; ++i) {
        RuleAction action;
        if (!readDigitalRuleAction(payload, len, offset, action, opcode)) return false;
        outRule.lowActions[outRule.lowActionCount++] = action;
    }

    if (offset != len) return false;
    outRule.active = (outRule.highActionCount > 0 || outRule.lowActionCount > 0);
    outInputPin = inputPin;
    return true;
}

bool parseBinaryAnalogRangeUpdate(const uint8_t* payload, size_t len, int& outInputPin, RuleConfig& outRule) {
    outRule.reset();
    if (payload == nullptr || len < 3) return false;

    const uint8_t opcode = payload[0];
    if (opcode != 0x0E && opcode != 0x13) return false;
    const bool withConditions = (opcode == 0x13);

    const int inputPin = payload[1];
    const uint8_t rangeCount = payload[2];
    if (!isValidManagedPin(inputPin) || rangeCount > MAX_ANALOG_RANGE_RULES) return false;
    if (!withConditions && len != (3U + static_cast<size_t>(rangeCount) * 12U)) return false;

    size_t offset = 3;
    for (uint8_t i = 0; i < rangeCount; ++i) {
        if (offset + 12U > len) return false;
        uint16_t minVal = readUint16LE(payload, offset);
        uint16_t maxVal = readUint16LE(payload, offset + 2);
        const uint16_t hyst = readUint16LE(payload, offset + 4);
        const int8_t targetPin = static_cast<int8_t>(payload[offset + 6]);
        const uint8_t flags = payload[offset + 7];
        const uint8_t delay = payload[offset + 8];
        const int16_t targetValue = readInt16LE(payload, offset + 9);
        const uint8_t condMeta = withConditions ? payload[offset + 11] : 0;
        offset += 12;

        const bool actionState = (flags & 0x01U) != 0U;
        const uint8_t actionType = static_cast<uint8_t>((flags >> 1) & 0x03U);
        const uint8_t triggerMode = static_cast<uint8_t>((flags >> 3) & 0x01U);

        if (minVal > MAX_ANALOG_INPUT_VALUE || maxVal > MAX_ANALOG_INPUT_VALUE ||
            hyst > (MAX_ANALOG_INPUT_VALUE / 2U) ||
            !isValidManagedPin(targetPin) ||
            actionType > ACTION_FOR_DURATION || delay > 60) {
            return false;
        }
        if (targetValue != RULE_ANALOG_VALUE_UNSET &&
            (targetValue < 0 || targetValue > MAX_ANALOG_OUTPUT_VALUE)) {
            return false;
        }
        if (minVal > maxVal) {
            const uint16_t tmp = minVal;
            minVal = maxVal;
            maxVal = tmp;
        }

        AnalogRangeRule& rr = outRule.analogRanges[outRule.analogRangeCount++];
        rr.reset();
        rr.minValue = minVal;
        rr.maxValue = maxVal;
        rr.hysteresis = hyst;
        rr.targetPin = targetPin;
        rr.delay = delay;
        rr.actionType = static_cast<RuleActionType>(actionType);
        rr.triggerMode = static_cast<AnalogRangeTriggerMode>(triggerMode);
        rr.targetValue = targetValue;
        rr.actionState = (targetValue != RULE_ANALOG_VALUE_UNSET) ? (targetValue > 0) : actionState;
        rr.enabled = true;

        if (withConditions && !readConditions(
                payload, len, offset, condMeta,
                rr.conditions, rr.conditionCount, rr.conditionLogic)) {
            return false;
        }
    }

    if (offset != len) return false;
    outRule.active = (outRule.analogRangeCount > 0);
    outInputPin = inputPin;
    return true;
}

} // namespace rule_codec

} // namespace uniuno
