#include "ActionStrategies.h"
#include "../evaluators/ConditionEvaluator.h"
#include <Utilities/logging.h>
#include <AppEvents.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

/**
 * @brief Helper to update physical pin state (digital or analog PWM) and dispatch state change event.
 */
HOT_PATH FORCE_INLINE static void applyState(int targetPin, bool stateToApply, int16_t analogValue, RuleContext& ctx) {
    if (ctx.pinManager == nullptr) return;

    // An independent automation transition supersedes any Dashboard auto-off timer.
    uniuno::TimerHandle autoOff = ctx.pinManager->getTimerIdByPin(targetPin);
    if (autoOff.isActive()) autoOff.cancel();
    ctx.pinManager->setTimerIdByPin(targetPin, uniuno::TimerHandle());

    bool applied = false;
    if (analogValue >= 0 && ctx.pinManager->isAnalogOutputPin(targetPin)) {
        applied = ctx.pinManager->setPinAnalogValue(targetPin, static_cast<uint16_t>(analogValue));
    } else {
        const bool effectiveState = (analogValue >= 0) ? (analogValue > 0) : stateToApply;
        applied = ctx.pinManager->setPinState(targetPin, effectiveState);
    }

    if (applied) {
        if (ctx.eventBus != nullptr) {
            const bool actualState = ctx.pinManager->getPinState(targetPin);
            const int16_t actualAnalog = ctx.pinManager->getPinAnalogValue(targetPin);
            const uint8_t actualRes = ctx.pinManager->getPinPwmResolution(targetPin);
            PinStateChangedEvent changed{
                targetPin,
                actualState,
                true,
                PinStateChangeOrigin::Automation,
                actualAnalog,
                actualRes
            };
            ctx.eventBus->dispatch(changed);
        }
    } else {
        WARNINGF("[Rule] Action failed: target GPIO %d is not registered as an output segment", targetPin);
    }
}

/**
 * @brief Execute a RuleAction with direct dispatch (no vtable overhead).
 * 
 * @param act The rule action definition containing target pin, state/value, delay, and action type.
 * @param sourcePin The pin that triggered the action.
 * @param ctx System context providing timers, event bus, and pin manager.
 */
HOT_PATH void ActionExecutor::execute(const RuleAction& act, int sourcePin, RuleContext& ctx) {
    if (UNLIKELY(act.targetPin < 0 || ctx.pinManager == nullptr)) return;
    if (!ConditionEvaluator::evaluateAll(act.conditions, act.conditionCount, act.conditionLogic, ctx.pinManager)) {
        return;
    }
    executeUnchecked(act, sourcePin, ctx);
}

HOT_PATH bool ActionExecutor::executeMatchingHold(
    const RuleAction* actions,
    int count,
    int matchHoldTime,
    int sourcePin,
    RuleContext& ctx
) {
    if (UNLIKELY(actions == nullptr || count <= 0 || ctx.pinManager == nullptr)) return false;

    const int safeCount = (count <= MAX_RULE_ACTIONS_PER_SIDE) ? count : MAX_RULE_ACTIONS_PER_SIDE;
    uint16_t passMask = 0;

    // Phase 1: Evaluate all matching actions against the pre-execution pin snapshot
    // so earlier actions in the batch cannot alter conditions seen by sibling actions.
    for (int i = 0; i < safeCount; ++i) {
        if (actions[i].requiredHoldTime == matchHoldTime &&
            ConditionEvaluator::evaluateAll(
                actions[i].conditions,
                actions[i].conditionCount,
                actions[i].conditionLogic,
                ctx.pinManager)) {
            passMask |= static_cast<uint16_t>(1U << i);
        }
    }

    if (passMask == 0) return false;

    // Phase 2: Dispatch all actions whose guard conditions passed
    for (int i = 0; i < safeCount; ++i) {
        if ((passMask & static_cast<uint16_t>(1U << i)) != 0U) {
            executeUnchecked(actions[i], sourcePin, ctx);
        }
    }

    return true;
}

