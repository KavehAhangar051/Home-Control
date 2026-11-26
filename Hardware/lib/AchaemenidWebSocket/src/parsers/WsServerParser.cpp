#include "WsServerParser.h"
#include <AppEvents.h>
#include <PinManager.h>
#include <Arduino.h>
#include <Events/EventHash.h>
#include <utility>
#include <cstdlib>

namespace uniuno {

WsServerParser::WsServerParser(IEventDispatcher* dispatcher, StateProvider stateProvider)
    : _dispatcher(dispatcher), _stateProvider(std::move(stateProvider)) {}

/**
 * @brief Zero-heap message parser for dashboard commands using single-scan hash dispatch.
 */
HOT_PATH void WsServerParser::parseMessage(const String& data, websockets::WebsocketsClient& client) {
  // Single search for command tag instead of multi-pass indexOf scans
  const int cmdIdx = data.indexOf("\"command\":\"");
  if (cmdIdx < 0) return;

  const char* cmdPtr = data.c_str() + cmdIdx + 11;
  uint32_t cmdHash = 5381;
  while (*cmdPtr && *cmdPtr != '"') {
    cmdHash = ((cmdHash << 5) + cmdHash) + static_cast<uint8_t>(*cmdPtr++);
  }

  constexpr uint32_t HASH_GET_STATE = hash_event_name("get_state");
  constexpr uint32_t HASH_SET_STATE = hash_event_name("set_state");
  constexpr uint32_t HASH_SET_ANALOG = hash_event_name("set_analog");
  constexpr uint32_t HASH_READ_ANALOG = hash_event_name("read_analog");
  constexpr uint32_t HASH_CONFIG_ANALOG_INPUT = hash_event_name("config_analog_input");

  switch (cmdHash) {
  case HASH_GET_STATE: {
    const String stateJson = _stateProvider ? _stateProvider() : "{}";
    client.send(stateJson);
    break;
  }

  case HASH_SET_STATE:
  case HASH_SET_ANALOG: {
    // Zero-heap integer parsing avoiding temporary String substring allocations
    const int pinIdx = data.indexOf("\"pin\":");
    const int valueIdx = data.indexOf("\"value\":");
    const int stateIdx = data.indexOf("\"state\":");
    if (pinIdx >= 0 && _dispatcher != nullptr) {
      const int pin = atoi(data.c_str() + pinIdx + 6);
      const int timerIdx = data.indexOf("\"timer\":");
      const int autoOff = timerIdx >= 0 ? atoi(data.c_str() + timerIdx + 8) : 0;

      if (valueIdx >= 0) {
        int rawVal = atoi(data.c_str() + valueIdx + 8);
        if (rawVal < 0) rawVal = 0;
        if (rawVal > MAX_ANALOG_OUTPUT_VALUE) rawVal = MAX_ANALOG_OUTPUT_VALUE;
        PinStateChangeRequestEvent evt = PinStateChangeRequestEvent::analog(pin, static_cast<uint16_t>(rawVal), autoOff,
                                                                            PinStateChangeOrigin::DashboardCommand);
        _dispatcher->dispatch(evt);
      } else if (stateIdx >= 0) {
        const int state = atoi(data.c_str() + stateIdx + 8);
        PinStateChangeRequestEvent evt{pin, state == 1, autoOff, PinStateChangeOrigin::DashboardCommand};
        _dispatcher->dispatch(evt);
      }
    }
    break;
  }

  case HASH_READ_ANALOG: {
    const int pinIdx = data.indexOf("\"pin\":");
    if (pinIdx >= 0 && _dispatcher != nullptr) {
      const int pin = atoi(data.c_str() + pinIdx + 6);
      if (isValidManagedPin(pin)) {
        AnalogInputReadRequestEvent evt{pin};
        _dispatcher->dispatch(evt);
      }
    }
    break;
  }

  case HASH_CONFIG_ANALOG_INPUT: {
    const int pinIdx = data.indexOf("\"pin\":");
    if (pinIdx >= 0 && _dispatcher != nullptr) {
      const int pin = atoi(data.c_str() + pinIdx + 6);
      if (isValidManagedPin(pin)) {
        const int sintIdx = data.indexOf("\"sint\":");
        const int deltaIdx = data.indexOf("\"delta\":");
        const int athIdx = data.indexOf("\"ath\":");
        const int atlIdx = data.indexOf("\"atl\":");
        const int resIdx = data.indexOf("\"res\":");

        const int rawSint = sintIdx >= 0 ? atoi(data.c_str() + sintIdx + 7) : DEFAULT_ADC_SAMPLE_INTERVAL_MS;
        const int rawDelta = deltaIdx >= 0 ? atoi(data.c_str() + deltaIdx + 8) : DEFAULT_ADC_DELTA_THRESHOLD;
        const int rawAth = athIdx >= 0 ? atoi(data.c_str() + athIdx + 6) : 0;
        const int rawAtl = atlIdx >= 0 ? atoi(data.c_str() + atlIdx + 6) : 0;
        const int rawRes = resIdx >= 0 ? atoi(data.c_str() + resIdx + 6) : 0;

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

} // namespace uniuno
