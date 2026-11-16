#ifndef HOLD_TIME_EVALUATOR_H
#define HOLD_TIME_EVALUATOR_H

#include "../RuleEngine.h"
#include <AchaemenidConfigProtocol.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

/**
 * @brief Evaluates button hold durations and triggers matching actions on release.
 */
class HoldTimeEvaluator {
public:
    HoldTimeEvaluator(RuleContext& ctx);
    
    HOT_PATH void processRelease(const RuleAction* actions, int count, unsigned long durationSec, int sourcePin);

private:
    RuleContext& _ctx;
    void executeAction(const RuleAction& act, int sourcePin);
};

} // namespace rules
} // namespace uniuno

#endif // HOLD_TIME_EVALUATOR_H