HOT_PATH void ActionExecutor::executeUnchecked(const RuleAction& act, int sourcePin, RuleContext& ctx) {
    (void)sourcePin;
    if (UNLIKELY(act.targetPin < 0 || ctx.pinManager == nullptr)) return;
    
    const int tPin = act.targetPin;
    const bool aState = act.actionState;
    const int16_t aVal = act.targetValue;
    const int actDelay = act.delay;

    // Clear any existing rule action timer for the target pin
    if (ctx.appTimer != nullptr) {
        uniuno::TimerHandle existingTimer = ctx.pinManager->getRuleActionTimerIdByPin(tPin);
        if (existingTimer.isActive()) {
            existingTimer.cancel();
            ctx.pinManager->setRuleActionTimerIdByPin(tPin, uniuno::TimerHandle());
        }
    }

    switch (act.actionType) {
        case ACTION_IMMEDIATE: {
            if (aVal >= 0) {
                INFOF("[Rule] Executing IMMEDIATE analog action: Set Pin %d to duty %d", tPin, aVal);
            } else {
                INFOF("[Rule] Executing IMMEDIATE action: Set Pin %d to %s", tPin, aState ? "HIGH" : "LOW");
            }
            applyState(tPin, aState, aVal, ctx);
            break;
        }

        case ACTION_AFTER_DELAY: {
            if (aVal >= 0) {
                INFOF("[Rule] Executing AFTER_DELAY analog action: Set Pin %d to duty %d after %ds", tPin, aVal, actDelay);
            } else {
                INFOF("[Rule] Executing AFTER_DELAY action: Set Pin %d to %s after %ds", tPin, aState ? "HIGH" : "LOW", actDelay);
            }
            if (ctx.appTimer != nullptr && actDelay > 0 && actDelay <= 60) {
                ctx.pinManager->setPendingRuleActionState(tPin, aState);
                ctx.pinManager->setPendingRuleActionAnalogValue(tPin, aVal);
                uniuno::TimerHandle newTimer = ctx.appTimer->setTimeout([ctx, tPin, aState, aVal]() mutable {
                    if (ctx.pinManager != nullptr) {
                        ctx.pinManager->setRuleActionTimerIdByPin(tPin, uniuno::TimerHandle());
                        ctx.pinManager->setPendingRuleActionAnalogValue(tPin, RULE_ANALOG_VALUE_UNSET);
                    }
                    applyState(tPin, aState, aVal, ctx);
                }, actDelay * 1000);
                ctx.pinManager->setRuleActionTimerIdByPin(tPin, newTimer);
            } else {
                applyState(tPin, aState, aVal, ctx);
            }
            break;
        }

        case ACTION_FOR_DURATION: {
            if (aVal >= 0) {
                INFOF("[Rule] Executing FOR_DURATION analog action: Set Pin %d to duty %d for %ds", tPin, aVal, actDelay);
            } else {
                INFOF("[Rule] Executing FOR_DURATION action: Set Pin %d to %s for %ds", tPin, aState ? "HIGH" : "LOW", actDelay);
            }
            applyState(tPin, aState, aVal, ctx); // Apply immediately
            if (ctx.appTimer != nullptr && actDelay > 0 && actDelay <= 60) {
                const bool reverseState = (aVal >= 0) ? (aVal == 0) : !aState;
                const int16_t reverseAnalog = (aVal > 0 && ctx.pinManager->isAnalogOutputPin(tPin))
                    ? static_cast<int16_t>(0)
                    : RULE_ANALOG_VALUE_UNSET;
                ctx.pinManager->setPendingRuleActionState(tPin, reverseState);
                ctx.pinManager->setPendingRuleActionAnalogValue(tPin, reverseAnalog);
                uniuno::TimerHandle newTimer = ctx.appTimer->setTimeout([ctx, tPin, reverseState, reverseAnalog]() mutable {
                    if (ctx.pinManager != nullptr) {
                        ctx.pinManager->setRuleActionTimerIdByPin(tPin, uniuno::TimerHandle());
                        ctx.pinManager->setPendingRuleActionAnalogValue(tPin, RULE_ANALOG_VALUE_UNSET);
                    }
                    applyState(tPin, reverseState, reverseAnalog, ctx);
                }, actDelay * 1000);
                ctx.pinManager->setRuleActionTimerIdByPin(tPin, newTimer);
            }
            break;
        }

        default:
            break;
    }
}

} // namespace rules
} // namespace uniuno
