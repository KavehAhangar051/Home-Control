#ifndef DOUBLE_CLICK_EVALUATOR_H
#define DOUBLE_CLICK_EVALUATOR_H

#include "../RuleEngine.h"
#include <AchaemenidConfigProtocol.h>
#include <Optimization/CompilerTraits.h>

namespace uniuno {
namespace rules {

/**
 * @brief Non-blocking double-click detector and single-click disambiguator for digital inputs.
 *
 * Semantics:
 * - Zero latency overhead when a polarity has no RULE_TRIGGER_DOUBLE_CLICK (-1) action.
 * - When a polarity has a double-click action:
 *   - First quick press+release arms a 400ms detection window.
 *   - A second press within 400ms cancels any deferred single-click timer and fires double-click immediately.
 *   - If 400ms expires without a second press, any deferred single-click (hld=0) action executes cleanly.
 *   - Holding >= 2s cancels click tracking so hold-time rules (3s/5s/10s) evaluate normally on release.
 */
class DoubleClickEvaluator {
public:
  explicit DoubleClickEvaluator(RuleContext& ctx);

  static bool hasDoubleClickAction(const RuleAction* actions, int count);

  /**
   * @brief Called when the digital input enters `newState`.
   * @return true if a double-click was just completed and executed (caller should skip start actions).
   */
  HOT_PATH bool onStateStart(int sourcePin, bool newState, const RuleAction* startActions, int startCount);

  /**
   * @brief Called when the digital input leaves `releasedState`.
   * @return true if the release was consumed by click #1 window arming (caller should skip hold release).
   */
  HOT_PATH bool onStateRelease(int sourcePin, bool releasedState, unsigned long durationSec,
                               const RuleAction* releaseActions, int releaseCount);

private:
  RuleContext& _ctx;
};

} // namespace rules
} // namespace uniuno

#endif // DOUBLE_CLICK_EVALUATOR_H
