#include "RuleEngine.h"
#include <Utilities/logging.h>
#include <AppEvents.h>
#include "evaluators/HoldTimeEvaluator.h"
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
 * @brief Handle input pin state transitions (digital or analog threshold crossings) and evaluate configured rules.
 * 
 * @param sourcePin Hardware pin number of the input.
 * @param newState The new digital/threshold state (true for HIGH, false for LOW).
 * @param durationSec How many seconds the previous state was held.
 * @param rule The active rule configuration for this input.
 */
HOT_PATH void RuleEngine::handleInput(int sourcePin, bool newState, unsigned long durationSec, const RuleConfig& rule) {
    INFOF("[Input] Pin %d state changed to %s (duration: %lus)", sourcePin, newState ? "HIGH" : "LOW", durationSec);
    
    // Input state publication is centralized through PinStateChangedEvent so
    // MQTT, local WebSocket, and Cloudflare observers receive the same event.

    // 2. Debounce cloud sync (1000ms delay to prevent event flooding)
    scheduleCloudSync(sourcePin);

    // 3. Evaluate configured rules
    if (rule.active && _ctx.pinManager != nullptr) {
        uniuno::rules::HoldTimeEvaluator evaluator(_ctx);

        // Cancel any pending hold timer for this pin
        if (_ctx.appTimer != nullptr) {
            uniuno::TimerHandle existingHoldTimer = _ctx.pinManager->getHoldTimerIdByPin(sourcePin);
            if (existingHoldTimer.isActive()) {
                existingHoldTimer.cancel();
                _ctx.pinManager->setHoldTimerIdByPin(sourcePin, uniuno::TimerHandle());
            }
        }

        // Symmetrically determine released vs starting action groups
        const RuleAction* releaseActions = newState ? rule.lowActions : rule.highActions;
        const int releaseCount = newState ? rule.lowActionCount : rule.highActionCount;

        const RuleAction* startActions = newState ? rule.highActions : rule.lowActions;
        const int startCount = newState ? rule.highActionCount : rule.lowActionCount;

        // A. Process release of the previous state (unless already executed by a hold timer)
        if (!_ctx.pinManager->getIsHandledByPin(sourcePin)) {
            evaluator.processRelease(releaseActions, releaseCount, durationSec, sourcePin);
        }
        _ctx.pinManager->setIsHandledByPin(sourcePin, false);

        // B. Process starting actions for the new state
        if (startCount == 1) {
            const int reqHold = startActions[0].requiredHoldTime;
            if (reqHold == 0) {
                executeAction(startActions[0], sourcePin);
                _ctx.pinManager->setIsHandledByPin(sourcePin, true);
            } else if (_ctx.appTimer != nullptr) {
                const RuleAction pendingAct = startActions[0];
                _ctx.pinManager->setPendingHoldAction(sourcePin, pendingAct);
                uniuno::TimerHandle tid = _ctx.appTimer->setTimeout([this, sourcePin, pendingAct]() {
                    if (_ctx.pinManager != nullptr) {
                        _ctx.pinManager->setHoldTimerIdByPin(sourcePin, uniuno::TimerHandle());
                        executeAction(pendingAct, sourcePin);
                        _ctx.pinManager->setIsHandledByPin(sourcePin, true);
                    }
                }, reqHold * 1000);
                _ctx.pinManager->setHoldTimerIdByPin(sourcePin, tid);
            }
        } else if (startCount > 1) {
            // Single pass: execute immediate actions AND find the longest hold-duration
            // action (10s) simultaneously — avoids two separate O(N) scans over the same
            // small fixed array (N ≤ 4).
            bool has10s = false;
            RuleAction act10s;
            for (int i = 0; i < startCount; ++i) {
                const int holdTime = startActions[i].requiredHoldTime;
                if (holdTime == 0) {
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
                        executeAction(act10s, sourcePin);
                        _ctx.pinManager->setIsHandledByPin(sourcePin, true);
                    }
                }, static_cast<uint32_t>(act10s.requiredHoldTime) * 1000UL);
                _ctx.pinManager->setHoldTimerIdByPin(sourcePin, tid);
            }
        }
    }
}
