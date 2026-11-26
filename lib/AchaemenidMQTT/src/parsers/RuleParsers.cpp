#include "RuleParsers.h"
#include <AchaemenidConfigProtocol.h>
#include <AppEvents.h>
#include <Utilities/logging.h>
#include <Optimization/CompilerTraits.h>
#include <memory>

namespace uniuno {

bool RuleParsers::canHandle(uint8_t cmdType) const {
  return cmdType == 0x05 || cmdType == 0x0B || cmdType == 0x0E || cmdType == 0x12 || cmdType == 0x13;
}

void RuleParsers::handle(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
  if (len == 0 || payload == nullptr) return;
  const uint8_t op = payload[0];
  if (op == 0x05 || op == 0x0B || op == 0x12) {
    parseUpdateRule(payload, len, dispatcher);
  } else if (op == 0x0E || op == 0x13) {
    parseUpdateAnalogRangeRules(payload, len, dispatcher);
  }
}

HOT_PATH IRAM_ATTR void RuleParsers::parseUpdateRule(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
  if (payload == nullptr || dispatcher == nullptr || len < 4) return;

  std::unique_ptr<SegmentUpdateRuleRequestEvent> evt(new (std::nothrow) SegmentUpdateRuleRequestEvent());
  if (!evt) {
    WARNING("[MQTT Handler] Out of heap memory parsing UPDATE_RULE");
    return;
  }

  if (!rule_codec::parseBinaryRuleUpdate(payload, len, evt->pin, evt->rule)) {
    WARNINGF("[MQTT Handler] Rejected binary rule frame (0x%02X, len=%u)", payload[0], static_cast<unsigned int>(len));
    return;
  }

  dispatcher->dispatch(*evt);
  INFOF("[MQTT Handler] Binary Update Rule (0x%02X): input_gpio=%d high=%d low=%d active=%d", payload[0], evt->pin,
        evt->rule.highActionCount, evt->rule.lowActionCount, evt->rule.active);
}

HOT_PATH IRAM_ATTR void RuleParsers::parseUpdateAnalogRangeRules(const uint8_t* payload, size_t len,
                                                                 IEventDispatcher* dispatcher) {
  if (payload == nullptr || dispatcher == nullptr || len < 3) return;

  std::unique_ptr<SegmentUpdateRuleRequestEvent> evt(new (std::nothrow) SegmentUpdateRuleRequestEvent());
  if (!evt) {
    WARNING("[MQTT Handler] Out of heap memory parsing UPDATE_ANALOG_RANGE_RULES");
    return;
  }

  if (!rule_codec::parseBinaryAnalogRangeUpdate(payload, len, evt->pin, evt->rule)) {
    WARNINGF("[MQTT Handler] Rejected binary analog range frame (0x%02X, len=%u)", payload[0],
             static_cast<unsigned int>(len));
    return;
  }

  dispatcher->dispatch(*evt);
  INFOF("[MQTT Handler] Binary Update Analog Range Rules (0x%02X): input_gpio=%d ranges=%u active=%d", payload[0],
        evt->pin, static_cast<unsigned int>(evt->rule.analogRangeCount), evt->rule.active);
}

} // namespace uniuno
