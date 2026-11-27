#include "WsServerParser.h"
#include <AppEvents.h>
#include <PinManager.h>
#include <Arduino.h>
#include <Events/EventHash.h>
#include <utility>
#include <cstdlib>
#include <cstring>

namespace uniuno {

WsServerParser::WsServerParser(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : _dispatcher(dispatcher), _stateProvider(std::move(stateProvider)) {}

/**
 * @brief Zero-heap message parser for dashboard commands using single-scan hash dispatch.
 */
HOT_PATH void WsServerParser::parseMessage(const char* data, websockets::WebsocketsClient& client) {
  if (data == nullptr || *data == '\0') return;

  // Single scan for command tag instead of multi-pass String indexOf calls
  const char* cmdTag = std::strstr(data, "\"command\":\"");
  if (cmdTag == nullptr) return;

  const char* cmdPtr = cmdTag + 11;
  uint32_t cmdHash = 5381;
  while (*cmdPtr && *cmdPtr != '"') {
    cmdHash = ((cmdHash << 5) + cmdHash) + static_cast<uint8_t>(*cmdPtr++);
  }

  constexpr uint32_t HASH_GET_STATE = hash_event_name("get_state");
  constexpr uint32_t HASH_SET_STATE = hash_event_name("set_state");
  constexpr uint32_t HASH_SET_ANALOG = hash_event_name("set_analog");
  constexpr uint32_t HASH_READ_ANALOG = hash_event_name("read_analog");
  constexpr uint32_t HASH_CONFIG_ANALOG_INPUT = hash_event_name("config_analog_input");
  constexpr uint32_t HASH_BATCH_STATE = hash_event_name("batch_state");
  constexpr uint32_t HASH_CLIENT_HELLO = hash_event_name("client_hello");

  switch (cmdHash) {
  case HASH_CLIENT_HELLO: {
    Serial.println("[LocalWS] Capacitor dashboard identified; local WebSocket transport selected.");
    client.send("{\"type\":\"transport_ack\",\"transport\":\"websocket\"}");
    break;
  }

  case HASH_GET_STATE: {
    const String stateJson = _stateProvider ? _stateProvider() : "{}";
    client.send(stateJson);
    break;
  }

  case HASH_SET_STATE:
  case HASH_SET_ANALOG: {
    // Zero-heap integer parsing directly over the frame buffer
    const char* pinTag = std::strstr(data, "\"pin\":");
    const char* valueTag = std::strstr(data, "\"value\":");
    const char* stateTag = std::strstr(data, "\"state\":");
    if (pinTag != nullptr && _dispatcher != nullptr) {
      const int pin = std::atoi(pinTag + 6);
      const char* timerTag = std::strstr(data, "\"timer\":");
      const int autoOff = timerTag != nullptr ? std::atoi(timerTag + 8) : 0;

      if (valueTag != nullptr) {
        int rawVal = std::atoi(valueTag + 8);
        if (rawVal < 0) rawVal = 0;
        if (rawVal > MAX_ANALOG_OUTPUT_VALUE) rawVal = MAX_ANALOG_OUTPUT_VALUE;
        PinStateChangeRequestEvent evt = PinStateChangeRequestEvent::analog(pin, static_cast<uint16_t>(rawVal), autoOff,
                                                                            PinStateChangeOrigin::DashboardCommand);
        _dispatcher->dispatch(evt);
      } else if (stateTag != nullptr) {
        const int state = std::atoi(stateTag + 8);
        PinStateChangeRequestEvent evt{pin, state == 1, autoOff, PinStateChangeOrigin::DashboardCommand};
        _dispatcher->dispatch(evt);
      }
    }
    break;
  }

  case HASH_BATCH_STATE: {
    const char* actionsTag = std::strstr(data, "\"actions\"");
    const char* arrayStart = actionsTag != nullptr ? std::strchr(actionsTag, '[') : nullptr;
    const char* arrayEnd = arrayStart != nullptr ? std::strchr(arrayStart, ']') : nullptr;
    if (arrayStart != nullptr && arrayEnd != nullptr && arrayEnd > arrayStart && _dispatcher != nullptr) {
      const char* cursor = std::strchr(arrayStart, '{');
      uint8_t dispatched = 0;
      while (cursor != nullptr && cursor < arrayEnd && dispatched < 32) {
        const char* objectEnd = std::strchr(cursor, '}');
        if (objectEnd == nullptr || objectEnd > arrayEnd) break;
        const char* pinTag = std::strstr(cursor, "\"pin\":");
        const char* stateTag = std::strstr(cursor, "\"state\":");
        if (pinTag != nullptr && pinTag < objectEnd && stateTag != nullptr && stateTag < objectEnd) {
          const int pin = std::atoi(pinTag + 6);
          const char* statePtr = stateTag + 8;
          const bool state = (std::strncmp(statePtr, "true", 4) == 0) || (std::atoi(statePtr) == 1);
          const char* timerTag = std::strstr(cursor, "\"timer\":");
          const int autoOff = (timerTag != nullptr && timerTag < objectEnd) ? std::atoi(timerTag + 8) : 0;
          PinStateChangeRequestEvent evt{pin, state, autoOff, PinStateChangeOrigin::DashboardCommand};
          _dispatcher->dispatch(evt);
          ++dispatched;
        }
        cursor = std::strchr(objectEnd + 1, '{');
      }
      Serial.printf("[LocalWS] Batch command dispatched: %u action(s)\n", static_cast<unsigned int>(dispatched));
    }
    break;
  }

  case HASH_READ_ANALOG: {
    const char* pinTag = std::strstr(data, "\"pin\":");
    if (pinTag != nullptr && _dispatcher != nullptr) {
      const int pin = std::atoi(pinTag + 6);
      if (isValidManagedPin(pin)) {
        AnalogInputReadRequestEvent evt{pin};
        _dispatcher->dispatch(evt);
      }
    }
    break;
  }

  case HASH_CONFIG_ANALOG_INPUT: {
    const char* pinTag = std::strstr(data, "\"pin\":");
    if (pinTag != nullptr && _dispatcher != nullptr) {
      const int pin = std::atoi(pinTag + 6);
      if (isValidManagedPin(pin)) {
        const char* sintTag = std::strstr(data, "\"sint\":");
        const char* deltaTag = std::strstr(data, "\"delta\":");
        const char* athTag = std::strstr(data, "\"ath\":");
        const char* atlTag = std::strstr(data, "\"atl\":");
        const char* resTag = std::strstr(data, "\"res\":");

        const int rawSint = sintTag != nullptr ? std::atoi(sintTag + 7) : DEFAULT_ADC_SAMPLE_INTERVAL_MS;
        const int rawDelta = deltaTag != nullptr ? std::atoi(deltaTag + 8) : DEFAULT_ADC_DELTA_THRESHOLD;
        const int rawAth = athTag != nullptr ? std::atoi(athTag + 6) : 0;
        const int rawAtl = atlTag != nullptr ? std::atoi(atlTag + 6) : 0;
        const int rawRes = resTag != nullptr ? std::atoi(resTag + 6) : 0;

        const uint16_t sint = rawSint < 0 ? 0 : (rawSint > 65535 ? 65535 : static_cast<uint16_t>(rawSint));
        const uint16_t delta = rawDelta < 0 ? 0
                                            : (rawDelta > MAX_ANALOG_INPUT_VALUE ? MAX_ANALOG_INPUT_VALUE
                                                                                 : static_cast<uint16_t>(rawDelta));
        const uint16_t ath =
            rawAth < 0 ? 0 : (rawAth > MAX_ANALOG_INPUT_VALUE ? MAX_ANALOG_INPUT_VALUE : static_cast<uint16_t>(rawAth));
        const uint16_t atl =
            rawAtl < 0 ? 0 : (rawAtl > MAX_ANALOG_INPUT_VALUE ? MAX_ANALOG_INPUT_VALUE : static_cast<uint16_t>(rawAtl));
        const uint8_t res =
            (rawRes >= MIN_ADC_RESOLUTION && rawRes <= MAX_ADC_RESOLUTION) ? static_cast<uint8_t>(rawRes) : 0;

        SegmentUpdateAnalogInputConfigRequestEvent evt{pin, sint, delta, ath, atl, res};
        _dispatcher->dispatch(evt);
      }
    }
    break;
  }

  default:
    break;
  }
}

HOT_PATH void WsServerParser::parseMessage(const String& data, websockets::WebsocketsClient& client) {
  parseMessage(data.c_str(), client);
}

} // namespace uniuno
