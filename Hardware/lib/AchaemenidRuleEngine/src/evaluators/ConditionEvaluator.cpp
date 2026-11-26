#include "ConditionEvaluator.h"

namespace uniuno {
namespace rules {

HOT_PATH bool ConditionEvaluator::evaluateSingle(const RuleCondition& cond, const PinManager* pinManager) {
    if (UNLIKELY(pinManager == nullptr || !isValidManagedPin(cond.sourcePin))) {
        return false;
    }

    if (UNLIKELY(!pinManager->hasPin(cond.sourcePin))) {
        return false;
    }

    if (cond.op == COND_STATE_HIGH) {
        return pinManager->getPinState(cond.sourcePin);
    }

    if (cond.op == COND_STATE_LOW) {
        return !pinManager->getPinState(cond.sourcePin);
    }

    const int16_t rawAnalog = pinManager->getPinAnalogValue(cond.sourcePin);
    if (UNLIKELY(rawAnalog < 0)) {
        return false;
    }

    const uint16_t current = static_cast<uint16_t>(rawAnalog);
    switch (cond.op) {
        case COND_VAL_GT:
            return current > cond.value;
        case COND_VAL_GTE:
            return current >= cond.value;
        case COND_VAL_LT:
            return current < cond.value;
        case COND_VAL_LTE:
            return current <= cond.value;
        case COND_VAL_EQ:
            return current == cond.value;
        case COND_VAL_BETWEEN: {
            const uint16_t lo = (cond.value <= cond.maxValue) ? cond.value : cond.maxValue;
            const uint16_t hi = (cond.value <= cond.maxValue) ? cond.maxValue : cond.value;
            return current >= lo && current <= hi;
        }
        case COND_VAL_OUTSIDE: {
            const uint16_t lo = (cond.value <= cond.maxValue) ? cond.value : cond.maxValue;
            const uint16_t hi = (cond.value <= cond.maxValue) ? cond.maxValue : cond.value;
            return current < lo || current > hi;
        }
        default:
            return false;
    }
}

HOT_PATH bool ConditionEvaluator::evaluateAll(
    const RuleCondition* conditions,
    uint8_t count,
    uint8_t logic,
    const PinManager* pinManager
) {
    if (LIKELY(count == 0)) {
        return true;
    }

    if (UNLIKELY(conditions == nullptr || pinManager == nullptr)) {
        return false;
    }

    const uint8_t safeCount = (count <= MAX_RULE_CONDITIONS_PER_ACTION)
        ? count
        : MAX_RULE_CONDITIONS_PER_ACTION;

    if (logic == COND_LOGIC_OR) {
        for (uint8_t i = 0; i < safeCount; ++i) {
            if (evaluateSingle(conditions[i], pinManager)) {
                return true;
            }
        }
        return false;
    }

    for (uint8_t i = 0; i < safeCount; ++i) {
        if (!evaluateSingle(conditions[i], pinManager)) {
            return false;
        }
    }
    return true;
}

} // namespace rules
} // namespace uniuno

