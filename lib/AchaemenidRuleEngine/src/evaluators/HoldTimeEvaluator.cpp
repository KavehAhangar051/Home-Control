#include "HoldTimeEvaluator.h"
#include "../strategies/ActionStrategies.h"
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

HoldTimeEvaluator::HoldTimeEvaluator(RuleContext& ctx) : _ctx(ctx) {}

void HoldTimeEvaluator::executeAction(const RuleAction& act, int sourcePin) {
    ActionExecutor::execute(act, sourcePin, _ctx);
}

/**
 * @brief Match hold duration to standard brackets (0s, 3s, 5s, 10s) and execute matching actions.
 * 
 * @param actions Array of rule actions configured for this state release.
 * @param count Number of actions in the array.
 * @param durationSec Duration the pin was held before release.
 * @param sourcePin Pin number of the input that was released.
 */
HOT_PATH void HoldTimeEvaluator::processRelease(const RuleAction* actions, int count, unsigned long durationSec, int sourcePin) {
    if (UNLIKELY(actions == nullptr || count <= 0)) return;
    
    // Categorize duration into standardized hold brackets using branchless LUT
    // Brackets: 0..1s -> 0, 2..3s -> 3, 4..6s -> 5, >=7s -> 10
    static const uint8_t HOLD_BRACKET_LUT[11] = {
        0, 0, 3, 3, 5, 5, 5, 10, 10, 10, 10
    };
    const int durationBracket = (durationSec < 11) ? HOLD_BRACKET_LUT[durationSec] : 10;
    
    // Execute actions corresponding to this duration bracket
    for (int i = 0; i < count; i++) {
        // Zero-second actions are executed when the new input state begins;
        // release processing is reserved for hold-duration actions.
        if (actions[i].requiredHoldTime > 0 &&
            actions[i].requiredHoldTime == durationBracket) {
            executeAction(actions[i], sourcePin);
        }
    }
}

} // namespace rules
} // namespace uniuno
