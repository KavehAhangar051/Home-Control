#include "AnalogRangeEvaluator.h"
#include "../strategies/ActionStrategies.h"
#include "ConditionEvaluator.h"
#include <Optimization/XtensaAnalogAsm.h>
#include <Utilities/logging.h>

namespace uniuno {
namespace rules {

AnalogRangeEvaluator::AnalogRangeEvaluator(RuleContext& ctx) : _ctx(ctx) {}

HOT_PATH uint8_t AnalogRangeEvaluator::evaluate(int sourcePin, uint16_t value, uint8_t resolution,
                                                const RuleConfig& rule) {
  if (UNLIKELY(!rule.active || rule.analogRangeCount == 0 || _ctx.pinManager == nullptr)) {
    return 0;
  }

  const uint8_t safeRes =
      (resolution >= MIN_ADC_RESOLUTION && resolution <= MAX_ADC_RESOLUTION) ? resolution : DEFAULT_ADC_RESOLUTION;
  const uint16_t maxScale = static_cast<uint16_t>((1UL << safeRes) - 1UL);
  const uint8_t count =
      (rule.analogRangeCount <= MAX_ANALOG_RANGE_RULES) ? rule.analogRangeCount : MAX_ANALOG_RANGE_RULES;

  const uint8_t prevMask = _ctx.pinManager->getAnalogRangeMaskByPin(sourcePin);
  uint8_t nextMask = 0;
  uint8_t triggered = 0;

  // First pass: compute complete updated bitmask with branchless Xtensa ASM
  for (uint8_t i = 0; i < count; ++i) {
    const AnalogRangeRule& rr = rule.analogRanges[i];
    if (UNLIKELY(!rr.enabled || rr.targetPin < 0)) continue;

    const bool wasIn = ((prevMask >> i) & 1U) != 0U;
    const bool nowIn =
        uniuno::xtensa_asm::asm_range_eval(value, rr.minValue, rr.maxValue, rr.hysteresis, maxScale, wasIn);
    if (nowIn) {
      nextMask |= static_cast<uint8_t>(1U << i);
    }
  }

  // Persist mask BEFORE firing actions so re-entrant/cascading queries see latest state
  _ctx.pinManager->setAnalogRangeMaskByPin(sourcePin, nextMask);

  // Early exit if no range changed state (1 cycle check)
  const uint8_t diffMask = static_cast<uint8_t>(prevMask ^ nextMask);
  if (LIKELY(diffMask == 0)) {
    return 0;
  }

  // Second pass (evaluate guard conditions against current snapshot BEFORE executing any action)
  uint8_t fireMask = 0;
  for (uint8_t i = 0; i < count; ++i) {
    if (((diffMask >> i) & 1U) == 0U) continue;
    const AnalogRangeRule& rr = rule.analogRanges[i];
    if (UNLIKELY(!rr.enabled || rr.targetPin < 0)) continue;

    const bool nowIn = ((nextMask >> i) & 1U) != 0U;
    const bool shouldFire = (nowIn && rr.triggerMode == RANGE_ON_ENTER) || (!nowIn && rr.triggerMode == RANGE_ON_EXIT);

    if (shouldFire &&
        ConditionEvaluator::evaluateAll(rr.conditions, rr.conditionCount, rr.conditionLogic, _ctx.pinManager)) {
      fireMask |= static_cast<uint8_t>(1U << i);
    }
  }

  // Third pass: execute all transitioned & condition-passing range actions
  for (uint8_t i = 0; i < count; ++i) {
    if (((fireMask >> i) & 1U) == 0U) continue;
    const AnalogRangeRule& rr = rule.analogRanges[i];
    const bool nowIn = ((nextMask >> i) & 1U) != 0U;
    INFOF("[AnalogRule] GPIO%d val=%u %s range[%u] [%u..%u] (hyst=%u) -> target GPIO%d", sourcePin,
          static_cast<unsigned int>(value), nowIn ? "ENTERED" : "EXITED", static_cast<unsigned int>(i),
          static_cast<unsigned int>(rr.minValue), static_cast<unsigned int>(rr.maxValue),
          static_cast<unsigned int>(rr.hysteresis), static_cast<int>(rr.targetPin));
    ActionExecutor::executeUnchecked(rr.toRuleAction(), sourcePin, _ctx);
    triggered++;
  }

  return triggered;
}

} // namespace rules
} // namespace uniuno
