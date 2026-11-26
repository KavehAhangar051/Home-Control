#ifndef ANALOG_RANGE_EVALUATOR_H
#define ANALOG_RANGE_EVALUATOR_H

#include "../RuleEngine.h"
#include <AchaemenidConfigProtocol.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

/**
 * @brief Evaluates independent multi-range analog rules [minValue .. maxValue] with per-range hysteresis.
 * Uses branchless Xtensa LX6 ASM (asm_range_eval) and a 1-byte active bitmask per analog_input pin.
 */
class AnalogRangeEvaluator {
public:
  explicit AnalogRangeEvaluator(RuleContext& ctx);

  HOT_PATH uint8_t evaluate(int sourcePin, uint16_t value, uint8_t resolution, const RuleConfig& rule);

private:
  RuleContext& _ctx;
};

} // namespace rules
} // namespace uniuno

#endif // ANALOG_RANGE_EVALUATOR_H
