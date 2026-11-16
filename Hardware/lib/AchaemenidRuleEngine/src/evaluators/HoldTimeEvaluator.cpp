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
    
    // Categorize duration into standardized hold brackets
    int durationBracket = 0;
    if (durationSec < 2) {
        durationBracket = 0;
    } else if (durationSec < 4) {
        durationBracket = 3;
    } else if (durationSec < 7) {
        durationBracket = 5;
    } else {
        durationBracket = 10;
    }
    
    // Execute actions corresponding to this duration bracket
    for (int i = 0; i < count; i++) {
        if (actions[i].requiredHoldTime == durationBracket) {
            executeAction(actions[i], sourcePin);
        }
    }
}

} // namespace rules
} // namespace uniuno
