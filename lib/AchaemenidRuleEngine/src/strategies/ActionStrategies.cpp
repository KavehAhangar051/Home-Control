#include "ActionStrategies.h"
#include <Utilities/logging.h>
#include <AppEvents.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

/**
 * @brief Helper to update physical pin state and dispatch state change event.
 */
HOT_PATH FORCE_INLINE static void applyState(int targetPin, bool stateToApply, RuleContext& ctx) {
    if (ctx.pinManager == nullptr) return;

    // An independent automation transition supersedes any Dashboard auto-off timer.
    uniuno::TimerHandle autoOff = ctx.pinManager->getTimerIdByPin(targetPin);
    if (autoOff.isActive()) autoOff.cancel();
    ctx.pinManager->setTimerIdByPin(targetPin, uniuno::TimerHandle());

    if (ctx.pinManager->setPinState(targetPin, stateToApply)) {
        if (ctx.eventBus != nullptr) {
            PinStateChangedEvent changed{targetPin, stateToApply, true, PinStateChangeOrigin::Automation};
            ctx.eventBus->dispatch(changed);
        }
    } else {
        WARNINGF("[Rule] Action failed: target GPIO %d is not registered as an output segment", targetPin);
    }
}

/**
 * @brief Execute a RuleAction with direct dispatch (no vtable overhead).
 * 
 * @param act The rule action definition containing target pin, state, delay, and action type.
 * @param sourcePin The pin that triggered the action.
 * @param ctx System context providing timers, event bus, and pin manager.
 */
HOT_PATH void ActionExecutor::execute(const RuleAction& act, int sourcePin, RuleContext& ctx) {
    if (UNLIKELY(act.targetPin < 0 || ctx.pinManager == nullptr)) return;
    
    const int tPin = act.targetPin;
    const bool aState = act.actionState;
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
            INFOF("[Rule] Executing IMMEDIATE action: Set Pin %d to %s", tPin, aState ? "HIGH" : "LOW");
            applyState(tPin, aState, ctx);
            break;
        }

        case ACTION_AFTER_DELAY: {
            INFOF("[Rule] Executing AFTER_DELAY action: Set Pin %d to %s after %ds", tPin, aState ? "HIGH" : "LOW", actDelay);
            if (ctx.appTimer != nullptr && actDelay > 0 && actDelay <= 60) {
                ctx.pinManager->setPendingRuleActionState(tPin, aState);
                uniuno::TimerHandle newTimer = ctx.appTimer->setTimeout([ctx, tPin, aState]() {
                    if (ctx.pinManager != nullptr) {
                        ctx.pinManager->setRuleActionTimerIdByPin(tPin, uniuno::TimerHandle());
                    }
                    applyState(tPin, aState, const_cast<RuleContext&>(ctx));
                }, actDelay * 1000);
                ctx.pinManager->setRuleActionTimerIdByPin(tPin, newTimer);
            } else {
                applyState(tPin, aState, ctx);
            }
            break;
        }

        case ACTION_FOR_DURATION: {
            INFOF("[Rule] Executing FOR_DURATION action: Set Pin %d to %s for %ds", tPin, aState ? "HIGH" : "LOW", actDelay);
            applyState(tPin, aState, ctx); // Apply immediately
            if (ctx.appTimer != nullptr && actDelay > 0 && actDelay <= 60) {
                const bool reverseState = !aState;
                ctx.pinManager->setPendingRuleActionState(tPin, reverseState);
                uniuno::TimerHandle newTimer = ctx.appTimer->setTimeout([ctx, tPin, reverseState]() {
                    if (ctx.pinManager != nullptr) {
                        ctx.pinManager->setRuleActionTimerIdByPin(tPin, uniuno::TimerHandle());
                    }
                    applyState(tPin, reverseState, const_cast<RuleContext&>(ctx));
                }, actDelay * 1000);
                ctx.pinManager->setRuleActionTimerIdByPin(tPin, newTimer);
            }
            break;
        }

        default:
            break;
    }
}

void ImmediateActionStrategy::execute(const RuleAction& act, int sourcePin, RuleContext& ctx) {
    ActionExecutor::execute(act, sourcePin, ctx);
}

void DelayedActionStrategy::execute(const RuleAction& act, int sourcePin, RuleContext& ctx) {
    ActionExecutor::execute(act, sourcePin, ctx);
}

void DurationActionStrategy::execute(const RuleAction& act, int sourcePin, RuleContext& ctx) {
    ActionExecutor::execute(act, sourcePin, ctx);
}

} // namespace rules
} // namespace uniuno
