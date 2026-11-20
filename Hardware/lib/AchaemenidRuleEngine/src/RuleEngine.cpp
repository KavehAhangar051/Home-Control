#include "RuleEngine.h"
#include <Utilities/logging.h>
#include <AppEvents.h>
#include "evaluators/HoldTimeEvaluator.h"
#include "evaluators/DoubleClickEvaluator.h"
#include "evaluators/AnalogRangeEvaluator.h"
#include "strategies/ActionStrategies.h"
#include <Optimization/CompilerTraits.h>

RuleEngine::RuleEngine(RuleContext ctx) : _ctx(ctx) {
}

void RuleEngine::executeAction(const RuleAction& act, int sourcePin) {
    uniuno::rules::ActionExecutor::execute(act, sourcePin, _ctx);
}

// NOTE: onTimerExpired() was a TimerExpiredEvent event-bus fallback path.
// Audit confirmed it is never registered to the event dispatcher (no
// eventBus->on<TimerExpiredEvent>(...) call found anywhere in the project).
// All timer expirations are handled via inline setTimeout lambdas in
// handleInput() and ActionExecutor::execute(). Dead code — removed.

HOT_PATH void RuleEngine::scheduleCloudSync(int sourcePin) {
    if (_ctx.appTimer == nullptr || _ctx.pinManager == nullptr) return;

    uniuno::TimerHandle existingTimer = _ctx.pinManager->getCloudSyncTimerIdByPin(sourcePin);
    if (existingTimer.isActive()) {
        existingTimer.cancel();
        _ctx.pinManager->setCloudSyncTimerIdByPin(sourcePin, uniuno::TimerHandle());
    }

    uniuno::TimerHandle newTimer = _ctx.appTimer->setTimeout([this, sourcePin]() {
        if (_ctx.pinManager != nullptr) {
            _ctx.pinManager->setCloudSyncTimerIdByPin(sourcePin, uniuno::TimerHandle());
            const bool finalState = _ctx.pinManager->getPinState(sourcePin);
            const int16_t finalAnalog = _ctx.pinManager->getPinAnalogValue(sourcePin);
            const uint8_t finalRes = _ctx.pinManager->getPinAnalogResolution(sourcePin);
            if (_ctx.eventBus != nullptr) {
                CloudSyncRequestEvent syncEvt{sourcePin, finalState, finalAnalog, finalRes};
                _ctx.eventBus->dispatch(syncEvt);
            }
            if (finalAnalog >= 0) {
                INFOF("[Input] Synced debounced analog state of Pin %d (state=%s, val=%d, %u-bit)",
                      sourcePin, finalState ? "HIGH" : "LOW", static_cast<int>(finalAnalog),
                      static_cast<unsigned int>(finalRes));
            } else {
                INFOF("[Input] Synced debounced state of Pin %d to %s", sourcePin, finalState ? "HIGH" : "LOW");
            }
        }
    }, 1000);

    _ctx.pinManager->setCloudSyncTimerIdByPin(sourcePin, newTimer);
}

/**
 * @brief Handle input pin state transitions (digital or legacy analog threshold crossings)
 * and evaluate configured single-click, double-click, and hold-time rules.
 */
