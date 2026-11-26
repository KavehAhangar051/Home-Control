#include "DoubleClickEvaluator.h"
#include "../strategies/ActionStrategies.h"
#include <Utilities/logging.h>

namespace uniuno {
namespace rules {

DoubleClickEvaluator::DoubleClickEvaluator(RuleContext& ctx) : _ctx(ctx) {}

bool DoubleClickEvaluator::hasDoubleClickAction(const RuleAction* actions, int count) {
    if (actions == nullptr || count <= 0) return false;
    for (int i = 0; i < count; ++i) {
        if (actions[i].requiredHoldTime == RULE_TRIGGER_DOUBLE_CLICK) {
            return true;
        }
    }
    return false;
}

HOT_PATH bool DoubleClickEvaluator::onStateStart(
    int sourcePin,
    bool newState,
    const RuleAction* startActions,
    int startCount
) {
    if (_ctx.pinManager == nullptr || !hasDoubleClickAction(startActions, startCount)) {
        return false;
    }

    // Cancel any active inter-click expiry / deferred single-click timer
    if (_ctx.appTimer != nullptr) {
        uniuno::TimerHandle existingDcTimer = _ctx.pinManager->getDoubleClickTimerIdByPin(sourcePin);
        if (existingDcTimer.isActive()) {
            existingDcTimer.cancel();
            _ctx.pinManager->setDoubleClickTimerIdByPin(sourcePin, uniuno::TimerHandle());
        }
    }

    const unsigned long now = millis();
    const uint8_t prevClicks = _ctx.pinManager->getClickCountByPin(sourcePin);
    const bool prevPol = _ctx.pinManager->getClickPolarityByPin(sourcePin);
    const unsigned long lastClickMs = _ctx.pinManager->getLastClickTimeByPin(sourcePin);

    if (prevClicks == 1 && prevPol == newState &&
        static_cast<unsigned long>(now - lastClickMs) <= DEFAULT_DOUBLE_CLICK_WINDOW_MS) {
        // Second tap within 400ms window -> DOUBLE CLICK DETECTED!
        _ctx.pinManager->setClickCountByPin(sourcePin, 0);
        _ctx.pinManager->setLastClickTimeByPin(sourcePin, 0);
        _ctx.pinManager->setIsHandledByPin(sourcePin, true);

        INFOF("[Rule] DOUBLE CLICK detected on GPIO%d (%s)", sourcePin, newState ? "HIGH" : "LOW");
        ActionExecutor::executeMatchingHold(
            startActions, startCount, RULE_TRIGGER_DOUBLE_CLICK, sourcePin, _ctx);
        return true;
    }

    // First tap: arm click tracking for this polarity (window timer starts upon quick release)
    _ctx.pinManager->setClickCountByPin(sourcePin, 1);
    _ctx.pinManager->setClickPolarityByPin(sourcePin, newState);
    _ctx.pinManager->setLastClickTimeByPin(sourcePin, now);
    return false;
}

HOT_PATH bool DoubleClickEvaluator::onStateRelease(
    int sourcePin,
    bool releasedState,
    unsigned long durationSec,
    const RuleAction* releaseActions,
    int releaseCount
) {
    if (_ctx.pinManager == nullptr || !hasDoubleClickAction(releaseActions, releaseCount)) {
        return false;
    }

    // If held >= 2 seconds, this is a long press (not a click) -> cancel double-click tracking
    if (durationSec >= 2) {
        if (_ctx.appTimer != nullptr) {
            uniuno::TimerHandle existing = _ctx.pinManager->getDoubleClickTimerIdByPin(sourcePin);
            if (existing.isActive()) {
                existing.cancel();
                _ctx.pinManager->setDoubleClickTimerIdByPin(sourcePin, uniuno::TimerHandle());
            }
        }
        _ctx.pinManager->setClickCountByPin(sourcePin, 0);
        return false;
    }

    const uint8_t clicks = _ctx.pinManager->getClickCountByPin(sourcePin);
    const bool pol = _ctx.pinManager->getClickPolarityByPin(sourcePin);
    if (clicks != 1 || pol != releasedState) {
        return false;
    }

    // Start the 400ms inter-click window from the release timestamp of Click #1
    _ctx.pinManager->setLastClickTimeByPin(sourcePin, millis());

    if (_ctx.appTimer != nullptr) {
        uniuno::TimerHandle existing = _ctx.pinManager->getDoubleClickTimerIdByPin(sourcePin);
        if (existing.isActive()) {
            existing.cancel();
            _ctx.pinManager->setDoubleClickTimerIdByPin(sourcePin, uniuno::TimerHandle());
        }

        RuleContext ctxCopy = _ctx;
        uniuno::TimerHandle dcTimer = _ctx.appTimer->setTimeout(
            [ctxCopy, sourcePin, releasedState]() mutable {
                if (ctxCopy.pinManager == nullptr) return;
                ctxCopy.pinManager->setDoubleClickTimerIdByPin(sourcePin, uniuno::TimerHandle());
                ctxCopy.pinManager->setClickCountByPin(sourcePin, 0);

                // Execute deferred single-click (requiredHoldTime == 0) actions if still configured
                const RuleConfig* liveRule = ctxCopy.pinManager->getRuleByPinPtr(sourcePin);
                if (liveRule == nullptr || !liveRule->active) return;
                const RuleAction* acts = releasedState ? liveRule->highActions : liveRule->lowActions;
                const int cnt = releasedState ? liveRule->highActionCount : liveRule->lowActionCount;
                ActionExecutor::executeMatchingHold(acts, cnt, 0, sourcePin, ctxCopy);
            },
            DEFAULT_DOUBLE_CLICK_WINDOW_MS
        );
        _ctx.pinManager->setDoubleClickTimerIdByPin(sourcePin, dcTimer);
    }

    return true;
}

} // namespace rules
} // namespace uniuno
