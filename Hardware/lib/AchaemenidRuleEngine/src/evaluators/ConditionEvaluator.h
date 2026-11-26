#ifndef CONDITION_EVALUATOR_H
#define CONDITION_EVALUATOR_H

#include <AchaemenidConfigProtocol.h>
#include <Optimization/CompilerTraits.h>
#include <PinManager.h>

namespace uniuno {
namespace rules {

/**
 * @brief Evaluates ESP32 hardware guard conditions against live PinManager states.
 * Zero-allocation, deterministic integer comparisons across local and virtual segments.
 */
class ConditionEvaluator {
public:
    HOT_PATH static bool evaluateSingle(const RuleCondition& cond, const PinManager* pinManager);

    HOT_PATH static bool evaluateAll(
        const RuleCondition* conditions,
        uint8_t count,
        uint8_t logic,
        const PinManager* pinManager
    );
};

} // namespace rules
} // namespace uniuno

#endif // CONDITION_EVALUATOR_H