HOT_PATH void RuleEngine::handleInput(int sourcePin, bool newState, unsigned long durationSec, const RuleConfig& rule) {
    INFOF("[Input] Pin %d state changed to %s (duration: %lus)", sourcePin, newState ? "HIGH" : "LOW", durationSec);
    
    // Input state publication is centralized through PinStateChangedEvent so
    // MQTT, local WebSocket, and Cloudflare observers receive the same event.

    // 2. Debounce cloud sync (1000ms delay to prevent event flooding)
    scheduleCloudSync(sourcePin);

    // 3. Evaluate configured rules
    if (rule.active && _ctx.pinManager != nullptr) {
        uniuno::rules::HoldTimeEvaluator holdEval(_ctx);
        uniuno::rules::DoubleClickEvaluator dcEval(_ctx);

        // Cancel any pending hold timer for this pin
        if (_ctx.appTimer != nullptr) {
            uniuno::TimerHandle existingHoldTimer = _ctx.pinManager->getHoldTimerIdByPin(sourcePin);
            if (existingHoldTimer.isActive()) {
                existingHoldTimer.cancel();
                _ctx.pinManager->setHoldTimerIdByPin(sourcePin, uniuno::TimerHandle());
            }
        }

        // Symmetrically determine released vs starting action groups
        const bool releasedState = !newState;
        const RuleAction* releaseActions = newState ? rule.lowActions : rule.highActions;
        const int releaseCount = newState ? rule.lowActionCount : rule.highActionCount;

        const RuleAction* startActions = newState ? rule.highActions : rule.lowActions;
        const int startCount = newState ? rule.highActionCount : rule.lowActionCount;

        // A. Process release of the previous state (unless already executed by hold timer or double-click)
        if (!_ctx.pinManager->getIsHandledByPin(sourcePin)) {
            const bool consumedByDoubleClickWindow = dcEval.onStateRelease(
                sourcePin, releasedState, durationSec, releaseActions, releaseCount);
            if (!consumedByDoubleClickWindow) {
                holdEval.processRelease(releaseActions, releaseCount, durationSec, sourcePin);
            }
        }
        _ctx.pinManager->setIsHandledByPin(sourcePin, false);

        // B. Check if entering `newState` completes a Double Click
        if (dcEval.onStateStart(sourcePin, newState, startActions, startCount)) {
            return;
        }

        const bool deferSingleClick = uniuno::rules::DoubleClickEvaluator::hasDoubleClickAction(startActions, startCount);

        // C. Process starting actions for the new state
        if (startCount == 1) {
            const int reqHold = startActions[0].requiredHoldTime;
            if (reqHold == 0) {
                if (!deferSingleClick) {
                    executeAction(startActions[0], sourcePin);
                    _ctx.pinManager->setIsHandledByPin(sourcePin, true);
                }
            } else if (reqHold > 0 && _ctx.appTimer != nullptr) {
                const RuleAction pendingAct = startActions[0];
                _ctx.pinManager->setPendingHoldAction(sourcePin, pendingAct);
                uniuno::TimerHandle tid = _ctx.appTimer->setTimeout([this, sourcePin, pendingAct]() {
                    if (_ctx.pinManager != nullptr) {
                        _ctx.pinManager->setHoldTimerIdByPin(sourcePin, uniuno::TimerHandle());
                        _ctx.pinManager->setClickCountByPin(sourcePin, 0);
                        executeAction(pendingAct, sourcePin);
                        _ctx.pinManager->setIsHandledByPin(sourcePin, true);
                    }
                }, static_cast<uint32_t>(reqHold) * 1000UL);
                _ctx.pinManager->setHoldTimerIdByPin(sourcePin, tid);
            }
        } else if (startCount > 1) {
            // Single pass: execute immediate actions (unless deferred for double-click disambiguation)
            // AND find the longest hold-duration action (10s) simultaneously.
            bool has10s = false;
            RuleAction act10s;
            for (int i = 0; i < startCount; ++i) {
                const int holdTime = startActions[i].requiredHoldTime;
                if (holdTime == 0 && !deferSingleClick) {
                    executeAction(startActions[i], sourcePin);
                } else if (holdTime == 10 && !has10s) {
                    has10s = true;
                    act10s = startActions[i];
                }
            }

            if (has10s && _ctx.appTimer != nullptr) {
                _ctx.pinManager->setPendingHoldAction(sourcePin, act10s);
                uniuno::TimerHandle tid = _ctx.appTimer->setTimeout([this, sourcePin, act10s]() {
                    if (_ctx.pinManager != nullptr) {
                        _ctx.pinManager->setHoldTimerIdByPin(sourcePin, uniuno::TimerHandle());
                        _ctx.pinManager->setClickCountByPin(sourcePin, 0);
                        executeAction(act10s, sourcePin);
                        _ctx.pinManager->setIsHandledByPin(sourcePin, true);
                    }
                }, static_cast<uint32_t>(act10s.requiredHoldTime) * 1000UL);
                _ctx.pinManager->setHoldTimerIdByPin(sourcePin, tid);
            }
        }
    }
}

/**
 * @brief Handle analog_input value readings and evaluate all independent multi-range rules [min..max].
 */
HOT_PATH void RuleEngine::handleAnalogInput(const AnalogInputChange& change, const RuleConfig& rule) {
    scheduleCloudSync(change.pin);

    if (rule.active && rule.analogRangeCount > 0 && _ctx.pinManager != nullptr) {
        uniuno::rules::AnalogRangeEvaluator rangeEval(_ctx);
        rangeEval.evaluate(change.pin, change.value, change.resolution, rule);
    }
}
