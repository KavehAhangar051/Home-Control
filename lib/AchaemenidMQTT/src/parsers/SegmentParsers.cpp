#include "SegmentParsers.h"
#include <AppEvents.h>
#include <Utilities/logging.h>
#include <Optimization/CompilerTraits.h>
#include <Optimization/StaticString.h>

namespace uniuno {

// Helper to safely read a string directly into a StaticString. No Heap allocations!
template <size_t Capacity>
FORCE_INLINE static void readIntoStaticString(const uint8_t* payload, size_t& offset, size_t maxLen,
                                              StaticString<Capacity>& dest) {
  while (offset < maxLen && payload[offset] != '\0' && dest.size() < dest.capacity()) {
    dest += static_cast<char>(payload[offset++]);
  }
  // skip null terminator or remaining characters if truncated
  while (offset < maxLen && payload[offset] != '\0')
    offset++;
  if (offset < maxLen) offset++; // skip null
}

bool SegmentParsers::canHandle(uint8_t cmdType) const {
  return cmdType == 0x02 || cmdType == 0x03 || cmdType == 0x04 || cmdType == 0x0C || cmdType == 0x0F ||
         cmdType == 0x10 || cmdType == 0x11;
}

void SegmentParsers::handle(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
  if (len == 0) return;
  switch (payload[0]) {
  case 0x02:
    parseAddSegment(payload, len, dispatcher);
    break;
  case 0x03:
    parseDeleteSegment(payload, len, dispatcher);
    break;
  case 0x04:
    parseDashboardPresence(payload, len, dispatcher);
    break;
  case 0x0C:
    parseUpdateAnalogInputConfig(payload, len, dispatcher);
    break;
  case 0x0F:
    parseUpsertAuxNode(payload, len, dispatcher);
    break;
  case 0x10:
    parseDeleteAuxNode(payload, len, dispatcher);
    break;
  case 0x11:
    parseAddVirtualSegment(payload, len, dispatcher);
    break;
  default:
    break;
  }
}

FORCE_INLINE static uint16_t readUint16LE(const uint8_t* buf, size_t offset) {
  return static_cast<uint16_t>(buf[offset]) | (static_cast<uint16_t>(buf[offset + 1]) << 8);
}

struct ParsedSegmentTrailingMeta {
  uint8_t pwmResolution = DEFAULT_PWM_RESOLUTION;
  uint16_t pwmFrequency = DEFAULT_PWM_FREQUENCY;
  uint16_t initialValue = 0;
  uint8_t adcResolution = DEFAULT_ADC_RESOLUTION;
  uint16_t adcSampleIntervalMs = DEFAULT_ADC_SAMPLE_INTERVAL_MS;
  uint16_t adcDeltaThreshold = DEFAULT_ADC_DELTA_THRESHOLD;
  uint16_t adcHighThreshold = 0;
  uint16_t adcLowThreshold = 0;
  bool isAnalogInput = false;
};

static void parseTrailingSegmentMetadata(const uint8_t* payload, size_t& offset, size_t len, const char* typeStr,
                                         uint8_t legacyVal, ParsedSegmentTrailingMeta& out) {
  out.initialValue = legacyVal;
  out.isAnalogInput = (strcmp(typeStr, "analog_input") == 0 || strcmp(typeStr, "adc_input") == 0);

  if (out.isAnalogInput) {
    // Progressive optional trailing ADC metadata (up to 9 bytes):
    // [res:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]
    if (offset < len) {
      const uint8_t rawRes = payload[offset++];
      if (rawRes >= MIN_ADC_RESOLUTION && rawRes <= MAX_ADC_RESOLUTION) {
        out.adcResolution = rawRes;
      }
    }
    const uint16_t maxAdcVal = static_cast<uint16_t>((1UL << out.adcResolution) - 1UL);
    if (offset + 2 <= len) {
      const uint16_t rawSint = readUint16LE(payload, offset);
      offset += 2;
      if (rawSint < MIN_ADC_SAMPLE_INTERVAL_MS) {
        out.adcSampleIntervalMs = MIN_ADC_SAMPLE_INTERVAL_MS;
      } else if (rawSint > MAX_ADC_SAMPLE_INTERVAL_MS) {
        out.adcSampleIntervalMs = MAX_ADC_SAMPLE_INTERVAL_MS;
      } else {
        out.adcSampleIntervalMs = rawSint;
      }
    }
    if (offset + 2 <= len) {
      const uint16_t rawDelta = readUint16LE(payload, offset);
      offset += 2;
      if (rawDelta < MIN_ADC_DELTA_THRESHOLD) {
        out.adcDeltaThreshold = MIN_ADC_DELTA_THRESHOLD;
      } else if (rawDelta > maxAdcVal) {
        out.adcDeltaThreshold = maxAdcVal;
      } else {
        out.adcDeltaThreshold = rawDelta;
      }
    } else if (out.adcDeltaThreshold > maxAdcVal) {
      out.adcDeltaThreshold = maxAdcVal;
    }
    if (offset + 2 <= len) {
      const uint16_t rawAth = readUint16LE(payload, offset);
      offset += 2;
      out.adcHighThreshold = rawAth > maxAdcVal ? maxAdcVal : rawAth;
    }
    if (offset + 2 <= len) {
      const uint16_t rawAtl = readUint16LE(payload, offset);
      offset += 2;
      out.adcLowThreshold =
          (out.adcHighThreshold == 0) ? 0 : (rawAtl > out.adcHighThreshold ? out.adcHighThreshold : rawAtl);
    }
  } else {
    // Backward-compatible optional trailing PWM metadata (up to 5 bytes):
    // [res:u8] or [res:u8][freq:u16LE] or [res:u8][freq:u16LE][initVal:u16LE]
    if (offset < len) {
      const uint8_t rawRes = payload[offset++];
      if (rawRes >= MIN_PWM_RESOLUTION && rawRes <= MAX_PWM_RESOLUTION) {
        out.pwmResolution = rawRes;
      }
    }
    if (offset + 2 <= len) {
      const uint16_t rawFreq = readUint16LE(payload, offset);
      offset += 2;
      if (rawFreq >= MIN_PWM_FREQUENCY && rawFreq <= MAX_PWM_FREQUENCY) {
        out.pwmFrequency = rawFreq;
      }
    }
    if (offset + 2 <= len) {
      const uint16_t rawInit = readUint16LE(payload, offset);
      offset += 2;
      out.initialValue = rawInit > MAX_ANALOG_OUTPUT_VALUE ? MAX_ANALOG_OUTPUT_VALUE : rawInit;
    }
  }
}

HOT_PATH IRAM_ATTR void SegmentParsers::parseAddSegment(const uint8_t* payload, size_t len,
                                                        IEventDispatcher* dispatcher) {
  if (LIKELY(len >= 6)) {
    const int pinNum = payload[1];
    const uint8_t legacyVal = payload[2];
    size_t offset = 3;

    StaticString<32> idStr;
    StaticString<32> typeStr;

    readIntoStaticString(payload, offset, len, idStr);
    readIntoStaticString(payload, offset, len, typeStr);

    ParsedSegmentTrailingMeta meta;
    parseTrailingSegmentMetadata(payload, offset, len, typeStr.c_str(), legacyVal, meta);

    SegmentAddRequestEvent evt{idStr.c_str(),         typeStr.c_str(),          pinNum,
                               meta.pwmResolution,    meta.pwmFrequency,        meta.initialValue,
                               meta.adcResolution,    meta.adcSampleIntervalMs, meta.adcDeltaThreshold,
                               meta.adcHighThreshold, meta.adcLowThreshold};
    dispatcher->dispatch(evt);
    if (meta.isAnalogInput) {
      INFOF("[MQTT Handler] Binary Add: id=%s type=%s pin=%d (res=%u sint=%ums delta=%u ath=%u atl=%u)", idStr.c_str(),
            typeStr.c_str(), pinNum, meta.adcResolution, meta.adcSampleIntervalMs, meta.adcDeltaThreshold,
            meta.adcHighThreshold, meta.adcLowThreshold);
    } else {
      INFOF("[MQTT Handler] Binary Add: id=%s type=%s pin=%d (res=%u freq=%uHz init=%u)", idStr.c_str(),
            typeStr.c_str(), pinNum, meta.pwmResolution, meta.pwmFrequency, meta.initialValue);
    }
  }
}

/**
 * @brief Parse binary DELETE_SEGMENT (0x03) command frame.
 * Legacy frame: [0x03][id_ascii...][0x00]
 * Extended v2:  [0x03][id_ascii...][0x00][pin:u8]  (optional trailing GPIO 0..39 fallback)
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseDeleteSegment(const uint8_t* payload, size_t len,
                                                           IEventDispatcher* dispatcher) {
  if (UNLIKELY(payload == nullptr || dispatcher == nullptr || len < 2)) {
    return;
  }

  size_t offset = 1;

  StaticString<32> idStr;
  readIntoStaticString(payload, offset, len, idStr);

  int fallbackPin = -1;
  if (offset < len) {
    const uint8_t rawPin = payload[offset];
    if (isValidManagedPin(static_cast<int>(rawPin))) {
      fallbackPin = static_cast<int>(rawPin);
    } else {
      WARNINGF("[MQTT Handler] Ignoring out-of-range fallback pin %u in DELETE_SEGMENT (0x03)", rawPin);
    }
  }

  if (idStr.empty() && fallbackPin < 0) {
    WARNING("[MQTT Handler] Rejected DELETE_SEGMENT (0x03): empty ID and no valid fallback pin");
    return;
  }

  SegmentRemoveRequestEvent evt{idStr.c_str(), fallbackPin};
  dispatcher->dispatch(evt);
  if (fallbackPin >= 0) {
    INFOF("[MQTT Handler] Binary Delete: id=%s pin=%d", idStr.c_str(), fallbackPin);
  } else {
    INFOF("[MQTT Handler] Binary Delete: id=%s", idStr.c_str());
  }
}

HOT_PATH IRAM_ATTR void SegmentParsers::parseDashboardPresence(const uint8_t* payload, size_t len,
                                                               IEventDispatcher* dispatcher) {
  if (LIKELY(len >= 2)) {
    bool isOnline = (payload[1] == 0x01);
    DashboardPresenceEvent evt{isOnline};
    dispatcher->dispatch(evt);
    INFOF("[MQTT Handler] Binary Presence: %s", isOnline ? "online" : "offline");
  }
}

/**
 * @brief Parse binary UPDATE_ANALOG_INPUT_CONFIG (0x0C) command frame.
 * Frame (10 bytes): [0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE]
 * Frame (11 bytes): [0x0C][pin:u8][sint:u16LE][delta:u16LE][ath:u16LE][atl:u16LE][res:u8]
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseUpdateAnalogInputConfig(const uint8_t* payload, size_t len,
                                                                     IEventDispatcher* dispatcher) {
  if (UNLIKELY(payload == nullptr || dispatcher == nullptr || (len != 10 && len != 11))) {
    WARNING("[MQTT Handler] Rejected UPDATE_ANALOG_INPUT_CONFIG (0x0C): invalid frame length");
    return;
  }

  const int pinNum = payload[1];
  if (UNLIKELY(!isValidManagedPin(pinNum))) {
    WARNINGF("[MQTT Handler] Rejected UPDATE_ANALOG_INPUT_CONFIG (0x0C): invalid pin %d", pinNum);
    return;
  }

  const uint16_t sampleIntervalMs = readUint16LE(payload, 2);
  const uint16_t deltaThreshold = readUint16LE(payload, 4);
  const uint16_t highThreshold = readUint16LE(payload, 6);
  const uint16_t lowThreshold = readUint16LE(payload, 8);
  const uint8_t resolution = (len == 11) ? payload[10] : 0;

  if (resolution != 0 && (resolution < MIN_ADC_RESOLUTION || resolution > MAX_ADC_RESOLUTION)) {
    WARNINGF("[MQTT Handler] Rejected UPDATE_ANALOG_INPUT_CONFIG (0x0C): invalid resolution %u", resolution);
    return;
  }

  SegmentUpdateAnalogInputConfigRequestEvent evt{pinNum,        sampleIntervalMs, deltaThreshold,
                                                 highThreshold, lowThreshold,     resolution};
  dispatcher->dispatch(evt);
  INFOF("[MQTT Handler] Binary Update ADC Config (0x0C): pin=%d sint=%ums delta=%u ath=%u atl=%u res=%u", pinNum,
        sampleIntervalMs, deltaThreshold, highThreshold, lowThreshold, resolution);
}

/**
 * @brief Parse binary UPSERT_AUX_NODE (0x0F) command frame.
 * Frame: [0x0F][nodeId:u8 (1..16)][mac:6B][pinCapacity:u8 (1..32)][chipType:u8 (0..5)][name_utf8...][0x00]
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseUpsertAuxNode(const uint8_t* payload, size_t len,
                                                           IEventDispatcher* dispatcher) {
  if (UNLIKELY(payload == nullptr || dispatcher == nullptr || len < 10)) {
    WARNING("[MQTT Handler] Rejected UPSERT_AUX_NODE (0x0F): frame too short");
    return;
  }

  const uint8_t nodeId = payload[1];
  uint8_t mac[6];
  memcpy(mac, payload + 2, 6);
  const uint8_t pinCapacity = payload[8];
  const uint8_t rawChip = payload[9];

  if (!isValidAuxNodeId(nodeId)) {
    WARNINGF("[MQTT Handler] Rejected UPSERT_AUX_NODE (0x0F): invalid nodeId %u", nodeId);
    return;
  }
  if (!isValidUnicastMac(mac)) {
    WARNING("[MQTT Handler] Rejected UPSERT_AUX_NODE (0x0F): invalid unicast MAC");
    return;
  }
  if (pinCapacity < 1 || pinCapacity > MAX_AUX_NODE_PIN_CAPACITY) {
    WARNINGF("[MQTT Handler] Rejected UPSERT_AUX_NODE (0x0F): invalid pinCapacity %u", pinCapacity);
    return;
  }
  if (rawChip > AUX_CHIP_MAX) {
    WARNINGF("[MQTT Handler] Rejected UPSERT_AUX_NODE (0x0F): invalid chipType %u", rawChip);
    return;
  }

  StaticString<32> nameStr;
  size_t offset = 10;
  if (offset < len) {
    readIntoStaticString(payload, offset, len, nameStr);
  }

  AuxNodeUpsertRequestEvent evt{};
  evt.nodeId = nodeId;
  memcpy(evt.mac, mac, 6);
  evt.pinCapacity = pinCapacity;
  evt.chipType = static_cast<AuxChipType>(rawChip);
  evt.name = nameStr.c_str();
  dispatcher->dispatch(evt);

  char macText[18];
  formatMacAddress(mac, macText, sizeof(macText));
  INFOF("[MQTT Handler] Binary Upsert Aux Node (0x0F): id=%u mac=%s cap=%u chip=%u name='%s'", nodeId, macText,
        pinCapacity, rawChip, nameStr.c_str());
}

/**
 * @brief Parse binary DELETE_AUX_NODE (0x10) command frame.
 * Frame: [0x10][nodeId:u8 (0..16)][flags:u8][optional mac:6B]
 * flags bit0: cascadeSegments (1 = remove bound virtual segments too)
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseDeleteAuxNode(const uint8_t* payload, size_t len,
                                                           IEventDispatcher* dispatcher) {
  if (UNLIKELY(payload == nullptr || dispatcher == nullptr || len < 2)) {
    WARNING("[MQTT Handler] Rejected DELETE_AUX_NODE (0x10): frame too short");
    return;
  }

  const uint8_t nodeId = payload[1];
  const uint8_t flags = (len >= 3) ? payload[2] : 0x01;
  const bool cascadeSegments = (flags & 0x01U) != 0U;

  uint8_t mac[6] = {0, 0, 0, 0, 0, 0};
  bool hasMac = false;
  if (len >= 9) {
    memcpy(mac, payload + 3, 6);
    if (isValidUnicastMac(mac)) {
      hasMac = true;
    } else {
      WARNING("[MQTT Handler] Ignoring invalid MAC in DELETE_AUX_NODE (0x10)");
    }
  }

  if (!isValidAuxNodeId(nodeId) && !hasMac) {
    WARNINGF("[MQTT Handler] Rejected DELETE_AUX_NODE (0x10): invalid nodeId %u and no valid MAC", nodeId);
    return;
  }

  AuxNodeRemoveRequestEvent evt{};
  evt.nodeId = nodeId;
  memcpy(evt.mac, mac, 6);
  evt.hasMac = hasMac;
  evt.cascadeSegments = cascadeSegments;
  dispatcher->dispatch(evt);

  INFOF("[MQTT Handler] Binary Delete Aux Node (0x10): id=%u hasMac=%d cascade=%d", nodeId, hasMac ? 1 : 0,
        cascadeSegments ? 1 : 0);
}

/**
 * @brief Parse binary ADD_VIRTUAL_SEGMENT (0x11) command frame.
 * Frame: [0x11][virtualPin:u8 (40..127)][nodeId:u8 (1..16)][remotePin:u8 (0..39)][initState:u8]
 *        [id_ascii...][0x00][type_ascii...][0x00][optional PWM 5B or ADC 9B metadata]
 */
HOT_PATH IRAM_ATTR void SegmentParsers::parseAddVirtualSegment(const uint8_t* payload, size_t len,
                                                               IEventDispatcher* dispatcher) {
  if (UNLIKELY(payload == nullptr || dispatcher == nullptr || len < 8)) {
    WARNING("[MQTT Handler] Rejected ADD_VIRTUAL_SEGMENT (0x11): frame too short");
    return;
  }

  const int virtualPin = static_cast<int>(payload[1]);
  const uint8_t nodeId = payload[2];
  const uint8_t remotePin = payload[3];
  const uint8_t legacyVal = payload[4];

  if (!isVirtualPin(virtualPin)) {
    WARNINGF("[MQTT Handler] Rejected ADD_VIRTUAL_SEGMENT (0x11): pin %d not in virtual range 40..127", virtualPin);
    return;
  }
  if (!isValidAuxNodeId(nodeId)) {
    WARNINGF("[MQTT Handler] Rejected ADD_VIRTUAL_SEGMENT (0x11): invalid nodeId %u", nodeId);
    return;
  }
  if (!isValidAuxRemotePin(remotePin)) {
    WARNINGF("[MQTT Handler] Rejected ADD_VIRTUAL_SEGMENT (0x11): invalid remotePin %u", remotePin);
    return;
  }

  size_t offset = 5;
  StaticString<32> idStr;
  StaticString<32> typeStr;
  readIntoStaticString(payload, offset, len, idStr);
  readIntoStaticString(payload, offset, len, typeStr);

  if (idStr.empty() || typeStr.empty()) {
    WARNING("[MQTT Handler] Rejected ADD_VIRTUAL_SEGMENT (0x11): empty id or type");
    return;
  }

  ParsedSegmentTrailingMeta meta;
  parseTrailingSegmentMetadata(payload, offset, len, typeStr.c_str(), legacyVal, meta);

  VirtualSegmentAddRequestEvent evt{idStr.c_str(),
                                    typeStr.c_str(),
                                    virtualPin,
                                    nodeId,
                                    remotePin,
                                    meta.pwmResolution,
                                    meta.pwmFrequency,
                                    meta.initialValue,
                                    meta.adcResolution,
                                    meta.adcSampleIntervalMs,
                                    meta.adcDeltaThreshold,
                                    meta.adcHighThreshold,
                                    meta.adcLowThreshold};
  dispatcher->dispatch(evt);

  INFOF("[MQTT Handler] Binary Add Virtual Segment (0x11): id=%s type=%s vpin=%d node=%u rpin=%u", idStr.c_str(),
        typeStr.c_str(), virtualPin, nodeId, remotePin);
}

} // namespace uniuno
