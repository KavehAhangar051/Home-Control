#include "RuleParsers.h"
#include <AppEvents.h>
#include <Utilities/logging.h>
#include <Optimization/CompilerTraits.h>
#include <cstring>

namespace uniuno {

FORCE_INLINE static int32_t readInt32LE(const uint8_t* buf, size_t offset) {
    uint32_t value = static_cast<uint32_t>(buf[offset]) |
        (static_cast<uint32_t>(buf[offset + 1]) << 8) |
        (static_cast<uint32_t>(buf[offset + 2]) << 16) |
        (static_cast<uint32_t>(buf[offset + 3]) << 24);
    return static_cast<int32_t>(value);
}

static bool isValidHoldTime(int32_t value) {
    return value == 0 || value == 3 || value == 5 || value == 10;
}

static bool readAction(const uint8_t* payload, size_t len, size_t& offset, RuleAction& action) {
    if (offset + 11 > len) return false;

    const int targetPin = static_cast<int8_t>(payload[offset]);
    const int32_t holdTime = readInt32LE(payload, offset + 1);
    const uint8_t actionType = payload[offset + 6];
    const int32_t delay = readInt32LE(payload, offset + 7);
    const bool actionState = payload[offset + 5] == 0x01;
    offset += 11;

    if (targetPin < 0 || targetPin > 39 || !isValidHoldTime(holdTime) ||
        actionType > ACTION_FOR_DURATION || delay < 0 || delay > 60) {
        return false;
    }

    action.targetPin = targetPin;
    action.requiredHoldTime = holdTime;
    action.actionState = actionState;
    action.actionType = static_cast<RuleActionType>(actionType);
    action.delay = delay;
    return true;
}

bool RuleParsers::canHandle(uint8_t cmdType) const {
    return cmdType == 0x05;
}

void RuleParsers::handle(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    if (len > 0 && payload[0] == 0x05) {
        parseUpdateRule(payload, len, dispatcher);
    }
}

HOT_PATH IRAM_ATTR void RuleParsers::parseUpdateRule(const uint8_t* payload, size_t len, IEventDispatcher* dispatcher) {
    // Frame: opcode, input GPIO, HIGH count/actions, LOW count/actions.
    if (payload == nullptr || dispatcher == nullptr || len < 4) return;

    size_t offset = 1;
    const int inputPin = payload[offset++];
    if (inputPin > 39) {
        WARNINGF("[MQTT Handler] Rejected UPDATE_RULE: invalid input GPIO %d", inputPin);
        return;
    }

    if (offset >= len) return;
    const uint8_t highCount = payload[offset++];
    if (highCount > 4) {
        WARNING("[MQTT Handler] Rejected UPDATE_RULE: too many HIGH actions");
        return;
    }

    RuleConfig newRule;
    for (uint8_t i = 0; i < highCount; ++i) {
        RuleAction action;
        if (!readAction(payload, len, offset, action)) {
            WARNING("[MQTT Handler] Rejected UPDATE_RULE: invalid or truncated HIGH action");
            return;
        }
        newRule.highActions[newRule.highActionCount++] = action;
    }

    if (offset >= len) {
        WARNING("[MQTT Handler] Rejected UPDATE_RULE: missing LOW action count");
        return;
    }
    const uint8_t lowCount = payload[offset++];
    if (lowCount > 4) {
        WARNING("[MQTT Handler] Rejected UPDATE_RULE: too many LOW actions");
        return;
    }

    for (uint8_t i = 0; i < lowCount; ++i) {
        RuleAction action;
        if (!readAction(payload, len, offset, action)) {
            WARNING("[MQTT Handler] Rejected UPDATE_RULE: invalid or truncated LOW action");
            return;
        }
        newRule.lowActions[newRule.lowActionCount++] = action;
    }

    if (offset != len) {
        WARNING("[MQTT Handler] Rejected UPDATE_RULE: unexpected trailing bytes");
        return;
    }

    newRule.active = (newRule.highActionCount > 0 || newRule.lowActionCount > 0);
    SegmentUpdateRuleRequestEvent evt{inputPin, newRule};
    dispatcher->dispatch(evt);
    INFOF("[MQTT Handler] Binary Update Rule: input_gpio=%d high=%d low=%d active=%d",
          inputPin, newRule.highActionCount, newRule.lowActionCount, newRule.active);
}

} // namespace uniuno
